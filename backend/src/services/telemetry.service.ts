import { Telemetry, ITelemetry } from '@/models/telemetry.model'
import { SensorNode, IN_SERVICE } from '@/models/device.model'
import { Zone } from '@/models/houseZone.model'
import { emitTelemetryUpdate } from '@/socket'
import { findThresholdBreaches, raiseThresholdAlert } from '@/services/alert.service'
import { markNodeSeen } from '@/services/device.service'
import { assertZoneAccess } from '@/utils/farmAccess.util'
import { NotFoundError } from '@/utils/appError.util'
import { paginate } from '@/utils/helpers.util'
import logger from '@/utils/logger.util'
import type { TelemetryPayload, CurrentUser } from '@/types'

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** GET /telemetry/zones/:id/latest – ENV-FR-004 */
export async function getLatest(zoneId: string, user: CurrentUser): Promise<ITelemetry> {
  await assertZoneAccess(zoneId, user)
  const latest = await Telemetry.findOne({ zone_id: zoneId }).sort({ timestamp: -1 }).lean()
  if (!latest) throw NotFoundError('Chưa có dữ liệu cho zone này')
  return latest as unknown as ITelemetry
}

export interface HistoryQuery { from?: string; to?: string; page?: number; limit?: number }
export interface HistoryResult { records: ITelemetry[]; total: number; page: number; limit: number }

/** GET /telemetry/zones/:id/history – ANALYTICS-FR-001 */
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

/**
 * ingestTelemetry – ENV-FR-001, ENV-FR-004, ENV-FR-005 (gọi từ mqtt/handlers/telemetry.handler.ts)
 *
 * `deviceId` trong payload (không phải farmId/houseId/zoneId trong topic MQTT
 * — đó chỉ là slug định danh, không phải ObjectId Mongo) dùng để tra
 * SensorNode.zone_id thật đã gán lúc onboarding (FARM-FR-003).
 */
/** Firmware gửi telemetry mỗi ~1s cho dashboard; DB chỉ cần 1 mẫu/khoảng này (trừ lúc chuyển bình thường ↔ vượt ngưỡng) */
export const TELEMETRY_PERSIST_INTERVAL_MS = 10_000
/** Mẫu cũ hơn mức này là dữ liệu buffer offline (REL-NFR-003) được flush lại, không phải số liệu sống */
export const STALE_TELEMETRY_MS = 60_000
const MAX_BACKDATE_MS = 7 * 24 * 60 * 60 * 1000
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000

// ponytail: in-memory theo từng process — chạy nhiều instance backend thì mỗi
// instance tự throttle riêng (ghi dày hơn), chuyển sang Redis nếu scale ngang.
const lastPersisted = new Map<string, { at: number; anomaly: boolean }>()

/** Thời điểm đo do firmware gửi (epoch ms, cần NTP) — thiếu/vô lý (đồng hồ chưa sync) thì lấy giờ nhận */
function resolveSampleTime(ts: unknown, now: number): number {
  return isFiniteNumber(ts) && ts >= now - MAX_BACKDATE_MS && ts <= now + MAX_CLOCK_SKEW_MS ? ts : now
}

export async function ingestTelemetry(payload: TelemetryPayload): Promise<void> {
  if (!payload.deviceId) throw NotFoundError('Thiếu deviceId trong payload telemetry')

  const node = await SensorNode.findOne({ device_id: payload.deviceId, ...IN_SERVICE })
  if (!node) throw NotFoundError(`Không tìm thấy SensorNode với device_id="${payload.deviceId}"`)

  const now = Date.now()
  const sampleTime = resolveSampleTime(payload.timestamp, now)
  const isStale = now - sampleTime > STALE_TELEMETRY_MS
  const nodeId = String(node._id)

  // ENV-FR-004 — đối chiếu ngưỡng của Zone để gắn cờ bất thường + sinh cảnh báo.
  // Zone bị xoá giữa chừng thì vẫn lưu telemetry (không mất dữ liệu), chỉ bỏ
  // qua phần đánh giá ngưỡng.
  const zone = await Zone.findById(node.zone_id).lean()
  const breaches = zone ? findThresholdBreaches(payload, zone.thresholds) : []

  // Mẫu buffer offline luôn được ghi (mỗi dòng đã cách nhau ~10s ở firmware) và
  // không tham gia throttle của luồng sống. Mẫu sống: tối đa 1 mẫu/TELEMETRY_PERSIST_INTERVAL_MS
  // kể cả khi vượt ngưỡng kéo dài (trước đây ghi mọi mẫu → 1 bản ghi/giây); chỉ
  // lúc BẮT ĐẦU vượt ngưỡng mới ghi ngay. Lúc hết vượt ngưỡng chờ mốc 10s kế
  // tiếp — nếu cả 2 chiều đều ghi ngay, chỉ số dao động quanh ngưỡng mỗi giây
  // sẽ lại ghi mọi mẫu; như vậy dao động chỉ tốn tối đa ~2 bản ghi/10s.
  const anomaly = breaches.length > 0
  const last = lastPersisted.get(nodeId)
  const persist = isStale || !last || (anomaly && !last.anomaly) || sampleTime - last.at >= TELEMETRY_PERSIST_INTERVAL_MS
  if (persist) {
    await Telemetry.create({
      node_id: node._id,
      zone_id: node.zone_id,
      timestamp: new Date(sampleTime),
      temperature: isFiniteNumber(payload.temperature) ? payload.temperature : undefined,
      humidity:    isFiniteNumber(payload.humidity)    ? payload.humidity    : undefined,
      light_lux:   isFiniteNumber(payload.light_lux)   ? payload.light_lux   : undefined,
      nh3_ppm:     isFiniteNumber(payload.nh3_ppm)     ? payload.nh3_ppm     : undefined,
      co2_ppm:     isFiniteNumber(payload.co2_ppm)     ? payload.co2_ppm     : undefined,
      sound_db:    isFiniteNumber(payload.sound_db)    ? payload.sound_db    : undefined,
      is_anomaly: anomaly,
    })
    if (!isStale) lastPersisted.set(nodeId, { at: sampleTime, anomaly })
  }

  // Thiết bị đang gửi dữ liệu = đang sống. Chỉ ghi khi cần (≤ 1 lần/10s, dư so
  // với ngưỡng offline 30s) thay vì save() mỗi giây.
  if (persist || node.status !== 'ONLINE') await markNodeSeen(node)

  // Dữ liệu cũ flush lại: chỉ lưu lịch sử — không bắn cảnh báo cho tình trạng
  // đã qua, không ghi đè số liệu sống trên dashboard.
  if (isStale) return

  // Không chặn luồng ghi telemetry nếu Alert Engine lỗi — dữ liệu cảm biến vẫn
  // quan trọng hơn việc gửi được cảnh báo. Chỉ gọi ở mẫu được lưu (lúc bắt đầu
  // vượt ngưỡng + mỗi 10s): mỗi lần gọi tốn ~3 lượt đọc DB, gọi mỗi giây là thừa
  // khi last_seen_at chỉ cập nhật 1 lần/phút và tự đóng sau 5 phút (ALERT-FR-008).
  if (anomaly && persist) {
    void raiseThresholdAlert(String(node.zone_id), nodeId, breaches).catch((err: Error) =>
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
    timestamp:   new Date(sampleTime).toISOString(),
  })
}
