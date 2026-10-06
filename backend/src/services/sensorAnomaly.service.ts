import { Types } from 'mongoose'
import { SensorNode, IN_SERVICE } from '@/models/device.model'
import { Zone } from '@/models/houseZone.model'
import { Telemetry } from '@/models/telemetry.model'
import { Alert } from '@/models/alert.model'
import { createAlert, OPEN_STATUSES } from '@/services/alert.service'
import { findDrift, findSpikes, findStuck, mean, STUCK_MIN_MS, type AnomalyFinding, type AnomalySample } from '@/utils/sensorAnomaly.util'

const SCAN_WINDOW_MS = STUCK_MIN_MS + 10 * 60_000
const DRIFT_WINDOW_MS = 3600_000

async function resolveOpen(filter: { node_id?: Types.ObjectId | null; zone_id?: Types.ObjectId }, now: Date) {
  const { modifiedCount } = await Alert.updateMany(
    { type: 'SENSOR_ANOMALY', status: { $in: OPEN_STATUSES }, ...filter },
    { status: 'RESOLVED', resolved_at: now, acknowledgement_note: 'Cảm biến đã hoạt động bình thường trở lại' },
  )
  return modifiedCount
}

/**
 * ALERT-FR-010 — quét telemetry 2 giờ gần nhất của mọi thiết bị ONLINE: kẹt /
 * nhảy phi vật lý theo từng thiết bị, lệch giữa các thiết bị cùng Zone. Có phát
 * hiện → SENSOR_ANOMALY (MEDIUM, không tự sinh ticket; dedup theo thiết bị);
 * hết phát hiện → tự đóng. Gọi từ jobs/sensorAnomaly.job.ts mỗi 10 phút.
 * ponytail: mỗi thiết bị 1 truy vấn ~720 mẫu — đủ cho vài chục thiết bị; nhiều
 * hơn thì gộp thành 1 aggregation theo node_id.
 */
export async function scanSensorAnomalies(now = new Date()): Promise<{ raised: number; resolved: number }> {
  const nodes = await SensorNode.find({ status: 'ONLINE', ...IN_SERVICE }).select('_id zone_id device_id').lean()
  const zones = await Zone.find({ _id: { $in: nodes.map(n => n.zone_id) } }).select('_id farm_id name').lean()
  const zoneById = new Map(zones.map(z => [String(z._id), z]))
  let raised = 0
  let resolved = 0

  const byZone = new Map<string, Array<{ name: string; samples: AnomalySample[] }>>()
  for (const node of nodes) {
    const zone = zoneById.get(String(node.zone_id))
    if (!zone) continue
    const samples = await Telemetry.find({ node_id: node._id, timestamp: { $gte: new Date(now.getTime() - SCAN_WINDOW_MS) } })
      .sort({ timestamp: 1 }).select('timestamp temperature humidity nh3_ppm co2_ppm').lean<AnomalySample[]>()

    const findings: AnomalyFinding[] = [...findStuck(samples), ...findSpikes(samples)]
    if (findings.length > 0) {
      const alert = await createAlert({
        farmId: String(zone.farm_id), zoneId: String(zone._id), nodeId: String(node._id),
        type: 'SENSOR_ANOMALY',
        title: `Cảm biến bất thường tại ${zone.name}`,
        message: findings.map(f => f.detail).join('; '),
        metadata: { findings, deviceId: node.device_id },
      })
      if (alert) raised++
    } else {
      resolved += await resolveOpen({ node_id: node._id }, now)
    }

    const list = byZone.get(String(zone._id)) ?? []
    list.push({ name: node.device_id, samples: samples.filter(s => s.timestamp.getTime() >= now.getTime() - DRIFT_WINDOW_MS) })
    byZone.set(String(zone._id), list)
  }

  // Lệch giữa các thiết bị: cảnh báo cấp Zone (không gắn thiết bị nào — chưa biết cái nào sai)
  for (const [zoneId, list] of byZone) {
    if (list.length < 2) continue
    const zone = zoneById.get(zoneId)!
    const drift = findDrift(list.map(n => ({
      name: n.name,
      means: { temperature: mean(n.samples, 'temperature'), humidity: mean(n.samples, 'humidity') },
    })))
    if (drift.length > 0) {
      const alert = await createAlert({
        farmId: String(zone.farm_id), zoneId,
        type: 'SENSOR_ANOMALY',
        title: `Cảm biến giữa các thiết bị lệch nhau tại ${zone.name}`,
        message: drift.map(f => f.detail).join('; '),
        metadata: { findings: drift },
      })
      if (alert) raised++
    } else {
      resolved += await resolveOpen({ zone_id: new Types.ObjectId(zoneId), node_id: null }, now)
    }
  }
  return { raised, resolved }
}
