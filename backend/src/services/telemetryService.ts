import { Telemetry, ITelemetry } from '@/models/Telemetry'
import { SensorNode } from '@/models/Device'
import { emitTelemetryUpdate } from '@/socket'
import { NotFoundError } from '@/utils/AppError'
import type { TelemetryPayload } from '@/types'

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** GET /telemetry/zones/:id/latest – ENV-FR-004 */
export async function getLatest(zoneId: string): Promise<ITelemetry> {
  const latest = await Telemetry.findOne({ zone_id: zoneId }).sort({ timestamp: -1 }).lean()
  if (!latest) throw NotFoundError('Chưa có dữ liệu cho zone này')
  return latest as unknown as ITelemetry
}

export interface HistoryQuery { from?: string; to?: string; page?: number; limit?: number }
export interface HistoryResult { records: ITelemetry[]; total: number; page: number; limit: number }

/** GET /telemetry/zones/:id/history – ANALYTICS-FR-001 */
export async function getHistory(zoneId: string, query: HistoryQuery): Promise<HistoryResult> {
  const filter: Record<string, unknown> = { zone_id: zoneId }
  if (query.from || query.to) {
    filter.timestamp = {
      ...(query.from && { $gte: new Date(query.from) }),
      ...(query.to && { $lte: new Date(query.to) }),
    }
  }

  const page = query.page ?? 1
  const limit = Math.min(query.limit ?? 100, 1000)

  const [records, total] = await Promise.all([
    Telemetry.find(filter).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Telemetry.countDocuments(filter),
  ])

  return { records: records as unknown as ITelemetry[], total, page, limit }
}

/**
 * ingestTelemetry – ENV-FR-001, ENV-FR-004, ENV-FR-005 (gọi từ mqtt/handlers/telemetryHandler.ts)
 *
 * `deviceId` trong payload (không phải farmId/houseId/zoneId trong topic MQTT
 * — đó chỉ là slug định danh, không phải ObjectId Mongo) dùng để tra
 * SensorNode.zone_id thật đã gán lúc onboarding (FARM-FR-003).
 */
export async function ingestTelemetry(payload: TelemetryPayload): Promise<void> {
  if (!payload.deviceId) throw NotFoundError('Thiếu deviceId trong payload telemetry')

  const node = await SensorNode.findOne({ device_id: payload.deviceId })
  if (!node) throw NotFoundError(`Không tìm thấy SensorNode với device_id="${payload.deviceId}"`)

  await Telemetry.create({
    node_id: node._id,
    zone_id: node.zone_id,
    timestamp: payload.timestamp ? new Date(payload.timestamp) : new Date(),
    temperature: isFiniteNumber(payload.temperature) ? payload.temperature : undefined,
    humidity:    isFiniteNumber(payload.humidity)    ? payload.humidity    : undefined,
    light_lux:   isFiniteNumber(payload.light_lux)   ? payload.light_lux   : undefined,
    nh3_ppm:     isFiniteNumber(payload.nh3_ppm)     ? payload.nh3_ppm     : undefined,
    co2_ppm:     isFiniteNumber(payload.co2_ppm)     ? payload.co2_ppm     : undefined,
    sound_db:    isFiniteNumber(payload.sound_db)    ? payload.sound_db    : undefined,
    is_anomaly: false, // TODO: so với Zone.thresholds khi module ENV ngưỡng được implement đầy đủ
  })

  node.status = 'ONLINE'
  node.last_heartbeat = new Date()
  await node.save()

  const zoneId = String(node.zone_id)
  emitTelemetryUpdate(zoneId, {
    zoneId,
    temperature: payload.temperature,
    humidity:    payload.humidity,
    light:       payload.light_lux,
    nh3:         payload.nh3_ppm,
    co2:         payload.co2_ppm,
    sound:       payload.sound_db,
    relayStates: payload.relay_states,
    controlMode: payload.control_mode ?? 'AUTO',
    timestamp:   new Date().toISOString(),
  })
}
