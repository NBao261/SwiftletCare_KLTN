import { SensorNode, IN_SERVICE, ISensorNode } from '@/models/device.model'
import { Zone } from '@/models/houseZone.model'
import { Telemetry } from '@/models/telemetry.model'
import { createAlert } from '@/services/alert.service'

type UsageRelay = 'misting' | 'ventilation'
const RELAYS: UsageRelay[] = ['misting', 'ventilation']
const RELAY_LABEL: Record<UsageRelay, string> = { misting: 'bơm phun sương', ventilation: 'quạt thông gió' }

/**
 * ALERT-FR-016 — ngưỡng bảo trì theo thời gian chạy thật (Report 3 §4.5).
 * ponytail: số tham khảo chung (bơm màng ~500 giờ thay màng/lọc, quạt ~2.000 giờ
 * vệ sinh/tra dầu, relay cơ ~100.000 lần đóng cắt) — thay bằng số trong datasheet
 * thiết bị thật đã lắp.
 */
export const RELAY_SERVICE_LIMITS: Record<UsageRelay, { hours: number; switches: number }> = {
  misting:     { hours: 500,  switches: 100_000 },
  ventilation: { hours: 2000, switches: 100_000 },
}

/** Khoảng giữa 2 mẫu lớn hơn thế này = mất kết nối, không biết relay có chạy không → không tính. */
const MAX_GAP_MS = 30_000
/** Lần đầu (chưa có counted_until) chỉ đếm 7 ngày gần nhất — telemetry giữ 90 ngày, đếm hết quá nặng */
const FIRST_RUN_LOOKBACK_MS = 7 * 86400_000
/** Mỗi lần chạy tối đa bấy nhiêu mẫu/thiết bị — còn thì lần sau (mỗi giờ) đếm tiếp */
const BATCH = 50_000

type Sample = { timestamp: Date; misting_on?: boolean; ventilation_on?: boolean }

/** Hàm thuần: cộng thời gian BẬT + số lần đổi trạng thái từ chuỗi mẫu, tiếp nối từ mẫu cuối lần trước. */
export function tallyRelayUsage(prev: { at?: Date; misting?: boolean; ventilation?: boolean }, samples: Sample[]) {
  const onMs: Record<UsageRelay, number> = { misting: 0, ventilation: 0 }
  const switches: Record<UsageRelay, number> = { misting: 0, ventilation: 0 }
  let last = prev
  for (const s of samples) {
    const gap = last.at ? s.timestamp.getTime() - last.at.getTime() : Infinity
    for (const r of RELAYS) {
      const before = last[r]
      const now = s[`${r}_on`]
      if (gap <= MAX_GAP_MS && before !== undefined && now !== undefined) {
        if (before) onMs[r] += gap
        if (before !== now) switches[r]++
      }
    }
    last = { at: s.timestamp, misting: s.misting_on, ventilation: s.ventilation_on }
  }
  return { onHours: { misting: onMs.misting / 3600_000, ventilation: onMs.ventilation / 3600_000 }, switches, last }
}

/**
 * Chạy mỗi giờ (jobs/relayUsage.job.ts): cộng dồn giờ chạy/số lần đóng
 * cắt của bơm và quạt từ telemetry mới, vượt RELAY_SERVICE_LIMITS thì báo cảnh báo
 * MAINTENANCE_DUE. Bộ đếm KHÔNG reset ở đây: Farm Owner xác nhận cảnh báo (đã bảo
 * trì) mới đếm lại từ 0 (BR-16, `acknowledgeAlert`).
 */
export async function accumulateRelayUsage(now = new Date()): Promise<{ nodes: number; alerts: number }> {
  const nodes = await SensorNode.find(IN_SERVICE).select('_id zone_id device_id relay_usage')
  let alerts = 0

  for (const node of nodes) {
    const usage = node.relay_usage
    const since = usage.counted_until ?? new Date(now.getTime() - FIRST_RUN_LOOKBACK_MS)
    const samples = await Telemetry.find({ node_id: node._id, timestamp: { $gt: since, $lte: now }, misting_on: { $exists: true } })
      .sort({ timestamp: 1 }).limit(BATCH).select('timestamp misting_on ventilation_on').lean<Sample[]>()
    if (samples.length === 0) continue

    const result = tallyRelayUsage({ at: usage.counted_until, misting: usage.last_misting_on, ventilation: usage.last_ventilation_on }, samples)
    // $inc thay vì save(): Farm Owner xác nhận MAINTENANCE_DUE giữa lúc job chạy thì lần
    // đếm lại về 0 (acknowledgeAlert) không bị số cũ ghi đè
    const inc: Record<string, number> = {}
    for (const r of RELAYS) {
      inc[`relay_usage.${r}.on_hours`] = result.onHours[r]
      inc[`relay_usage.${r}.switches`] = result.switches[r]
      inc[`relay_usage.${r}.since_service_hours`] = result.onHours[r]
      inc[`relay_usage.${r}.since_service_switches`] = result.switches[r]
    }
    const updated = await SensorNode.findOneAndUpdate({ _id: node._id }, {
      $inc: inc,
      $set: {
        'relay_usage.counted_until': result.last.at,
        'relay_usage.last_misting_on': result.last.misting,
        'relay_usage.last_ventilation_on': result.last.ventilation,
      },
    }, { new: true })
    if (updated && await raiseMaintenanceDueIfDue(updated)) alerts++
  }
  return { nodes: nodes.length, alerts }
}

/**
 * Một cảnh báo cho mỗi controller, liệt kê mọi tải đã quá mốc (khoá dedup của cảnh báo là
 * thiết bị + loại). Mỗi giờ còn quá mốc thì gọi lại: cảnh báo đang mở được cập nhật số
 * mới và danh sách tải (`metadata.loads`) mà lúc xác nhận sẽ được đếm lại.
 */
async function raiseMaintenanceDueIfDue(node: ISensorNode): Promise<boolean> {
  const due = RELAYS.filter(r => {
    const u = node.relay_usage[r]
    return u.since_service_hours >= RELAY_SERVICE_LIMITS[r].hours || u.since_service_switches >= RELAY_SERVICE_LIMITS[r].switches
  })
  if (due.length === 0) return false
  const zone = await Zone.findById(node.zone_id).select('farm_id name').lean()
  if (!zone) return false

  const loads = due.map(r => ({
    relay: r,
    hours: Math.round(node.relay_usage[r].since_service_hours),
    switches: node.relay_usage[r].since_service_switches,
    limit_hours: RELAY_SERVICE_LIMITS[r].hours,
    limit_switches: RELAY_SERVICE_LIMITS[r].switches,
  }))
  const created = await createAlert({
    farmId: String(zone.farm_id),
    zoneId: String(node.zone_id),
    nodeId: String(node._id),
    type: 'MAINTENANCE_DUE',
    title: `Đến hạn bảo trì ${due.map(r => RELAY_LABEL[r]).join(', ')} — ${node.device_id}`,
    message: loads.map(l => `${RELAY_LABEL[l.relay]} của ${node.device_id} (${zone.name}) đã chạy ${l.hours} giờ / ` +
      `${l.switches.toLocaleString('vi-VN')} lần đóng cắt kể từ lần bảo trì trước (mốc ${l.limit_hours} giờ hoặc ` +
      `${l.limit_switches.toLocaleString('vi-VN')} lần)`).join('; ') + '. Xác nhận cảnh báo sau khi bảo trì để đếm lại từ 0.',
    metadata: { loads },
  })
  return created !== null
}
