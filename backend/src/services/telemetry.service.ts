import { Telemetry, ITelemetry } from '@/models/telemetry.model'
import { SensorNode, IN_SERVICE } from '@/models/device.model'
import { Zone } from '@/models/houseZone.model'
import { emitTelemetryUpdate } from '@/socket'
import { findThresholdBreaches, raiseThresholdAlert } from '@/services/alert.service'
import { OFFLINE_THRESHOLD_MS, markNodeSeen } from '@/services/device.service'
import { trackBreachDwell } from '@/utils/breachDwell.util'
import { assertZoneAccess } from '@/utils/farmAccess.util'
import { NotFoundError } from '@/utils/appError.util'
import { paginate } from '@/utils/helpers.util'
import logger from '@/utils/logger.util'
import type { TelemetryPayload, CurrentUser } from '@/types'

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
/** Thiếu hoặc null là cảm biến báo cũ hoặc lỗi */
const SENSOR_FIELDS = ['temperature', 'humidity', 'light_lux', 'nh3_ppm', 'co2_ppm', 'sound_db'] as const

/** Zone chưa có số đo thì null, không phải lỗi */
export async function getLatest(zoneId: string, user: CurrentUser): Promise<ITelemetry | null> {
  await assertZoneAccess(zoneId, user)
  const latest = await Telemetry.findOne({ zone_id: zoneId }).sort({ timestamp: -1 }).lean()
  return (latest as unknown as ITelemetry | null) ?? null
}

export interface HistoryQuery { from?: string; to?: string; page?: number; limit?: number }
export interface HistoryResult { records: ITelemetry[]; total: number; page: number; limit: number }

export async function getHistory(zoneId: string, user: CurrentUser, query: HistoryQuery): Promise<HistoryResult> {
  await assertZoneAccess(zoneId, user)

  const filter: Record<string, unknown> = { zone_id: zoneId }
  if (query.from || query.to) {
    filter.timestamp = {
      ...(query.from && { $gte: new Date(query.from) }),
      ...(query.to && { $lte: new Date(query.to) }),
    }
  }

  const { page, skip, limit } = paginate(query.page, query.limit, { defaultLimit: 100, maxLimit: 1000 })

  const [records, total] = await Promise.all([
    Telemetry.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
    Telemetry.countDocuments(filter),
  ])

  return { records: records as unknown as ITelemetry[], total, page, limit }
}

/** deviceId trong payload để tra zone_id, không dùng slug trong topic */
/** Firmware gửi ~1s cho dashboard; DB chỉ cần 1 mẫu/khoảng này */
export const TELEMETRY_PERSIST_INTERVAL_MS = 10_000
/** Cũ hơn mức này là dữ liệu buffer offline flush lại */
export const STALE_TELEMETRY_MS = 60_000
const MAX_BACKDATE_MS = 7 * 24 * 60 * 60 * 1000
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000

// ponytail: in-memory theo process; nhiều instance thì chuyển Redis
const lastPersisted = new Map<string, { at: number; anomaly: boolean }>()

/** Thiếu hoặc vô lý (chưa sync NTP) thì lấy giờ nhận */
function resolveSampleTime(ts: unknown, now: number): number {
  return isFiniteNumber(ts) && ts >= now - MAX_BACKDATE_MS && ts <= now + MAX_CLOCK_SKEW_MS ? ts : now
}

/** Test truyền now để chạy qua thời gian chờ BR-34 */
export async function ingestTelemetry(payload: TelemetryPayload, now = Date.now()): Promise<void> {
  if (!payload.deviceId) throw NotFoundError('Thiếu deviceId trong payload telemetry')

  const node = await SensorNode.findOne({ device_id: payload.deviceId, ...IN_SERVICE })
  if (!node) throw NotFoundError(`Không tìm thấy SensorNode với device_id="${payload.deviceId}"`)

  const sampleTime = resolveSampleTime(payload.timestamp, now)
  const isStale = now - sampleTime > STALE_TELEMETRY_MS
  const nodeId = String(node._id)

  // Zone bị xoá giữa chừng thì vẫn lưu telemetry, chỉ bỏ đánh giá ngưỡng
  const zone = await Zone.findById(node.zone_id).lean()
  const breaches = zone ? findThresholdBreaches(payload, zone.thresholds) : []
  // Tính trên mọi mẫu sống để 1 mẫu trong ngưỡng cắt được quãng chờ; mẫu buffer không tham gia
  const dwell = zone && !isStale ? trackBreachDwell(nodeId, payload, breaches, sampleTime, OFFLINE_THRESHOLD_MS) : undefined

  // Buffer luôn ghi. Sống: tối đa 1 mẫu/khoảng, chỉ lúc bắt đầu vượt ngưỡng mới ghi ngay
  const anomaly = breaches.length > 0
  // Cảm biến lỗi gửi null: lưu là thiếu, ghi tên lại
  const staleFields = SENSOR_FIELDS.filter(field => !isFiniteNumber(payload[field]))
  const last = lastPersisted.get(nodeId)
  const persist = isStale || !last || (anomaly && !last.anomaly) || sampleTime - last.at >= TELEMETRY_PERSIST_INTERVAL_MS
  if (persist) {
    const stored = await Telemetry.create({
      node_id: node._id,
      zone_id: node.zone_id,
      timestamp: new Date(sampleTime),
      temperature: isFiniteNumber(payload.temperature) ? payload.temperature : undefined,
      humidity:    isFiniteNumber(payload.humidity)    ? payload.humidity    : undefined,
      light_lux:   isFiniteNumber(payload.light_lux)   ? payload.light_lux   : undefined,
      nh3_ppm:     isFiniteNumber(payload.nh3_ppm)     ? payload.nh3_ppm     : undefined,
      co2_ppm:     isFiniteNumber(payload.co2_ppm)     ? payload.co2_ppm     : undefined,
      sound_db:    isFiniteNumber(payload.sound_db)    ? payload.sound_db    : undefined,
      misting_pct:     isFiniteNumber(payload.control_output?.misting)     ? payload.control_output?.misting     : undefined,
      ventilation_pct: isFiniteNumber(payload.control_output?.ventilation) ? payload.control_output?.ventilation : undefined,
      misting_on:      payload.relay_states?.misting,
      ventilation_on:  payload.relay_states?.ventilation,
      // Dòng âm là số đo lỗi (shunt một chiều)
      pump_current_a: isFiniteNumber(payload.pump_current_a) && payload.pump_current_a >= 0 ? payload.pump_current_a : undefined,
      fan_current_a:  isFiniteNumber(payload.fan_current_a) && payload.fan_current_a >= 0 ? payload.fan_current_a : undefined,
      is_anomaly: anomaly,
      ...(staleFields.length > 0 && { stale_fields: staleFields }),
      ...(anomaly && { anomaly_fields: [...new Set(breaches.map(b => b.metric))] }),
      ...(payload.buffered && { buffered: true }),
    }).catch((err: { code?: number }) => {
      if (err.code === 11000) return null // QoS 1 giao lại
      throw err
    })
    if (!stored) return
    if (!isStale) lastPersisted.set(nodeId, { at: sampleTime, anomaly })
  }

  // Chỉ ghi khi cần thay vì save() mỗi giây
  if (persist || node.status !== 'ONLINE') await markNodeSeen(node)

  // Dữ liệu cũ chỉ lưu lịch sử: không cảnh báo, không ghi đè số sống
  if (isStale) return

  // Lỗi Alert Engine không chặn ghi telemetry. Chỉ gọi ở mẫu được lưu
  if (dwell && dwell.ongoing.length > 0 && persist) {
    void raiseThresholdAlert(String(node.zone_id), nodeId, dwell.dwelled, dwell.ongoing).catch((err: Error) =>
      logger.error('Tạo cảnh báo vượt ngưỡng thất bại', { deviceId: payload.deviceId, err }),
    )
  }

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
    controlOutput: payload.control_output,
    timestamp:   new Date(sampleTime).toISOString(),
  })
}
