import { SensorNode, IN_SERVICE, ISensorNode } from '@/models/device.model'
import { Zone } from '@/models/houseZone.model'
import { Telemetry } from '@/models/telemetry.model'
import { MaintenancePlan } from '@/models/maintenancePlan.model'
import { createAlert } from '@/services/alert.service'

type UsageRelay = 'misting' | 'ventilation'
const RELAYS: UsageRelay[] = ['misting', 'ventilation']
const RELAY_LABEL: Record<UsageRelay, string> = { misting: 'bơm phun sương', ventilation: 'quạt thông gió' }

// Số tham khảo chung, thay bằng datasheet thiết bị thật
export const RELAY_SERVICE_LIMITS: Record<UsageRelay, { hours: number; switches: number }> = {
  misting:     { hours: 500,  switches: 100_000 },
  ventilation: { hours: 2000, switches: 100_000 },
}

// quá chừng này là mất kết nối, không tính
export const MAX_GAP_MS = 30_000
// Telemetry giữ 90 ngày, đếm hết quá nặng
const FIRST_RUN_LOOKBACK_MS = 7 * 86400_000
const BATCH = 50_000

type Sample = { timestamp: Date; misting_on?: boolean; ventilation_on?: boolean; pump_current_a?: number; fan_current_a?: number }
type Baseline = { misting_a?: number; ventilation_a?: number }

// cùng mức của firmware
export const RUNNING_MIN_RATIO = 0.5
const CURRENT_KEY: Record<UsageRelay, 'pump_current_a' | 'fan_current_a'> = { misting: 'pump_current_a', ventilation: 'fan_current_a' }

// Thiếu mức đã học hoặc số đo dòng thì tính theo relay
export function tallyRelayUsage(
  prev: { at?: Date; misting?: boolean; ventilation?: boolean },
  samples: Sample[],
  baseline: Baseline = {},
) {
  const onMs: Record<UsageRelay, number> = { misting: 0, ventilation: 0 }
  const switches: Record<UsageRelay, number> = { misting: 0, ventilation: 0 }
  let last: { at?: Date; misting?: boolean; ventilation?: boolean; sample?: Sample } = prev
  const running = (r: UsageRelay, sample: Sample | undefined) => {
    const normal = baseline[`${r}_a`]
    const amps = sample?.[CURRENT_KEY[r]]
    return normal === undefined || amps === undefined || amps > normal * RUNNING_MIN_RATIO
  }
  for (const s of samples) {
    const gap = last.at ? s.timestamp.getTime() - last.at.getTime() : Infinity
    for (const r of RELAYS) {
      const before = last[r]
      const now = s[`${r}_on`]
      if (gap <= MAX_GAP_MS && before !== undefined && now !== undefined) {
        if (before && running(r, last.sample)) onMs[r] += gap
        if (before !== now) switches[r]++
      }
    }
    last = { at: s.timestamp, misting: s.misting_on, ventilation: s.ventilation_on, sample: s }
  }
  return { onHours: { misting: onMs.misting / 3600_000, ventilation: onMs.ventilation / 3600_000 }, switches, last }
}

// Không reset ở đây: xác nhận cảnh báo mới đếm lại
export async function accumulateRelayUsage(now = new Date()): Promise<{ nodes: number; alerts: number }> {
  const nodes = await SensorNode.find(IN_SERVICE).select('_id zone_id device_id relay_usage actuator_baseline')
  let alerts = 0

  for (const node of nodes) {
    const usage = node.relay_usage
    const since = usage.counted_until ?? new Date(now.getTime() - FIRST_RUN_LOOKBACK_MS)
    const samples = await Telemetry.find({ node_id: node._id, timestamp: { $gt: since, $lte: now }, misting_on: { $exists: true } })
      .sort({ timestamp: 1 }).limit(BATCH).select('timestamp misting_on ventilation_on pump_current_a fan_current_a').lean<Sample[]>()
    if (samples.length === 0) continue

    const result = tallyRelayUsage({ at: usage.counted_until, misting: usage.last_misting_on, ventilation: usage.last_ventilation_on }, samples, node.actuator_baseline ?? {})
    // $inc: lần xác nhận giữa lúc job chạy không bị số cũ ghi đè
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

// Một cảnh báo mỗi controller; metadata.loads là các tải sẽ được đếm lại khi xác nhận
async function raiseMaintenanceDueIfDue(node: ISensorNode): Promise<boolean> {
  const zone = await Zone.findById(node.zone_id).select('farm_id name house_id').lean()
  if (!zone) return false
  // Tải đã có kế hoạch do maintenance.service lo, không báo hai lần
  const planned = new Set((await MaintenancePlan.find({
    house_id: zone.house_id, state: { $ne: 'RETIRED' }, equipment: { $in: ['PUMP', 'FAN'] },
  }).select('equipment').lean()).map(p => (p.equipment === 'PUMP' ? 'misting' : 'ventilation')))
  const due = RELAYS.filter(r => {
    if (planned.has(r)) return false
    const u = node.relay_usage[r]
    return u.since_service_hours >= RELAY_SERVICE_LIMITS[r].hours || u.since_service_switches >= RELAY_SERVICE_LIMITS[r].switches
  })
  if (due.length === 0) return false

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
