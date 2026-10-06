import { SensorNode, IN_SERVICE, ISensorNode } from '@/models/device.model'
import { Zone } from '@/models/houseZone.model'
import { Telemetry } from '@/models/telemetry.model'
import { createMaintenanceTicket } from '@/services/ticket.service'
import { nextVisitSlot } from '@/utils/visitTime.util'
import logger from '@/utils/logger.util'

type UsageRelay = 'misting' | 'ventilation'
const RELAYS: UsageRelay[] = ['misting', 'ventilation']
const RELAY_LABEL: Record<UsageRelay, string> = { misting: 'bơm phun sương', ventilation: 'quạt thông gió' }

/**
 * TICKET-FR-018 — ngưỡng bảo trì theo thời gian chạy thật.
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
 * Chạy mỗi giờ (jobs/maintenanceSchedule.job.ts): cộng dồn giờ chạy/số lần đóng
 * cắt của bơm và quạt từ telemetry mới, vượt RELAY_SERVICE_LIMITS thì tạo 1 ticket
 * MAINTENANCE rồi đếm lại từ 0 cho chu kỳ bảo trì kế tiếp.
 */
export async function accumulateRelayUsage(now = new Date()): Promise<{ nodes: number; tickets: number }> {
  const nodes = await SensorNode.find(IN_SERVICE).select('_id zone_id device_id relay_usage')
  let tickets = 0

  for (const node of nodes) {
    const usage = node.relay_usage
    const since = usage.counted_until ?? new Date(now.getTime() - FIRST_RUN_LOOKBACK_MS)
    const samples = await Telemetry.find({ node_id: node._id, timestamp: { $gt: since, $lte: now }, misting_on: { $exists: true } })
      .sort({ timestamp: 1 }).limit(BATCH).select('timestamp misting_on ventilation_on').lean<Sample[]>()
    if (samples.length === 0) continue

    const result = tallyRelayUsage({ at: usage.counted_until, misting: usage.last_misting_on, ventilation: usage.last_ventilation_on }, samples)
    for (const r of RELAYS) {
      usage[r].on_hours += result.onHours[r]
      usage[r].switches += result.switches[r]
      usage[r].since_service_hours += result.onHours[r]
      usage[r].since_service_switches += result.switches[r]
    }
    usage.counted_until = result.last.at
    usage.last_misting_on = result.last.misting
    usage.last_ventilation_on = result.last.ventilation

    for (const r of RELAYS) {
      if (await createServiceTicketIfDue(node, r, now)) tickets++
    }
    await node.save()
  }
  return { nodes: nodes.length, tickets }
}

async function createServiceTicketIfDue(node: ISensorNode, relay: UsageRelay, now: Date): Promise<boolean> {
  const u = node.relay_usage[relay]
  const limit = RELAY_SERVICE_LIMITS[relay]
  if (u.since_service_hours < limit.hours && u.since_service_switches < limit.switches) return false

  const zone = await Zone.findById(node.zone_id).select('farm_id').lean()
  if (!zone) return false
  try {
    const ticket = await createMaintenanceTicket({
      farm_id: String(zone.farm_id),
      zone_id: String(node.zone_id),
      scheduled_visit_at: nextVisitSlot(new Date(now.getTime() + 86400_000)),
      description: `Bảo trì theo thời gian chạy: ${RELAY_LABEL[relay]} của thiết bị ${node.device_id} đã chạy ` +
        `${Math.round(u.since_service_hours)} giờ / ${u.since_service_switches.toLocaleString('vi-VN')} lần đóng cắt ` +
        `kể từ lần bảo trì trước (mốc ${limit.hours} giờ hoặc ${limit.switches.toLocaleString('vi-VN')} lần)`,
    })
    u.since_service_hours = 0
    u.since_service_switches = 0
    u.last_ticket_id = ticket._id
    return true
  } catch (err) {
    // Không reset bộ đếm → giờ sau thử lại. Không sinh ticket trùng: createMaintenanceTicket
    // chỉ ném lỗi trước/khi ghi ticket (thông báo sau đó là fire-and-forget).
    logger.error('Tạo ticket bảo trì theo thời gian chạy thất bại', { deviceId: node.device_id, relay, err: (err as Error).message })
    return false
  }
}
