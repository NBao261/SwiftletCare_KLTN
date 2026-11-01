import { Types } from 'mongoose'
import { Alert, IAlert } from '@/models/alert.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { SensorNode, CameraNode, IN_SERVICE } from '@/models/device.model'
import { emitAlertNew, emitHouseAlertNew } from '@/socket'
import { dispatchAlertNotification } from '@/services/notification.service'
import { notifyExpertDecision } from '@/services/expertActivity.service'
import { assertExpertDecision, assertFarmAccess, listAccessibleFarmIds } from '@/utils/farmAccess.util'
import { AppError, NotFoundError, ForbiddenError, ConflictError, BadRequestError } from '@/utils/appError.util'
import { logAction } from '@/services/auditLog.service'
import { paginate } from '@/utils/helpers.util'
import logger from '@/utils/logger.util'
import type { DwelledBreach } from '@/utils/breachDwell.util'
import type {
  AlertType, AlertSeverity, AlertStatus, AlertVerdictResult, CurrentUser, FarmMemberRole, Thresholds, TelemetryPayload,
} from '@/types'

/** ALERT-FR-008 — sự cố còn đang mở thì chỉ cập nhật `last_seen_at` tối đa 1 lần/khoảng này */
export const ALERT_SEEN_UPDATE_MS = 60 * 1000
/** THRESHOLD_BREACH không được ghi nhận lại trong khoảng này = chỉ số đã bình thường → tự đóng */
export const THRESHOLD_CLEAR_MS = 5 * 60 * 1000

/**
 * Cảnh báo "theo đợt" do firmware phát 1 lần khi sự cố BẮT ĐẦU và không có tín hiệu
 * hết: không được ghi nhận lại trong khoảng này thì coi đợt đó đã qua và tự đóng. Nếu
 * không đóng, dedup "còn mở thì không tạo mới" nuốt mọi lần tái phát về sau: mỗi thiết
 * bị chỉ còn đúng 1 bản ghi, Farm Owner không được báo lần nào nữa và thống kê tỷ lệ
 * xác nhận (EXPERT-FR-003) không còn là căn cứ chỉnh tham số.
 * Firmware ≥ 1.3.0 gửi LẠI cảnh báo mỗi 15 phút chừng nào sự cố còn tiếp diễn
 * (EPISODE_ALERT_RESEND_MS) nên đợt dài không bị đóng giữa chừng; mốc này phải dài hơn
 * khoảng gửi lại đó.
 * ponytail: 60 phút là mốc kỹ thuật chọn tay (dài hơn 30 phút tự thử lại của MISTING_INEFFECTIVE
 * trên firmware để thử lại vẫn khô thì gộp vào cùng 1 cảnh báo), không có nguồn nuôi yến.
 */
export const EPISODE_CLEAR_MS = 60 * 60 * 1000
export const EPISODE_ALERT_TYPES: AlertType[] = ['NOISE_ANOMALY', 'MISTING_INEFFECTIVE']

/**
 * Cảnh báo còn mở (chưa RESOLVED) — nguồn duy nhất, mọi truy vấn "alert đang mở" dùng lại hằng số này.
 * Gồm cả `DISMISSED` (SM-01): cảnh báo bị bác bỏ vẫn gộp lần gặp lại cùng sự cố (không tạo cảnh báo
 * mới, không thông báo — ALERT-FR-008) và tự đóng khi hết sự cố như cảnh báo còn hiệu lực (BR-16).
 */
export const OPEN_STATUSES: AlertStatus[] = ['ACTIVE', 'ACKNOWLEDGED', 'DISMISSED']

/**
 * ALERT-FR-001, BR-15 — mức độ mặc định theo loại sự kiện. Thiết bị có thể gửi kèm
 * severity riêng, khi đó giá trị gửi lên được ưu tiên (trừ loại không leo thang, xem createAlert).
 */
const DEFAULT_SEVERITY: Record<AlertType, AlertSeverity> = {
  RS485_BUS_FAILURE: 'CRITICAL',
  UNEXPECTED_RESTART: 'HIGH',
  SPEAKER_FAILURE:   'HIGH',
  NODE_OFFLINE:      'HIGH',
  ACTUATOR_FAULT:    'HIGH',
  // MEDIUM: tín hiệu tham khảo theo dB (THREAT-FR-007), chờ Domain Expert kiểm chứng —
  // HIGH sẽ bị alertEscalation.job gửi lại sau 15 phút nếu báo nhầm (ALERT-FR-015).
  NOISE_ANOMALY:     'MEDIUM',
  THRESHOLD_BREACH:  'MEDIUM',
  SENSOR_FAULT:      'MEDIUM',
  MISTING_INEFFECTIVE: 'MEDIUM',
  EDGE_AI_DEGRADED:  'MEDIUM',
  CONFIG_MISMATCH:   'MEDIUM',
  LOW_RETURN_RATE:   'LOW',
  // v1.24.0 — suy luận thống kê, có thể báo nhầm → không để mức được gửi lại
  SENSOR_ANOMALY:    'MEDIUM',
  FORECAST_BREACH:   'LOW',
  MAINTENANCE_DUE:   'LOW',
}

/** Mọi loại cảnh báo hợp lệ — lấy từ bảng mức mặc định nên luôn đủ theo `AlertType` */
export const ALERT_TYPES = Object.keys(DEFAULT_SEVERITY) as AlertType[]

/**
 * EXPERT-FR-003 — cảnh báo SUY LUẬN (thống kê/dB, có thể báo nhầm): Domain Expert xác
 * nhận hoặc bác bỏ. Cảnh báo đo trực tiếp (vượt ngưỡng, mất kết nối…) không cần kiểm chứng.
 */
export const INFERRED_ALERT_TYPES: AlertType[] = ['NOISE_ANOMALY', 'SENSOR_ANOMALY', 'FORECAST_BREACH', 'LOW_RETURN_RATE']

/**
 * Loại chỉ backend tự suy ra — thiết bị gửi lên thì từ chối (làm sai thống kê kiểm chứng, báo giả).
 * LOW_RETURN_RATE do job của backend tính từ số đếm (VISION-FR-011), nút AI không tự báo;
 * MAINTENANCE_DUE do relayUsage tính từ telemetry (ALERT-FR-016); CONFIG_MISMATCH do backend so
 * phiên bản cấu hình trong heartbeat (ENV-FR-027, BR-24).
 */
const BACKEND_ONLY_ALERT_TYPES: AlertType[] = [
  'NODE_OFFLINE', 'SENSOR_ANOMALY', 'FORECAST_BREACH', 'LOW_RETURN_RATE', 'MAINTENANCE_DUE', 'CONFIG_MISMATCH',
]

/**
 * "Device alert" (Report 3 §1.3) — cảnh báo về thiết bị, không về nhà yến: Technician thấy loại này
 * ở mọi farm (FARM-FR-009) và không thấy loại nào khác.
 */
export const DEVICE_ALERT_TYPES: AlertType[] = [
  'NODE_OFFLINE', 'EDGE_AI_DEGRADED', 'SENSOR_FAULT', 'RS485_BUS_FAILURE', 'UNEXPECTED_RESTART',
  'SPEAKER_FAILURE', 'MISTING_INEFFECTIVE', 'ACTUATOR_FAULT', 'CONFIG_MISMATCH', 'MAINTENANCE_DUE',
]

/** Loại nút AI đếm chim được tự báo qua `vision/alert` (THREAT-FR-010: tốc độ xử lý < 10 FPS) */
const CAMERA_ALERT_TYPES: AlertType[] = ['EDGE_AI_DEGRADED']

/** Cảnh báo không bao giờ được ở mức gửi lại (ALERT-FR-015): mọi loại suy luận + vượt ngưỡng (ALERT-FR-012) */
const NEVER_ESCALATE = new Set<AlertType>([...INFERRED_ALERT_TYPES, 'THRESHOLD_BREACH'])

/** Tên loại cảnh báo firmware cũ còn gửi → tên hiện hành (SRS 3.1.0 không giữ alias nào khác) */
const ALERT_TYPE_ALIAS: Record<string, AlertType> = {
  BIRD_PANIC:   'NOISE_ANOMALY',        // firmware < 1.3.0
  PUMP_DRY:     'MISTING_INEFFECTIVE',  // firmware ≤ 1.4.0
  POWER_OUTAGE: 'UNEXPECTED_RESTART',   // firmware ≤ 1.4.0
}

/** Giới hạn độ dài như `applyDiagnostics` (device.service) — chuỗi lạ từ thiết bị không được làm phình cảnh báo */
const MAX_RESET_REASON_LENGTH = 32

export interface CreateAlertInput {
  farmId: string
  zoneId?: string
  /** Cảnh báo của cả nhà yến (camera đếm chim) — SRS v2.1.8; không đi kèm zoneId */
  houseId?: string
  nodeId?: string
  type: AlertType
  severity?: AlertSeverity
  title: string
  message: string
  snapshotUrl?: string
  metadata?: Record<string, unknown>
  /** Chi tiết của sự cố theo ERD (Report 4 §6.1) */
  details?: Record<string, unknown>
}

/**
 * Alert Engine — điểm vào DUY NHẤT để tạo cảnh báo (ALERT-FR-001/002/003/008).
 * Mọi nguồn (MQTT từ ESP32/RPi, job phát hiện offline, kiểm tra ngưỡng telemetry)
 * đều đi qua đây để đảm bảo dedup + gửi thông báo + phát socket nhất quán.
 *
 * Trả về `null` khi bị dedup: sự cố cùng farm/zone/thiết bị/loại vẫn còn alert
 * đang mở (ACTIVE hoặc ACKNOWLEDGED, không giới hạn thời gian) — khi đó chỉ cập
 * nhật `last_seen_at` + `occurrence_count` của alert đó, không tạo bản ghi và
 * không gửi thông báo lại.
 */
export async function createAlert(input: CreateAlertInput): Promise<IAlert | null> {
  // Loại không được gửi lại (ALERT-FR-012 + cảnh báo suy luận) giữ tối đa MEDIUM dù
  // nguồn nào gửi mức cao hơn — đặt ở điểm vào duy nhất để không producer nào
  // (firmware cấu hình sai, job mới) làm cảnh báo có thể báo nhầm bị gửi lại.
  const requested = input.severity ?? DEFAULT_SEVERITY[input.type]
  const severity: AlertSeverity =
    NEVER_ESCALATE.has(input.type) && (requested === 'CRITICAL' || requested === 'HIGH') ? 'MEDIUM' : requested
  const now = new Date()

  // Farm đã xoá mềm mà thiết bị vẫn cắm điện: không sinh cảnh báo mà
  // không ai mở được. Pre-hook findOne của Farm đã loại is_deleted.
  if (!(await Farm.exists({ _id: input.farmId }))) return null

  // ponytail: tìm-rồi-tạo không nguyên tử — 2 mẫu cùng sự cố tới đồng thời có
  // thể ra 1 bản trùng; thêm unique partial index nếu thấy xảy ra thật.
  const open = await Alert.findOne({
    farm_id: input.farmId,
    zone_id: input.zoneId,
    house_id: input.houseId,
    node_id: input.nodeId,
    type: input.type,
    status: { $in: OPEN_STATUSES },
  }).select('_id created_at last_seen_at').lean()
  if (open) {
    const lastSeen = (open.last_seen_at ?? open.created_at).getTime()
    if (now.getTime() - lastSeen >= ALERT_SEEN_UPDATE_MS) {
      await Alert.updateOne({ _id: open._id }, {
        $set: { last_seen_at: now, message: input.message, metadata: input.metadata, ...(input.details && { details: input.details }) },
        $inc: { occurrence_count: 1 },
      })
    }
    logger.debug('Alert bị dedup (ALERT-FR-008)', { type: input.type, zoneId: input.zoneId })
    return null
  }

  const alert = await Alert.create({
    last_seen_at: now,
    farm_id:      input.farmId,
    zone_id:      input.zoneId,
    house_id:     input.houseId,
    node_id:      input.nodeId,
    type:         input.type,
    severity,
    title:        input.title,
    message:      input.message,
    snapshot_url: input.snapshotUrl,
    metadata:     input.metadata,
    details:      input.details,
    status:       'ACTIVE',
  })

  const wsAlert = {
    alertId:     String(alert._id),
    severity,
    type:        input.type,
    title:       input.title,
    message:     input.message,
    snapshotUrl: input.snapshotUrl,
  }
  if (input.zoneId) emitAlertNew(input.zoneId, wsAlert)
  if (input.houseId) emitHouseAlertNew(input.houseId, wsAlert)

  // Không await: gửi thông báo chậm/lỗi không được chặn luồng ghi cảnh báo
  // EXPERT-FR-007 — cảnh báo suy luận còn báo Domain Expert trong ứng dụng để kiểm chứng
  void dispatchAlertNotification(alert, { awaitsVerdict: INFERRED_ALERT_TYPES.includes(input.type) }).catch((err: Error) =>
    logger.error('Gửi thông báo cảnh báo thất bại', { alertId: String(alert._id), err }),
  )

  return alert
}

/**
 * Cảnh báo do thiết bị tự phát hiện, gọi từ mqtt/handlers/alert.handler.ts
 * (ESP32 `{base}/alert`: SENSOR_FAULT, RS485_BUS_FAILURE, SPEAKER_FAILURE,
 * MISTING_INEFFECTIVE, UNEXPECTED_RESTART, NOISE_ANOMALY, ACTUATOR_FAULT —
 * THREAT-FR-006/007/011/012/013/014; nút AI `vision/alert`: EDGE_AI_DEGRADED).
 *
 * Thiết bị được nhận diện qua `deviceId` trong payload, KHÔNG qua slug trong
 * topic (xem ghi chú ở telemetry.service) — nên cảnh báo vẫn vào đúng farm kể
 * cả khi firmware chưa trỏ đúng farmId/houseId/zoneId thật.
 */
export async function ingestDeviceAlert(message: Record<string, unknown>): Promise<IAlert | null> {
  const deviceId = message.deviceId as string | undefined
  const rawType = typeof message.type === 'string' ? message.type : undefined
  // Object.hasOwn: tra thẳng `ALERT_TYPE_ALIAS[rawType]` sẽ trả hàm của Object.prototype cho 'constructor'
  const type = rawType && (Object.hasOwn(ALERT_TYPE_ALIAS, rawType) ? ALERT_TYPE_ALIAS[rawType] : rawType)
  if (!deviceId || !type) throw NotFoundError('Payload cảnh báo thiếu deviceId hoặc type')
  if (!ALERT_TYPES.includes(type as AlertType) || BACKEND_ONLY_ALERT_TYPES.includes(type as AlertType)) {
    throw BadRequestError(`Loại cảnh báo không hợp lệ: "${type}"`)
  }

  const common = {
    type:        type as AlertType,
    severity:    message.severity as AlertSeverity | undefined, // createAlert giới hạn mức cho loại không leo thang
    message:     (message.message as string | undefined) ?? `Thiết bị ${deviceId} báo ${type}`,
    snapshotUrl: message.snapshotUrl as string | undefined,
    metadata:    { raw: message } as Record<string, unknown>,
    details:     undefined as Record<string, unknown> | undefined,
  }

  const node = await SensorNode.findOne({ device_id: deviceId, ...IN_SERVICE }).select('zone_id reset_reason').lean()
  if (node) {
    // THREAT-FR-012 — lý do khởi động lại: lấy trong cảnh báo, firmware không gửi thì lấy
    // từ heartbeat gần nhất (applyDiagnostics lưu `reset_reason` ở mỗi heartbeat)
    if (type === 'UNEXPECTED_RESTART') {
      const sent = message.resetReason ?? message.reset_reason
      const resetReason = typeof sent === 'string' && sent.length <= MAX_RESET_REASON_LENGTH ? sent : node.reset_reason
      if (resetReason) {
        common.metadata = { ...common.metadata, reset_reason: resetReason }
        common.details = { reset_reason: resetReason }
      }
    }
    // `name` cho tiêu đề mặc định — firmware không gửi kèm title
    const zone = await Zone.findById(node.zone_id).select('farm_id name').lean()
    if (!zone) throw NotFoundError(`Thiết bị "${deviceId}" chưa gắn Zone hợp lệ`)
    return createAlert({
      ...common, farmId: String(zone.farm_id), zoneId: String(zone._id), nodeId: String(node._id),
      title: (message.title as string | undefined) ?? `${type} tại ${zone.name}`,
    })
  }

  // Nút AI (`vision/alert`) dùng chung handler; nó chỉ được báo các loại của mình, và gắn House (SRS v2.1.8)
  const camera = CAMERA_ALERT_TYPES.includes(type as AlertType)
    ? await CameraNode.findOne({ device_id: deviceId, ...IN_SERVICE }).select('house_id').lean()
    : null
  if (!camera) throw NotFoundError(`Không tìm thấy thiết bị với device_id="${deviceId}" cho loại "${type}"`)
  const house = await House.findById(camera.house_id).select('farm_id name').lean()
  if (!house) throw NotFoundError(`Camera "${deviceId}" chưa gắn House hợp lệ`)
  return createAlert({
    ...common, farmId: String(house.farm_id), houseId: String(house._id), nodeId: String(camera._id),
    title: (message.title as string | undefined) ?? `${type} tại ${house.name}`,
  })
}

/**
 * ENV-FR-004 — so sánh telemetry với ngưỡng của Zone, trả về danh sách chỉ số
 * vượt ngưỡng. Dùng cho cả việc gắn cờ `is_anomaly` lẫn sinh cảnh báo
 * THRESHOLD_BREACH, nên tách riêng để 2 nơi dùng chung 1 định nghĩa "bất thường".
 */
export interface ThresholdBreach { metric: string; value: number; limit: number; direction: 'above' | 'below' }

export function findThresholdBreaches(
  payload: Pick<TelemetryPayload, 'temperature' | 'humidity' | 'light_lux' | 'nh3_ppm' | 'co2_ppm'>,
  t: Thresholds,
): ThresholdBreach[] {
  const breaches: ThresholdBreach[] = []
  const check = (metric: string, value: number | undefined, min: number | undefined, max: number | undefined) => {
    if (value === undefined || !Number.isFinite(value)) return // cảm biến lỗi/chưa đấu dây — SENSOR_FAULT lo, không phải THRESHOLD_BREACH
    if (min !== undefined && value < min) breaches.push({ metric, value, limit: min, direction: 'below' })
    if (max !== undefined && value > max) breaches.push({ metric, value, limit: max, direction: 'above' })
  }

  check('temperature', payload.temperature, t.temp_min, t.temp_max)
  check('humidity',    payload.humidity,    t.humidity_min, t.humidity_max)
  check('light_lux',   payload.light_lux,   undefined, t.light_max)
  check('nh3_ppm',     payload.nh3_ppm,     undefined, t.nh3_max)
  check('co2_ppm',     payload.co2_ppm,     undefined, t.co2_max)
  return breaches
}

/**
 * ALERT-FR-012 (SRS v2.0.0) — NH3/CO2 chỉ theo dõi và cảnh báo: chưa có giới hạn nào
 * được xác lập cho nhà yến, ngưỡng của Zone là ngưỡng cảnh báo (mặc định hệ thống cho
 * tới khi Domain Expert chỉnh), và hệ thống không điều khiển quạt theo hai chỉ số này.
 */
const AIR_QUALITY_METRICS = new Set(['nh3_ppm', 'co2_ppm'])
// Không ghi "do chuyên gia đặt": ngưỡng mặc định chưa ai chỉnh thì câu đó sai sự thật
const AIR_QUALITY_NOTE = 'NH3/CO2 chỉ theo dõi và cảnh báo theo ngưỡng của Zone (chưa có giới hạn chuẩn cho nhà yến) — hệ thống không tự chạy quạt theo chỉ số này'

const METRIC_LABEL: Record<string, string> = {
  temperature: 'Nhiệt độ',
  humidity:    'Độ ẩm',
  light_lux:   'Ánh sáng',
  nh3_ppm:     'NH3',
  co2_ppm:     'CO2',
}

/**
 * ENV-FR-004, ALERT-FR-012, BR-34 — gọi từ telemetry.service ở mẫu sống được lưu, sau khi
 * trackBreachDwell (utils/breachDwell.util) tính quãng vượt ngưỡng của thiết bị:
 * - có chỉ số đã ở ngoài ngưỡng đủ thời gian chờ (`dwelled`) → tạo THRESHOLD_BREACH (hoặc gộp vào cảnh
 *   báo đang mở); `details` là chỉ số bắt đầu sớm nhất, `metadata.breaches` là mọi chỉ số đang vượt;
 * - chỉ có chỉ số đang vượt chưa đủ thời gian chờ → không tạo mới, chỉ giữ cảnh báo đang mở còn sống
 *   để nó chỉ tự đóng sau THRESHOLD_CLEAR_MS thật sự về trong ngưỡng (BR-16).
 */
export async function raiseThresholdAlert(
  zoneId: string, nodeId: string, dwelled: DwelledBreach[], ongoing: ThresholdBreach[] = dwelled,
): Promise<void> {
  if (dwelled.length === 0) {
    if (ongoing.length > 0) await keepThresholdAlertAlive(zoneId, nodeId)
    return
  }

  const zone = await Zone.findById(zoneId).lean()
  if (!zone) return

  const detail = dwelled
    .map(b => `${METRIC_LABEL[b.metric] ?? b.metric} ${b.value} (${b.direction === 'above' ? 'vượt' : 'dưới'} ngưỡng ${b.limit})`)
    .join(', ')
  const airQuality = dwelled.some(b => AIR_QUALITY_METRICS.has(b.metric))
  const first = dwelled.reduce((a, b) => (b.started_at < a.started_at ? b : a))

  await createAlert({
    farmId:   String(zone.farm_id),
    zoneId,
    nodeId,
    type:     'THRESHOLD_BREACH',
    title:    `Vượt ngưỡng tại ${zone.name}`,
    message:  airQuality ? `${detail}. ${AIR_QUALITY_NOTE}` : detail,
    metadata: { breaches: ongoing },
    details:  { metric: first.metric, observed: first.value, threshold: first.limit, direction: first.direction, started_at: first.started_at },
  })
}

/** BR-16 — chỉ số còn ngoài ngưỡng: cảnh báo đang mở chưa được đóng; cập nhật lần thấy cuối tối đa 1 lần/ALERT_SEEN_UPDATE_MS */
async function keepThresholdAlertAlive(zoneId: string, nodeId: string): Promise<void> {
  const now = new Date()
  await Alert.updateOne(
    {
      zone_id: zoneId, node_id: nodeId, type: 'THRESHOLD_BREACH', status: { $in: OPEN_STATUSES },
      $or: [{ last_seen_at: { $lt: new Date(now.getTime() - ALERT_SEEN_UPDATE_MS) } }, { last_seen_at: { $exists: false } }],
    },
    { $set: { last_seen_at: now } },
  )
}

// ── Truy vấn phía Farm Owner (ALERT-FR-007/009) ─────────────────────────────

export interface ListAlertsQuery {
  farmId?: string
  zoneId?: string
  /** Cảnh báo của cả nhà yến (camera đếm chim) — SRS v2.1.8 */
  houseId?: string
  status?: string
  severity?: string
  type?: string
  /** EXPERT-FR-003 — pending = cảnh báo suy luận chưa được kiểm chứng */
  verdict?: 'pending' | 'confirmed' | 'rejected'
  page?: number
  limit?: number
}

/**
 * ALERT-FR-007 — Farm Owner, Domain Expert chỉ thấy cảnh báo của farm mình; Technician thấy
 * cảnh báo thiết bị của mọi farm (FARM-FR-009); Admin không thấy farm nào (Report 3 §2.4).
 */
export async function listAlerts(user: CurrentUser, query: ListAlertsQuery) {
  const accessibleFarms = await listAccessibleFarmIds(user, 'device')
  const filter: Record<string, unknown> = { farm_id: { $in: accessibleFarms } }
  // $and để giữ nguyên bộ lọc `type` của người gọi: giao với loại thiết bị
  if (user.role === 'TECHNICIAN') filter.$and = [{ type: { $in: DEVICE_ALERT_TYPES } }]

  if (query.farmId) {
    if (!accessibleFarms.some(id => String(id) === query.farmId)) throw ForbiddenError('Không có quyền trên farm này')
    filter.farm_id = query.farmId
  }
  if (query.zoneId) filter.zone_id = query.zoneId
  if (query.houseId) filter.house_id = query.houseId
  if (query.status) filter.status = query.status
  if (query.severity) filter.severity = query.severity
  if (query.type) filter.type = query.type
  if (query.verdict) {
    // Lọc theo kiểm chứng chỉ có nghĩa với cảnh báo suy luận: loại khác mà hiện trong hàng
    // chờ thì PUT /alerts/:id/verdict sẽ từ chối (400) — hàng chờ và hành động phải khớp nhau
    if (query.type && !INFERRED_ALERT_TYPES.includes(query.type as AlertType)) {
      throw BadRequestError(`Chỉ lọc theo kiểm chứng cho cảnh báo suy luận (${INFERRED_ALERT_TYPES.join(', ')})`)
    }
    if (!query.type) filter.type = { $in: INFERRED_ALERT_TYPES }
    if (query.verdict === 'pending') filter.expert_verdict = { $exists: false }
    else filter['expert_verdict.result'] = query.verdict.toUpperCase()
  }

  const { page, skip, limit } = paginate(query.page, query.limit)

  const [records, total, unreadCount] = await Promise.all([
    // ALERT-FR-007 — cảnh báo DISMISSED hiện ai bác bỏ: kèm tên người kết luận
    Alert.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).populate('expert_verdict.by', 'full_name').lean(),
    Alert.countDocuments(filter),
    Alert.countDocuments({ ...filter, status: 'ACTIVE' }),
  ])

  return { records, total, page, limit, unreadCount }
}

/** Cảnh báo + farm của nó, đã kiểm quyền cùng phạm vi với danh sách (Technician chỉ cảnh báo thiết bị) */
async function findAlertWithAccess(alertId: string, user: CurrentUser) {
  const alert = await Alert.findById(alertId)
  if (!alert) throw NotFoundError('Không tìm thấy cảnh báo')
  const farm = await assertFarmAccess(String(alert.farm_id), user, DEVICE_ALERT_TYPES.includes(alert.type) ? 'device' : 'farm')
  return { alert, farm }
}

export async function getAlert(alertId: string, user: CurrentUser): Promise<IAlert> {
  const { alert } = await findAlertWithAccess(alertId, user)
  return alert.populate('expert_verdict.by', 'full_name')
}

/**
 * ALERT-FR-009 — Farm Owner xác nhận đã xử lý kèm ghi chú. Ghi chú "Báo động giả"
 * được giữ lại làm dữ liệu đánh giá chất lượng model AI sau này (Flow 4 case 9a).
 */
export async function acknowledgeAlert(alertId: string, user: CurrentUser, note?: string): Promise<IAlert> {
  const { alert } = await findAlertWithAccess(alertId, user)
  if (alert.status === 'DISMISSED') throw ConflictError('Cảnh báo này đã bị bác bỏ, không còn hiệu lực')
  if (alert.status !== 'ACTIVE') throw ConflictError('Cảnh báo này đã được xác nhận trước đó')

  alert.status = 'ACKNOWLEDGED'
  alert.acknowledged_at = new Date()
  alert.acknowledged_by = user._id as never
  alert.acknowledgement_note = note
  if (alert.type === 'MAINTENANCE_DUE') {
    // BR-16 — xác nhận = đã bảo trì: đếm lại từ 0 cho tải đó và đóng cảnh báo
    alert.status = 'RESOLVED'
    alert.resolved_at = alert.acknowledged_at
    const loads = ((alert.metadata?.loads as Array<{ relay: string }> | undefined) ?? [])
      .filter(l => l.relay === 'misting' || l.relay === 'ventilation')
    if (alert.node_id && loads.length > 0) {
      await SensorNode.updateOne({ _id: alert.node_id }, {
        $set: Object.fromEntries(loads.flatMap(l => [
          [`relay_usage.${l.relay}.since_service_hours`, 0], [`relay_usage.${l.relay}.since_service_switches`, 0],
        ])),
      })
    }
  }
  await alert.save()
  return alert
}

/**
 * EXPERT-FR-003 — Domain Expert (Farm Owner khi farm chưa có chuyên gia, BR-22) ghi kết quả kiểm
 * chứng 1 cảnh báo suy luận. Ghi lại được (đổi ý sau khi xem thêm dữ liệu). Tác động lên trạng
 * thái theo SM-01:
 * - `REJECTED` khi còn hiệu lực (ACTIVE/ACKNOWLEDGED) → DISMISSED, nhớ `previous_status`;
 * - đổi sang `CONFIRMED` khi DISMISSED → về `previous_status` và báo lại Farm Owner;
 * - còn lại (CONFIRMED trên cảnh báo còn hiệu lực, mọi kết luận trên RESOLVED) giữ nguyên.
 * Xác nhận đã xử lý vẫn là việc của Farm Owner (ALERT-FR-009).
 */
export async function setAlertVerdict(
  alertId: string, user: CurrentUser, result: AlertVerdictResult, note?: string,
): Promise<IAlert> {
  const { alert, farm } = await findAlertWithAccess(alertId, user)
  if (!INFERRED_ALERT_TYPES.includes(alert.type)) {
    throw BadRequestError(`Chỉ kiểm chứng cảnh báo suy luận (${INFERRED_ALERT_TYPES.join(', ')})`)
  }
  await assertExpertDecision(farm, user)
  const trimmedNote = note?.trim() || undefined
  // Route đã chặn; giữ ở service cho mọi đường gọi khác
  if (result === 'REJECTED' && !trimmedNote) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Bác bỏ cảnh báo phải ghi lý do')
  }

  const statusBefore = alert.status
  if (result === 'REJECTED' && (alert.status === 'ACTIVE' || alert.status === 'ACKNOWLEDGED')) {
    alert.previous_status = alert.status
    alert.status = 'DISMISSED'
  } else if (result === 'CONFIRMED' && alert.status === 'DISMISSED') {
    alert.status = alert.previous_status ?? 'ACTIVE'
    alert.previous_status = undefined
  }
  alert.expert_verdict = { result, note: trimmedNote, by: user._id as never, role: user.role as FarmMemberRole, at: new Date() }
  await alert.save()

  const auditId = await logAction(user._id, 'ALERT_VERDICT_SET', 'alert', String(alert._id), {
    type: alert.type, result, note: trimmedNote, status_before: statusBefore, status_after: alert.status,
    zone_id: alert.zone_id ? String(alert.zone_id) : undefined, house_id: alert.house_id ? String(alert.house_id) : undefined,
  }, { farmId: String(farm._id) })
  await notifyExpertDecision(user, farm._id, auditId, {
    what: result === 'CONFIRMED' ? 'xác nhận một cảnh báo' : 'bác bỏ một cảnh báo',
    place: alert.title,
    detail: trimmedNote,
  })
  // SM-01 — cảnh báo bị bác bỏ nhầm được xác nhận lại: Farm Owner phải được báo lại như cảnh báo mới
  if (statusBefore === 'DISMISSED' && alert.status !== 'DISMISSED') {
    void dispatchAlertNotification(alert).catch((err: Error) =>
      logger.error('Báo lại cảnh báo được xác nhận lại thất bại', { alertId: String(alert._id), err }),
    )
  }
  return alert.populate('expert_verdict.by', 'full_name')
}

/**
 * EXPERT-FR-003 — số cảnh báo suy luận được xác nhận / bác bỏ / còn chờ theo từng loại,
 * làm căn cứ chỉnh tham số phát hiện (EXPERT-FR-008). `confirmedPct` tính trên số đã
 * kiểm chứng; null khi chưa kiểm chứng cái nào. `byRole` tách theo vai trò người kết luận (Farm
 * Owner kết luận khi farm chưa có chuyên gia, BR-22); kết luận trước G-03 không lưu vai trò và chỉ
 * Domain Expert ghi được, nên tính cho DOMAIN_EXPERT.
 */
export async function getVerdictStats(user: CurrentUser, query: { farmId?: string; zoneId?: string }) {
  const accessibleFarms = await listAccessibleFarmIds(user)
  if (query.farmId && !accessibleFarms.some(id => String(id) === query.farmId)) throw ForbiddenError('Không có quyền trên farm này')
  const farmIds = query.farmId ? accessibleFarms.filter(id => String(id) === query.farmId) : accessibleFarms

  type Row = { _id: { type: AlertType; result: AlertVerdictResult | null; role: FarmMemberRole | null }; count: number }
  const rows = await Alert.aggregate<Row>([
    { $match: { farm_id: { $in: farmIds }, type: { $in: INFERRED_ALERT_TYPES }, ...(query.zoneId && { zone_id: new Types.ObjectId(query.zoneId) }) } },
    {
      $group: {
        _id: {
          type: '$type',
          result: { $ifNull: ['$expert_verdict.result', null] },
          role: { $cond: [{ $ifNull: ['$expert_verdict.result', false] }, { $ifNull: ['$expert_verdict.role', 'DOMAIN_EXPERT'] }, null] },
        },
        count: { $sum: 1 },
      },
    },
  ])

  return INFERRED_ALERT_TYPES.map(type => {
    const of = (result: AlertVerdictResult | null, role?: FarmMemberRole) => rows
      .filter(r => r._id.type === type && r._id.result === result && (role === undefined || r._id.role === role))
      .reduce((sum, r) => sum + r.count, 0)
    const confirmed = of('CONFIRMED')
    const rejected = of('REJECTED')
    const reviewed = confirmed + rejected
    const byRole = Object.fromEntries((['DOMAIN_EXPERT', 'FARM_OWNER'] as const).map(role =>
      [role, { confirmed: of('CONFIRMED', role), rejected: of('REJECTED', role) }]))
    return {
      type, confirmed, rejected, pending: of(null),
      confirmedPct: reviewed ? Math.round((100 * confirmed) / reviewed) : null, byRole,
    }
  })
}

/**
 * FARM-FR-008 — gỡ thiết bị thì cảnh báo của nó phải đóng theo. Cảnh báo còn
 * `ACTIVE` của thiết bị đã tháo về kho vẫn bị `alertEscalation.job` gửi lại cho
 * Farm Owner sau 15 phút, về một thiết bị không còn ở nhà yến.
 * Trả về số cảnh báo đã đóng.
 */
export async function resolveAlertsForNode(nodeId: string, reason: string, type?: AlertType): Promise<number> {
  const open = await Alert.find({ node_id: nodeId, status: { $in: OPEN_STATUSES }, ...(type && { type }) }).select('_id').lean()
  if (open.length === 0) return 0

  await Alert.updateMany(
    { _id: { $in: open.map(a => a._id) } },
    { status: 'RESOLVED', resolved_at: new Date(), acknowledgement_note: reason },
  )
  return open.length
}

/**
 * Cảnh báo tính cho cả nhà yến (không gắn thiết bị, VD `LOW_RETURN_RATE`) đã hết nguyên nhân thì
 * đóng theo House. Trả về số cảnh báo đã đóng.
 */
export async function resolveHouseAlerts(houseId: string, type: AlertType, reason: string): Promise<number> {
  const { modifiedCount } = await Alert.updateMany(
    { house_id: houseId, type, status: { $in: OPEN_STATUSES } },
    { status: 'RESOLVED', resolved_at: new Date(), acknowledgement_note: reason },
  )
  return modifiedCount
}

/**
 * ALERT-FR-008 — THRESHOLD_BREACH không còn được ghi nhận lại trong
 * THRESHOLD_CLEAR_MS (chỉ số đã về bình thường, hoặc thiết bị ngừng gửi — khi
 * đó đã có NODE_OFFLINE riêng) thì tự đóng. Gọi định kỳ từ jobs/alertEscalation.job.ts.
 */
export async function resolveStaleThresholdAlerts(now = new Date()): Promise<number> {
  const clearBefore = new Date(now.getTime() - THRESHOLD_CLEAR_MS)
  const { modifiedCount } = await Alert.updateMany(
    {
      type: 'THRESHOLD_BREACH',
      status: { $in: OPEN_STATUSES },
      $or: [
        { last_seen_at: { $lt: clearBefore } },
        { last_seen_at: { $exists: false }, created_at: { $lt: clearBefore } },
      ],
    },
    { status: 'RESOLVED', resolved_at: now, acknowledgement_note: 'Chỉ số đã trở lại bình thường' },
  )
  return modifiedCount
}

/**
 * Tự đóng cảnh báo theo đợt (EPISODE_ALERT_TYPES) không còn được ghi nhận lại trong
 * EPISODE_CLEAR_MS — lần tái phát sau đó là 1 cảnh báo mới, được thông báo và kiểm
 * chứng riêng. Gọi định kỳ từ jobs/alertEscalation.job.ts.
 */
export async function resolveStaleEpisodeAlerts(now = new Date()): Promise<number> {
  const clearBefore = new Date(now.getTime() - EPISODE_CLEAR_MS)
  const { modifiedCount } = await Alert.updateMany(
    {
      type: { $in: EPISODE_ALERT_TYPES },
      status: { $in: OPEN_STATUSES },
      $or: [
        { last_seen_at: { $lt: clearBefore } },
        { last_seen_at: { $exists: false }, created_at: { $lt: clearBefore } },
      ],
    },
    // Pipeline update: giữ ghi chú xác nhận của Farm Owner nếu đã có (ALERT-FR-009)
    [{
      $set: {
        status: 'RESOLVED',
        resolved_at: now,
        acknowledgement_note: { $ifNull: ['$acknowledgement_note', 'Không còn ghi nhận lại — đợt sự cố đã qua'] },
      },
    }],
  )
  return modifiedCount
}

/**
 * ALERT-FR-015 — cảnh báo chưa ai xác nhận được gửi lại ĐÚNG 1 lần cho Farm Owner theo
 * kênh họ chọn (giờ im lặng áp như lần đầu): CRITICAL/HIGH sau 15 phút, NODE_OFFLINE sau
 * 1 giờ, giữ nguyên mốc thời gian (Report 3 §4.5).
 * Bỏ qua thiết bị đã gỡ và NODE_OFFLINE của thiết bị đã ONLINE lại (cảnh báo chỉ chưa kịp
 * đóng). Gọi định kỳ từ jobs/alertEscalation.job.ts.
 */
export const RENOTIFY_AFTER_MS = 15 * 60 * 1000
export const NODE_OFFLINE_RENOTIFY_AFTER_MS = 60 * 60 * 1000

export async function renotifyStaleAlerts(now = new Date()): Promise<number> {
  const stale = await Alert.find({
    status: 'ACTIVE',
    renotified_at: { $exists: false },
    $or: [
      { type: { $ne: 'NODE_OFFLINE' }, severity: { $in: ['CRITICAL', 'HIGH'] }, created_at: { $lte: new Date(now.getTime() - RENOTIFY_AFTER_MS) } },
      { type: 'NODE_OFFLINE', created_at: { $lte: new Date(now.getTime() - NODE_OFFLINE_RENOTIFY_AFTER_MS) } },
    ],
  })
  if (stale.length === 0) return 0

  const nodeIds = [...new Set(stale.map(a => a.node_id).filter(Boolean))]
  const nodes = await SensorNode.find({ _id: { $in: nodeIds } }).select('_id status decommissioned_at').lean()
  const skipNodeIds = new Set(nodes.filter(n => n.decommissioned_at).map(n => String(n._id)))
  const onlineNodeIds = new Set(nodes.filter(n => n.status === 'ONLINE').map(n => String(n._id)))

  let sent = 0
  for (const alert of stale) {
    const nodeId = alert.node_id ? String(alert.node_id) : undefined
    if (nodeId && skipNodeIds.has(nodeId)) continue
    if (alert.type === 'NODE_OFFLINE' && nodeId && onlineNodeIds.has(nodeId)) continue
    // Giữ chỗ trước rồi mới gửi: 2 lượt job chồng nhau cũng chỉ 1 lượt gửi được
    const { modifiedCount } = await Alert.updateOne(
      { _id: alert._id, status: 'ACTIVE', renotified_at: { $exists: false } }, { renotified_at: now },
    )
    if (modifiedCount === 0) continue
    try {
      await dispatchAlertNotification(alert, { repeat: true })
      sent++
    } catch (err) {
      // 1 cảnh báo lỗi không chặn các cảnh báo khác; không gửi lại lần nữa (ALERT-FR-015: tối đa 2 lần)
      logger.error('Gửi lại cảnh báo chưa xác nhận thất bại', { alertId: String(alert._id), err })
    }
  }
  return sent
}

/**
 * Lưới an toàn cho NODE_OFFLINE: job offline và heartbeat chạy song song, nên thiết bị
 * có thể online lại (announceBackOnline không thấy gì để đóng) ngay trước khi
 * raiseNodeOfflineAlert kịp tạo cảnh báo. Đóng mọi NODE_OFFLINE còn mở mà thiết bị đã
 * ONLINE — không phụ thuộc thứ tự sự kiện. Gọi định kỳ từ jobs/alertEscalation.job.ts.
 */
export async function resolveNodeOfflineAlertsOfOnlineNodes(): Promise<number> {
  const open = await Alert.find({ type: 'NODE_OFFLINE', status: { $in: OPEN_STATUSES } }).select('node_id').lean()
  if (open.length === 0) return 0
  const online = await SensorNode.find({ _id: { $in: open.map(a => a.node_id) }, status: 'ONLINE' }).select('_id').lean()
  if (online.length === 0) return 0
  const { modifiedCount } = await Alert.updateMany(
    { type: 'NODE_OFFLINE', status: { $in: OPEN_STATUSES }, node_id: { $in: online.map(n => n._id) } },
    { status: 'RESOLVED', resolved_at: new Date(), acknowledgement_note: 'Thiết bị đã kết nối lại' },
  )
  return modifiedCount
}

/** THREAT-FR-010 — nút AI đếm chim mất heartbeat (deviceOffline.job) */
export async function raiseCameraOfflineAlert(cameraId: string): Promise<void> {
  const camera = await CameraNode.findById(cameraId).lean()
  if (!camera || camera.status !== 'OFFLINE') return
  const house = await House.findById(camera.house_id).lean()
  if (!house) return

  // Nút AI tự báo EDGE_AI_DEGRADED (FPS thấp) dùng chung khoá dedup với cảnh báo này: đóng cái đó
  // trước, nếu không "mất kết nối" bị gộp vào cảnh báo FPS cũ và không ai được báo. Kết nối lại mà
  // FPS vẫn thấp thì nút AI tự báo lại.
  await resolveAlertsForNode(cameraId, 'Nút AI mất kết nối — chuyển sang cảnh báo mất kết nối', 'EDGE_AI_DEGRADED')
  await createAlert({
    farmId:  String(house.farm_id),
    houseId: String(house._id),
    nodeId:  String(camera._id),
    type:    'EDGE_AI_DEGRADED',
    title:   `Nút AI đếm chim ${camera.device_id} mất kết nối`,
    message: `Không nhận được heartbeat từ nút AI ${camera.device_id} tại ${house.name}; số đếm chim đang gián đoạn.`,
  })
}

/** Dùng cho job phát hiện thiết bị offline (FARM-FR-005 → THREAT-FR-009) */
export async function raiseNodeOfflineAlert(nodeId: string): Promise<void> {
  const node = await SensorNode.findById(nodeId).lean()
  // Heartbeat có thể đã tới giữa lúc job đổi OFFLINE và lúc tạo cảnh báo
  if (!node || node.status !== 'OFFLINE') return
  const zone = await Zone.findById(node.zone_id).lean()
  if (!zone) return

  await createAlert({
    farmId:  String(zone.farm_id),
    zoneId:  String(zone._id),
    nodeId:  String(node._id),
    type:    'NODE_OFFLINE',
    title:   `Thiết bị ${node.device_id} mất kết nối`,
    message: `Không nhận được heartbeat từ ${node.device_id} tại ${zone.name} quá thời gian cho phép.`,
  })
}
