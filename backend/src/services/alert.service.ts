import { Types } from 'mongoose'
import { Alert, IAlert } from '@/models/alert.model'
import { Farm } from '@/models/farm.model'
import { Zone } from '@/models/houseZone.model'
import { SensorNode, IN_SERVICE } from '@/models/device.model'
import { emitAlertNew } from '@/socket'
import { dispatchAlertNotification } from '@/services/notification.service'
import { assertRecordAccess, listAccessibleFarmIds } from '@/utils/farmAccess.util'
import { NotFoundError, ForbiddenError, ConflictError, BadRequestError } from '@/utils/appError.util'
import { logAction } from '@/services/auditLog.service'
import { paginate } from '@/utils/helpers.util'
import logger from '@/utils/logger.util'
import type { AlertType, AlertSeverity, AlertVerdictResult, CurrentUser, Thresholds, TelemetryPayload } from '@/types'

/** ALERT-FR-008 — sự cố còn đang mở thì chỉ cập nhật `last_seen_at` tối đa 1 lần/khoảng này */
export const ALERT_SEEN_UPDATE_MS = 60 * 1000
/** THRESHOLD_BREACH không được ghi nhận lại trong khoảng này = chỉ số đã bình thường → tự đóng */
export const THRESHOLD_CLEAR_MS = 5 * 60 * 1000

/** Cảnh báo còn mở (chưa RESOLVED) — nguồn duy nhất, mọi truy vấn "alert đang mở" dùng lại hằng số này */
export const OPEN_STATUSES = ['ACTIVE', 'ACKNOWLEDGED']

/**
 * ALERT-FR-001 — mức độ mặc định theo loại sự kiện. Firmware/RPi có thể gửi kèm
 * severity riêng (VD PREDATOR_DETECTED: snake/owl=CRITICAL nhưng rat=HIGH theo
 * THREAT-FR-004), khi đó giá trị gửi lên được ưu tiên.
 */
const DEFAULT_SEVERITY: Record<AlertType, AlertSeverity> = {
  RS485_BUS_FAILURE: 'CRITICAL',
  PREDATOR_DETECTED: 'CRITICAL',
  POWER_OUTAGE:      'HIGH',
  SPEAKER_FAILURE:   'HIGH',
  NODE_OFFLINE:      'HIGH',
  // MEDIUM: tín hiệu tham khảo theo dB (THREAT-FR-007), chờ Domain Expert kiểm chứng —
  // HIGH sẽ bị alertEscalation.job tự sinh ticket sau 15 phút nếu báo nhầm.
  NOISE_ANOMALY:     'MEDIUM',
  THRESHOLD_BREACH:  'MEDIUM',
  SENSOR_FAULT:      'MEDIUM',
  PUMP_DRY:          'MEDIUM',
  EDGE_AI_DEGRADED:  'MEDIUM',
  LOW_RETURN_RATE:   'LOW',
  // v1.24.0 — suy luận thống kê, có thể báo nhầm → không để mức tự sinh ticket
  SENSOR_ANOMALY:    'MEDIUM',
  FORECAST_BREACH:   'LOW',
}

/** Cảnh báo không bao giờ được ở mức tự sinh ticket (HIGH/CRITICAL), kể cả khi thiết bị gửi lên */
const NEVER_ESCALATE = new Set<AlertType>(['THRESHOLD_BREACH', 'NOISE_ANOMALY', 'SENSOR_ANOMALY', 'FORECAST_BREACH', 'LOW_RETURN_RATE'])

/**
 * EXPERT-FR-003 — cảnh báo SUY LUẬN (thống kê/dB, có thể báo nhầm): Domain Expert xác
 * nhận hoặc bác bỏ. Cảnh báo đo trực tiếp (vượt ngưỡng, mất kết nối…) không cần kiểm chứng.
 */
export const INFERRED_ALERT_TYPES: AlertType[] = ['NOISE_ANOMALY', 'SENSOR_ANOMALY', 'FORECAST_BREACH', 'LOW_RETURN_RATE']

/** Tên loại cảnh báo firmware cũ còn gửi → tên hiện hành */
const ALERT_TYPE_ALIAS: Record<string, AlertType> = { BIRD_PANIC: 'NOISE_ANOMALY' } // firmware < 1.3.0

export interface CreateAlertInput {
  farmId: string
  zoneId?: string
  nodeId?: string
  type: AlertType
  severity?: AlertSeverity
  title: string
  message: string
  snapshotUrl?: string
  metadata?: Record<string, unknown>
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
  const severity = input.severity ?? DEFAULT_SEVERITY[input.type]
  const now = new Date()

  // Farm đã xoá mềm mà thiết bị vẫn cắm điện: không sinh cảnh báo (và ticket) mà
  // không ai mở được. Pre-hook findOne của Farm đã loại is_deleted.
  if (!(await Farm.exists({ _id: input.farmId }))) return null

  // ponytail: tìm-rồi-tạo không nguyên tử — 2 mẫu cùng sự cố tới đồng thời có
  // thể ra 1 bản trùng; thêm unique partial index nếu thấy xảy ra thật.
  const open = await Alert.findOne({
    farm_id: input.farmId,
    zone_id: input.zoneId,
    node_id: input.nodeId,
    type: input.type,
    status: { $in: OPEN_STATUSES },
  }).select('_id created_at last_seen_at').lean()
  if (open) {
    const lastSeen = (open.last_seen_at ?? open.created_at).getTime()
    if (now.getTime() - lastSeen >= ALERT_SEEN_UPDATE_MS) {
      await Alert.updateOne({ _id: open._id }, {
        $set: { last_seen_at: now, message: input.message, metadata: input.metadata },
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
    node_id:      input.nodeId,
    type:         input.type,
    severity,
    title:        input.title,
    message:      input.message,
    snapshot_url: input.snapshotUrl,
    metadata:     input.metadata,
    status:       'ACTIVE',
  })

  if (input.zoneId) {
    emitAlertNew(input.zoneId, {
      alertId:     String(alert._id),
      severity,
      type:        input.type,
      title:       input.title,
      message:     input.message,
      snapshotUrl: input.snapshotUrl,
    })
  }

  // Không await: gửi thông báo chậm/lỗi không được chặn luồng ghi cảnh báo
  void dispatchAlertNotification(alert).catch((err: Error) =>
    logger.error('Gửi thông báo cảnh báo thất bại', { alertId: String(alert._id), err }),
  )

  return alert
}

/**
 * Cảnh báo do thiết bị tự phát hiện, gọi từ mqtt/handlers/alert.handler.ts
 * (ESP32 `{base}/alert`: SENSOR_FAULT, RS485_BUS_FAILURE, SPEAKER_FAILURE,
 * PUMP_DRY, POWER_OUTAGE, NOISE_ANOMALY — THREAT-FR-006/007/011/012/013; nút AI
 * `vision/alert`: EDGE_AI_DEGRADED).
 *
 * Thiết bị được nhận diện qua `deviceId` trong payload, KHÔNG qua slug trong
 * topic (xem ghi chú ở telemetry.service) — nên cảnh báo vẫn vào đúng farm kể
 * cả khi firmware chưa trỏ đúng farmId/houseId/zoneId thật.
 */
export async function ingestDeviceAlert(message: Record<string, unknown>): Promise<IAlert | null> {
  const deviceId = message.deviceId as string | undefined
  const rawType = message.type as string | undefined
  const type = rawType && (ALERT_TYPE_ALIAS[rawType] ?? (rawType as AlertType))
  if (!deviceId || !type) throw NotFoundError('Payload cảnh báo thiếu deviceId hoặc type')
  // Loại không được leo thang thành ticket (ALERT-FR-012 + cảnh báo suy luận) giữ tối
  // đa MEDIUM dù thiết bị gửi mức cao hơn — một firmware cấu hình sai không được tự sinh ticket.
  const sent = message.severity as AlertSeverity | undefined
  const severity = NEVER_ESCALATE.has(type) && (sent === 'CRITICAL' || sent === 'HIGH') ? 'MEDIUM' : sent

  const node = await SensorNode.findOne({ device_id: deviceId, ...IN_SERVICE })
  if (!node) throw NotFoundError(`Không tìm thấy SensorNode với device_id="${deviceId}"`)
  const zone = await Zone.findById(node.zone_id).select('farm_id').lean()
  if (!zone) throw NotFoundError(`Thiết bị "${deviceId}" chưa gắn Zone hợp lệ`)

  return createAlert({
    farmId:      String(zone.farm_id),
    zoneId:      String(zone._id),
    nodeId:      String(node._id),
    type,
    severity,
    title:       (message.title as string | undefined) ?? `${type} tại ${zone.name}`,
    message:     (message.message as string | undefined) ?? `Thiết bị ${deviceId} báo ${type}`,
    snapshotUrl: message.snapshotUrl as string | undefined,
    metadata:    { raw: message },
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
 * được xác lập cho nhà yến, ngưỡng của Zone là ngưỡng cảnh báo do Domain Expert đặt,
 * và hệ thống không điều khiển quạt theo hai chỉ số này.
 */
const AIR_QUALITY_METRICS = new Set(['nh3_ppm', 'co2_ppm'])
const AIR_QUALITY_NOTE = 'NH3/CO2 là ngưỡng cảnh báo do chuyên gia đặt — hệ thống không tự chạy quạt theo chỉ số này'

const METRIC_LABEL: Record<string, string> = {
  temperature: 'Nhiệt độ',
  humidity:    'Độ ẩm',
  light_lux:   'Ánh sáng',
  nh3_ppm:     'NH3',
  co2_ppm:     'CO2',
}

/** ENV-FR-004 + ALERT-FR-001 — gọi từ telemetry.service sau khi lưu bản ghi */
export async function raiseThresholdAlert(zoneId: string, nodeId: string, breaches: ThresholdBreach[]): Promise<void> {
  if (breaches.length === 0) return

  const zone = await Zone.findById(zoneId).lean()
  if (!zone) return

  const detail = breaches
    .map(b => `${METRIC_LABEL[b.metric] ?? b.metric} ${b.value} (${b.direction === 'above' ? 'vượt' : 'dưới'} ngưỡng ${b.limit})`)
    .join(', ')
  const airQuality = breaches.some(b => AIR_QUALITY_METRICS.has(b.metric))

  await createAlert({
    farmId:   String(zone.farm_id),
    zoneId,
    nodeId,
    type:     'THRESHOLD_BREACH',
    title:    `Vượt ngưỡng tại ${zone.name}`,
    message:  airQuality ? `${detail}. ${AIR_QUALITY_NOTE}` : detail,
    metadata: { breaches },
  })
}

// ── Truy vấn phía Farm Owner (ALERT-FR-007/009) ─────────────────────────────

export interface ListAlertsQuery {
  farmId?: string
  zoneId?: string
  status?: string
  severity?: string
  type?: string
  /** EXPERT-FR-003 — pending = cảnh báo suy luận chưa được kiểm chứng */
  verdict?: 'pending' | 'confirmed' | 'rejected'
  page?: number
  limit?: number
}

/**
 * ALERT-FR-007 — Farm Owner chỉ thấy cảnh báo của farm mình; ADMIN thấy tất cả;
 * Technician thấy farm trong khu vực phụ trách (phục vụ xử lý ticket, RACI 4.4).
 */
export async function listAlerts(user: CurrentUser, query: ListAlertsQuery) {
  const accessibleFarms = await listAccessibleFarmIds(user)
  const filter: Record<string, unknown> = { farm_id: { $in: accessibleFarms } }

  if (query.farmId) {
    if (!accessibleFarms.some(id => String(id) === query.farmId)) throw ForbiddenError('Không có quyền trên farm này')
    filter.farm_id = query.farmId
  }
  if (query.zoneId) filter.zone_id = query.zoneId
  if (query.status) filter.status = query.status
  if (query.severity) filter.severity = query.severity
  if (query.type) filter.type = query.type
  if (query.verdict === 'pending') {
    filter.expert_verdict = { $exists: false }
    if (!query.type) filter.type = { $in: INFERRED_ALERT_TYPES }
  } else if (query.verdict) {
    filter['expert_verdict.result'] = query.verdict.toUpperCase()
  }
  const scoped = filter

  const { page, skip, limit } = paginate(query.page, query.limit)

  const [records, total, unreadCount] = await Promise.all([
    Alert.find(scoped).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    Alert.countDocuments(scoped),
    Alert.countDocuments({ ...scoped, status: 'ACTIVE' }),
  ])

  return { records, total, page, limit, unreadCount }
}

export async function getAlert(alertId: string, user: CurrentUser): Promise<IAlert> {
  const alert = await Alert.findById(alertId)
  if (!alert) throw NotFoundError('Không tìm thấy cảnh báo')
  await assertRecordAccess(alert.farm_id, alert.zone_id, user)
  return alert
}

/**
 * ALERT-FR-009 — Farm Owner xác nhận đã xử lý kèm ghi chú. Ghi chú "Báo động giả"
 * được giữ lại làm dữ liệu đánh giá chất lượng model AI sau này (Flow 4 case 9a).
 */
export async function acknowledgeAlert(alertId: string, user: CurrentUser, note?: string): Promise<IAlert> {
  const alert = await getAlert(alertId, user)
  if (alert.status !== 'ACTIVE') throw ConflictError('Cảnh báo này đã được xác nhận trước đó')

  alert.status = 'ACKNOWLEDGED'
  alert.acknowledged_at = new Date()
  alert.acknowledged_by = user._id as never
  alert.acknowledgement_note = note
  await alert.save()
  return alert
}

/**
 * EXPERT-FR-003 — Domain Expert ghi kết quả kiểm chứng 1 cảnh báo suy luận. Ghi lại
 * được (chuyên gia đổi ý sau khi xem thêm dữ liệu); không đổi trạng thái xử lý của
 * cảnh báo — xác nhận đã xử lý vẫn là việc của Farm Owner (ALERT-FR-009).
 */
export async function setAlertVerdict(
  alertId: string, user: CurrentUser, result: AlertVerdictResult, note?: string,
): Promise<IAlert> {
  const alert = await getAlert(alertId, user)
  if (!INFERRED_ALERT_TYPES.includes(alert.type)) {
    throw BadRequestError(`Chỉ kiểm chứng cảnh báo suy luận (${INFERRED_ALERT_TYPES.join(', ')})`)
  }
  alert.expert_verdict = { result, note, by: user._id as never, at: new Date() }
  await alert.save()
  await logAction(user._id, 'ALERT_VERDICT_SET', 'alert', String(alert._id), { type: alert.type, result })
  return alert
}

/**
 * EXPERT-FR-003 — số cảnh báo suy luận được xác nhận / bác bỏ / còn chờ theo từng loại,
 * làm căn cứ chỉnh tham số phát hiện (EXPERT-FR-008). `confirmedPct` tính trên số đã
 * kiểm chứng; null khi chưa kiểm chứng cái nào.
 */
export async function getVerdictStats(user: CurrentUser, query: { farmId?: string; zoneId?: string }) {
  const accessibleFarms = await listAccessibleFarmIds(user)
  if (query.farmId && !accessibleFarms.some(id => String(id) === query.farmId)) throw ForbiddenError('Không có quyền trên farm này')
  const farmIds = query.farmId ? accessibleFarms.filter(id => String(id) === query.farmId) : accessibleFarms

  const rows = await Alert.aggregate<{ _id: { type: AlertType; result: AlertVerdictResult | null }; count: number }>([
    { $match: { farm_id: { $in: farmIds }, type: { $in: INFERRED_ALERT_TYPES }, ...(query.zoneId && { zone_id: new Types.ObjectId(query.zoneId) }) } },
    { $group: { _id: { type: '$type', result: { $ifNull: ['$expert_verdict.result', null] } }, count: { $sum: 1 } } },
  ])

  return INFERRED_ALERT_TYPES.map(type => {
    const of = (result: AlertVerdictResult | null) => rows.find(r => r._id.type === type && r._id.result === result)?.count ?? 0
    const confirmed = of('CONFIRMED')
    const rejected = of('REJECTED')
    const reviewed = confirmed + rejected
    return { type, confirmed, rejected, pending: of(null), confirmedPct: reviewed ? Math.round((100 * confirmed) / reviewed) : null }
  })
}

/**
 * FARM-FR-008 — gỡ thiết bị thì cảnh báo của nó phải đóng theo. Cảnh báo còn
 * `ACTIVE` của thiết bị đã tháo về kho vẫn bị `alertEscalation.job` biến thành
 * ticket sau 15 phút, gán cho Technician một việc không còn tồn tại để sửa.
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
 * ALERT-FR-008 — THRESHOLD_BREACH không còn được ghi nhận lại trong
 * THRESHOLD_CLEAR_MS (chỉ số đã về bình thường, hoặc thiết bị ngừng gửi — khi
 * đó đã có NODE_OFFLINE riêng) thì tự đóng. Gọi định kỳ từ jobs/alertEscalation.job.ts.
 */
export async function resolveStaleThresholdAlerts(): Promise<number> {
  const clearBefore = new Date(Date.now() - THRESHOLD_CLEAR_MS)
  const { modifiedCount } = await Alert.updateMany(
    {
      type: 'THRESHOLD_BREACH',
      status: { $in: OPEN_STATUSES },
      $or: [
        { last_seen_at: { $lt: clearBefore } },
        { last_seen_at: { $exists: false }, created_at: { $lt: clearBefore } },
      ],
    },
    { status: 'RESOLVED', resolved_at: new Date(), acknowledgement_note: 'Chỉ số đã trở lại bình thường' },
  )
  return modifiedCount
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
