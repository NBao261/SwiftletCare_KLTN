import { Types } from 'mongoose'
import { Alert, IAlert, OPEN_ALERT_STATUSES, incidentKeyOf, type OnsiteCheck } from '@/models/alert.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { SensorNode, CameraNode, IN_SERVICE } from '@/models/device.model'
import { emitAlertNew, emitHouseAlertNew } from '@/socket'
import { dispatchAlertNotification } from '@/services/notification.service'
import { repeatRecipientIds, rerouteReconfirmedAlert, routeNewAlert } from '@/services/alertRouting.service'
import { handleAlertRejected, handleNewAlert, openWorkOrderForAlert } from '@/services/workOrder.service'
import { notifyExpertDecision } from '@/services/expertActivity.service'
import {
  assertExpertDecision, assertFarmAccess, assertHouseAccess, assertNodeHouseAccess, assertZoneAccess, listAccessibleFarmIds,
  listAccessibleHouseIds, listAccessibleZoneIds,
} from '@/utils/farmAccess.util'
import { AppError, NotFoundError, ForbiddenError, ConflictError, BadRequestError } from '@/utils/appError.util'
import { logAction } from '@/services/auditLog.service'
import { paginate } from '@/utils/helpers.util'
import { presignedGetUrl } from '@/config/minio.config'
import { photoUrls } from '@/services/workOrder.service'
import type { SiteCause } from '@/models/workOrder.model'
import { parseDeviceAlertText } from '@/utils/deviceInput.util'
import logger from '@/utils/logger.util'
import { ALERT_TYPE_LABEL } from '@/utils/displayLabel.util'
import type { DwelledBreach } from '@/utils/breachDwell.util'
import type {
  AlertType, AlertSeverity, AlertStatus, AlertVerdictResult, CurrentUser, FarmMemberRole, Thresholds, TelemetryPayload,
} from '@/types'

export const ALERT_SEEN_UPDATE_MS = 60 * 1000
// Không ghi nhận lại trong khoảng này = đã bình thường, tự đóng
export const THRESHOLD_CLEAR_MS = 5 * 60 * 1000

// Firmware gửi lại mỗi 15 phút khi sự cố còn, nên mốc này phải dài hơn. 60 phút chọn tay
export const EPISODE_CLEAR_MS = 60 * 60 * 1000
// Tự đóng khi tải chạy đúng lại; Work Order của nó không dựa vào việc gửi lại
export const EPISODE_ALERT_TYPES: AlertType[] = ['NOISE_ANOMALY', 'MISTING_INEFFECTIVE', 'ACTUATOR_FAULT']

export const ACTUATOR_LOADS = ['misting', 'ventilation'] as const
const ACTUATOR_FAULT_KINDS = ['NO_CURRENT_WHILE_ON', 'CURRENT_WHILE_OFF'] as const

// Gồm cả DISMISSED: vẫn gộp lần gặp lại và tự đóng như cảnh báo còn hiệu lực
export const OPEN_STATUSES: AlertStatus[] = OPEN_ALERT_STATUSES

const IN_FORCE_STATUSES: AlertStatus[] = ['ACTIVE', 'ACKNOWLEDGED']

// chỉ backend đặt mức vì mức quyết định ai nhận và khi nào; severity trong tin MQTT bị bỏ qua
export const DEFAULT_SEVERITY: Record<AlertType, AlertSeverity> = {
  RS485_BUS_FAILURE: 'CRITICAL',
  UNEXPECTED_RESTART: 'HIGH',
  SPEAKER_FAILURE:   'HIGH',
  NODE_OFFLINE:      'HIGH',
  ACTUATOR_FAULT:    'HIGH',
  // Suy luận: HIGH sẽ bị gửi lại sau 15 phút nếu báo nhầm
  NOISE_ANOMALY:     'MEDIUM',
  THRESHOLD_BREACH:  'MEDIUM',
  SENSOR_FAULT:      'MEDIUM',
  MISTING_INEFFECTIVE: 'MEDIUM',
  EDGE_AI_DEGRADED:  'MEDIUM',
  CONFIG_MISMATCH:   'MEDIUM',
  LOW_RETURN_RATE:   'LOW',
  // Suy luận, có thể báo nhầm: không để mức được gửi lại
  SENSOR_ANOMALY:    'MEDIUM',
  FORECAST_BREACH:   'LOW',
  MAINTENANCE_DUE:   'LOW',
}

export const ALERT_TYPES = Object.keys(DEFAULT_SEVERITY) as AlertType[]

export const INFERRED_ALERT_TYPES: AlertType[] = ['NOISE_ANOMALY', 'SENSOR_ANOMALY', 'FORECAST_BREACH', 'LOW_RETURN_RATE']

// Thiết bị gửi lên thì từ chối: làm sai thống kê kiểm chứng
const BACKEND_ONLY_ALERT_TYPES: AlertType[] = [
  'NODE_OFFLINE', 'SENSOR_ANOMALY', 'FORECAST_BREACH', 'LOW_RETURN_RATE', 'MAINTENANCE_DUE', 'CONFIG_MISMATCH',
]

// Administrator thấy loại này ở mọi farm
export const DEVICE_ALERT_TYPES: AlertType[] = [
  'NODE_OFFLINE', 'EDGE_AI_DEGRADED', 'SENSOR_FAULT', 'RS485_BUS_FAILURE', 'UNEXPECTED_RESTART',
  'SPEAKER_FAILURE', 'MISTING_INEFFECTIVE', 'ACTUATOR_FAULT', 'CONFIG_MISMATCH', 'MAINTENANCE_DUE',
]

const CAMERA_ALERT_TYPES: AlertType[] = ['EDGE_AI_DEGRADED']

const ALERT_TYPE_ALIAS: Record<string, AlertType> = {
  BIRD_PANIC:   'NOISE_ANOMALY',
  PUMP_DRY:     'MISTING_INEFFECTIVE',
  POWER_OUTAGE: 'UNEXPECTED_RESTART',
}

// Chuỗi lạ từ thiết bị không được làm phình cảnh báo
const MAX_RESET_REASON_LENGTH = 32

export interface CreateAlertInput {
  // Chống tính trùng khi QoS 1 giao lại
  eventId?: string
  farmId: string
  zoneId?: string
  houseId?: string
  nodeId?: string
  type: AlertType
  title: string
  message: string
  snapshotUrl?: string
  metadata?: Record<string, unknown>
  details?: Record<string, unknown>
}

// không tạo bản ghi, không gửi lại. Trả true khi đã gộp
async function absorbIntoOpenAlert(incidentKey: string, input: CreateAlertInput, now: Date): Promise<boolean> {
  const open = await Alert.findOne({ incident_key: incidentKey, status: { $in: OPEN_STATUSES } })
    .select('_id created_at last_seen_at').lean()
  if (!open) return false
  // Bản QoS 1 giao lại của lần báo này cũng bị bỏ
  if (input.eventId) await Alert.updateOne({ _id: open._id }, { $set: { event_id: input.eventId } })
  const lastSeen = (open.last_seen_at ?? open.created_at).getTime()
  if (now.getTime() - lastSeen >= ALERT_SEEN_UPDATE_MS) {
    await Alert.updateOne({ _id: open._id }, {
      $set: { last_seen_at: now, message: input.message, metadata: input.metadata, ...(input.details && { details: input.details }) },
      $inc: { occurrence_count: 1 },
    })
  }
  logger.debug('Alert bị dedup (ALERT-FR-008)', { type: input.type, zoneId: input.zoneId })
  return true
}

// Trùng khoá incident_key, không phải event_id
function isDuplicateIncident(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const { code, keyPattern } = err as { code?: unknown; keyPattern?: Record<string, unknown> }
  return code === 11000 && keyPattern !== undefined && 'incident_key' in keyPattern
}

// Điểm vào duy nhất để tạo cảnh báo. null khi bị gộp vào cảnh báo mở cùng incidentKeyOf
export async function createAlert(input: CreateAlertInput): Promise<IAlert | null> {
  const severity = DEFAULT_SEVERITY[input.type]
  const now = new Date()

  // Farm đã xoá mềm mà thiết bị vẫn chạy: không sinh cảnh báo không ai mở được
  if (!(await Farm.exists({ _id: input.farmId }))) return null

  const incidentKey = incidentKeyOf({
    type: input.type, farm_id: input.farmId, zone_id: input.zoneId, house_id: input.houseId, node_id: input.nodeId,
    details: input.details,
  })
  if (await absorbIntoOpenAlert(incidentKey, input, now)) return null

  let alert: IAlert
  try {
    alert = await Alert.create({
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
      event_id:     input.eventId,
      status:       'ACTIVE',
    })
  } catch (err) {
    // Tin cùng sự cố vừa tạo cảnh báo giữa lúc tìm và tạo: unique index chặn bản thứ hai
    if (!isDuplicateIncident(err)) throw err
    await absorbIntoOpenAlert(incidentKey, input, now)
    return null
  }

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

  // Định tuyến lỗi thì vẫn gửi Farm Owner: cảnh báo không được mất vì bước chọn người nhận
  const awaitsVerdict = INFERRED_ALERT_TYPES.includes(input.type)
  let recipientIds: string[] | undefined
  try {
    recipientIds = await routeNewAlert(alert, { awaitsVerdict })
  } catch (err) {
    logger.error('Định tuyến cảnh báo thất bại — gửi Farm Owner', { alertId: String(alert._id), err })
  }
  // Không await: gửi chậm không chặn ghi cảnh báo. Cảnh báo suy luận còn báo chuyên gia trong app
  void dispatchAlertNotification(alert, { awaitsVerdict, ...(recipientIds && { recipientIds }) }).catch((err: Error) =>
    logger.error('Gửi thông báo cảnh báo thất bại', { alertId: String(alert._id), err }),
  )
  // lỗi chỉ ghi log
  await handleNewAlert(alert)

  return alert
}

// Firmware chỉ gửi message: tiêu đề dùng tên loại người đọc được, không để lộ mã loại
function deviceAlertTitle(message: Record<string, unknown>, type: AlertType, place: string): string {
  const sent = typeof message.title === 'string' ? message.title.trim().slice(0, 200) : ''
  return sent || `${ALERT_TYPE_LABEL[type]} tại ${place}`
}

// Nhận diện qua deviceId trong payload, không qua topic
export async function ingestDeviceAlert(message: Record<string, unknown>): Promise<IAlert | null> {
  const deviceId = message.deviceId as string | undefined
  const rawType = typeof message.type === 'string' ? message.type : undefined
  // Object.hasOwn: tra thẳng sẽ trả hàm của Object.prototype cho 'constructor'
  const type = rawType && (Object.hasOwn(ALERT_TYPE_ALIAS, rawType) ? ALERT_TYPE_ALIAS[rawType] : rawType)
  if (!deviceId || !type) throw NotFoundError('Payload cảnh báo thiếu deviceId hoặc type')
  if (!ALERT_TYPES.includes(type as AlertType) || BACKEND_ONLY_ALERT_TYPES.includes(type as AlertType)) {
    throw BadRequestError(`Loại cảnh báo không hợp lệ: "${type}"`)
  }

  // mỗi eventId chỉ tính 1 lần
  const eventId = typeof message.eventId === 'string' && message.eventId && message.eventId.length <= 128 ? message.eventId : undefined
  const content = parseDeviceAlertText(message)
  const common = {
    eventId,
    type:        type as AlertType,
    message:     content.text ?? `Thiết bị ${deviceId} báo ${type}`,
    snapshotUrl: content.snapshotUrl,
    metadata:    { raw: content.raw } as Record<string, unknown>,
    details:     undefined as Record<string, unknown> | undefined,
  }

  const node = await SensorNode.findOne({ device_id: deviceId, ...IN_SERVICE }).select('zone_id reset_reason').lean()
  if (node) {
    if (eventId && (await Alert.exists({ node_id: node._id, event_id: eventId }))) {
      logger.debug('Bỏ cảnh báo giao lại', { deviceId, eventId })
      return null
    }
    // Firmware không gửi thì lấy từ heartbeat gần nhất
    if (type === 'UNEXPECTED_RESTART') {
      const sent = message.resetReason ?? message.reset_reason
      const resetReason = typeof sent === 'string' && sent.length <= MAX_RESET_REASON_LENGTH ? sent : node.reset_reason
      if (resetReason) {
        common.metadata = { ...common.metadata, reset_reason: resetReason }
        common.details = { reset_reason: resetReason }
      }
    }
    // Giá trị lạ thì bỏ
    if (type === 'ACTUATOR_FAULT') common.details = actuatorFaultDetails(message)
    const zone = await Zone.findById(node.zone_id).select('farm_id name').lean()
    if (!zone) throw NotFoundError(`Thiết bị "${deviceId}" chưa gắn Zone hợp lệ`)
    return createAlert({
      ...common, farmId: String(zone.farm_id), zoneId: String(zone._id), nodeId: String(node._id),
      title: deviceAlertTitle(message, type as AlertType, zone.name),
    })
  }

  // Nút AI chỉ được báo loại của mình, gắn House
  const camera = CAMERA_ALERT_TYPES.includes(type as AlertType)
    ? await CameraNode.findOne({ device_id: deviceId, ...IN_SERVICE }).select('house_id').lean()
    : null
  if (!camera) throw NotFoundError(`Không tìm thấy thiết bị với device_id="${deviceId}" cho loại "${type}"`)
  const house = await House.findById(camera.house_id).select('farm_id name').lean()
  if (!house) throw NotFoundError(`Camera "${deviceId}" chưa gắn House hợp lệ`)
  return createAlert({
    ...common, farmId: String(house.farm_id), houseId: String(house._id), nodeId: String(camera._id),
    title: deviceAlertTitle(message, type as AlertType, house.name),
  })
}

// Trường thiếu hoặc sai kiểu thì bỏ, không từ chối: báo lỗi tải quan trọng hơn đủ chi tiết
function actuatorFaultDetails(message: Record<string, unknown>): Record<string, unknown> | undefined {
  const isAmps = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
  const details: Record<string, unknown> = {}
  if (ACTUATOR_LOADS.includes(message.load as never)) details.load = message.load
  if (ACTUATOR_FAULT_KINDS.includes(message.fault as never)) details.fault = message.fault
  if (isAmps(message.normalCurrentA)) details.normal_current_a = message.normalCurrentA
  if (isAmps(message.currentA)) details.current_a = message.currentA
  return Object.keys(details).length > 0 ? details : undefined
}

// Dùng chung cho is_anomaly và THRESHOLD_BREACH để 1 định nghĩa "bất thường"
export interface ThresholdBreach { metric: string; value: number; limit: number; direction: 'above' | 'below' }

export function findThresholdBreaches(
  payload: Pick<TelemetryPayload, 'temperature' | 'humidity' | 'light_lux' | 'nh3_ppm' | 'co2_ppm'>,
  t: Thresholds,
): ThresholdBreach[] {
  const breaches: ThresholdBreach[] = []
  const check = (metric: string, value: number | undefined, min: number | undefined, max: number | undefined) => {
    if (value === undefined || !Number.isFinite(value)) return // Cảm biến lỗi: SENSOR_FAULT lo
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

// NH3/CO2 chỉ cảnh báo, không điều khiển quạt
const AIR_QUALITY_METRICS = new Set(['nh3_ppm', 'co2_ppm'])
// Không ghi "do chuyên gia đặt": ngưỡng mặc định chưa ai chỉnh thì sai sự thật
const AIR_QUALITY_NOTE = 'NH3, CO2 chỉ để theo dõi và cảnh báo theo ngưỡng của Zone (chưa có giới hạn chuẩn cho nhà yến); quạt không tự chạy theo chỉ số này'

const METRIC_LABEL: Record<string, string> = {
  temperature: 'Nhiệt độ',
  humidity:    'Độ ẩm',
  light_lux:   'Ánh sáng',
  nh3_ppm:     'NH3',
  co2_ppm:     'CO2',
}

// đủ thời gian chờ thì tạo hoặc gộp; chưa đủ thì chỉ giữ cảnh báo mở của chính chỉ số đó còn sống
export async function raiseThresholdAlert(
  zoneId: string, nodeId: string, dwelled: DwelledBreach[], ongoing: ThresholdBreach[] = dwelled,
): Promise<void> {
  if (dwelled.length === 0) {
    if (ongoing.length > 0) await keepThresholdAlertAlive(zoneId, nodeId, ongoing.map(b => b.metric))
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
    metadata: { metrics: dwelled.map(b => b.metric), breaches: ongoing },
    details:  { metric: first.metric, observed: first.value, threshold: first.limit, direction: first.direction, started_at: first.started_at },
  })
}

// Chỉ số khác vừa vượt (chưa đủ chờ) không giữ cảnh báo này
async function keepThresholdAlertAlive(zoneId: string, nodeId: string, metrics: string[]): Promise<void> {
  const now = new Date()
  await Alert.updateOne(
    {
      zone_id: zoneId, node_id: nodeId, type: 'THRESHOLD_BREACH', status: { $in: OPEN_STATUSES },
      'metadata.metrics': { $in: metrics },
      $or: [{ last_seen_at: { $lt: new Date(now.getTime() - ALERT_SEEN_UPDATE_MS) } }, { last_seen_at: { $exists: false } }],
    },
    { $set: { last_seen_at: now } },
  )
}

export interface ListAlertsQuery {
  farmId?: string
  zoneId?: string
  houseId?: string
  // Cảnh báo của một thiết bị: bộ điều khiển hoặc camera
  nodeId?: string
  status?: string
  // status đi kèm thì status thắng
  open?: boolean
  severity?: string
  type?: string
  verdict?: 'any' | 'pending' | 'confirmed' | 'rejected'
  page?: number
  limit?: number
}

// Danh sách không ký URL ảnh nên bỏ khoá MinIO thô; ảnh xem ở chi tiết
function listRowView<T extends { onsite_checks?: OnsiteCheck[]; site_cause?: { photos?: string[] } }>(row: T) {
  const { onsite_checks: checks, site_cause: siteCause, ...rest } = row
  return {
    ...rest,
    ...(siteCause && { site_cause: (({ photos: _photos, ...cause }) => cause)(siteCause) }),
    onsite_checks: (checks ?? []).map(({ photo: _photo, ...check }) => ({
      ...check,
      observation: check.observation ?? null, note: check.note ?? null,
      answered_by: check.answered_by ?? null, answered_at: check.answered_at ?? null,
    })),
  }
}

// Administrator chỉ cảnh báo thiết bị; Farm Technician theo nhà được giao
export async function listAlerts(user: CurrentUser, query: ListAlertsQuery) {
  const filter: Record<string, unknown> = await alertScopeFilter(user)

  if (query.farmId) {
    // Thợ đã bị giới hạn theo nhà
    if (user.role !== 'FARM_TECHNICIAN') {
      const accessibleFarms = await listAccessibleFarmIds(user, 'device')
      if (!accessibleFarms.some(id => String(id) === query.farmId)) throw ForbiddenError('Không có quyền trên farm này')
    }
    filter.farm_id = query.farmId
  }
  // Nhà, Zone ngoài phạm vi: 403 như các route theo nhà khác (Administrator theo phạm vi thiết bị)
  if (query.zoneId) filter.zone_id = (await assertZoneAccess(query.zoneId, user, 'device')).zone._id
  if (query.houseId) {
    await assertHouseAccess(query.houseId, user, 'device')
    // $and để không đè $or phạm vi của thợ
    const zoneIds = await Zone.find({ house_id: query.houseId }).distinct('_id')
    const house = { $or: [{ house_id: query.houseId }, { zone_id: { $in: zoneIds } }] }
    filter.$and = [...((filter.$and as unknown[] | undefined) ?? []), house]
  }
  if (query.nodeId) {
    // Nhà của thiết bị ngoài phạm vi: 403; thiết bị không có: 404
    await assertNodeHouseAccess(query.nodeId, user, 'device')
    filter.node_id = query.nodeId
  }
  if (query.status) filter.status = query.status
  else if (query.open) filter.status = { $in: IN_FORCE_STATUSES }
  if (query.severity) filter.severity = query.severity
  if (query.type) filter.type = query.type
  if (query.verdict) {
    // Hàng chờ phải khớp hành động: verdict trên loại khác bị từ chối (400)
    if (query.type && !INFERRED_ALERT_TYPES.includes(query.type as AlertType)) {
      throw BadRequestError(`Chỉ lọc theo kiểm chứng cho cảnh báo suy luận (${INFERRED_ALERT_TYPES.join(', ')})`)
    }
    if (!query.type) filter.type = { $in: INFERRED_ALERT_TYPES }
    // any: mọi cảnh báo suy luận, đã kết luận hay chưa
    if (query.verdict === 'pending') filter.expert_verdict = { $exists: false }
    else if (query.verdict !== 'any') filter['expert_verdict.result'] = query.verdict.toUpperCase()
  }

  const { page, skip, limit } = paginate(query.page, query.limit)

  const [records, total, unreadCount] = await Promise.all([
    // Hiện ai bác bỏ
    Alert.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).populate('expert_verdict.by', 'full_name').lean()
      .then(rows => rows.map(listRowView)),
    Alert.countDocuments(filter),
    Alert.countDocuments({ ...filter, status: 'ACTIVE' }),
  ])

  return { records, total, page, limit, unreadCount }
}

async function alertScopeFilter(user: CurrentUser): Promise<Record<string, unknown>> {
  if (user.role === 'FARM_TECHNICIAN') {
    const [houseIds, zoneIds] = await Promise.all([listAccessibleHouseIds(user), listAccessibleZoneIds(user)])
    return { $or: [{ house_id: { $in: houseIds } }, { zone_id: { $in: zoneIds } }] }
  }
  const filter: Record<string, unknown> = { farm_id: { $in: await listAccessibleFarmIds(user, 'device') } }
  // $and để giữ bộ lọc type của người gọi
  if (user.role === 'ADMIN') filter.$and = [{ type: { $in: DEVICE_ALERT_TYPES } }]
  return filter
}

async function findAlertWithAccess(alertId: string, user: CurrentUser) {
  const alert = await Alert.findById(alertId)
  if (!alert) throw NotFoundError('Không tìm thấy cảnh báo')
  if (user.role === 'FARM_TECHNICIAN') {
    // theo nhà chứa zone, hoặc nhà
    if (alert.zone_id) return { alert, farm: (await assertZoneAccess(String(alert.zone_id), user)).farm }
    if (alert.house_id) return { alert, farm: (await assertHouseAccess(String(alert.house_id), user)).farm }
    throw ForbiddenError('Không có quyền trên cảnh báo này')
  }
  const farm = await assertFarmAccess(String(alert.farm_id), user, DEVICE_ALERT_TYPES.includes(alert.type) ? 'device' : 'farm')
  return { alert, farm }
}

export async function getAlert(alertId: string, user: CurrentUser): Promise<IAlert> {
  const { alert } = await findAlertWithAccess(alertId, user)
  return alert.populate('expert_verdict.by', 'full_name')
}

// Khoá MinIO không ra API: trả URL tạm
export async function presentOnsiteChecks(alert: IAlert) {
  await alert.populate([
    { path: 'onsite_checks.technician_id', select: 'full_name' }, { path: 'onsite_checks.answered_by', select: 'full_name' },
  ])
  const checks: OnsiteCheck[] = alert.toObject().onsite_checks ?? []
  // observation: null, không phải thiếu khoá: mobile tìm yêu cầu còn chờ theo đó
  return Promise.all(checks.map(async ({ photo, ...check }) => ({
    ...check,
    observation: check.observation ?? null,
    note: check.note ?? null,
    answered_by: check.answered_by ?? null,
    answered_at: check.answered_at ?? null,
    photo_url: photo ? await presignedGetUrl(photo) : null,
  })))
}

async function presentAlert(alert: IAlert) {
  await alert.populate('expert_verdict.by', 'full_name')
  const onsiteChecks = await presentOnsiteChecks(alert)
  const { site_cause: siteCause, ...rest } = alert.toObject()
  return {
    ...rest,
    onsite_checks: onsiteChecks,
    site_cause: siteCause
      ? { cause: siteCause.cause, by: siteCause.by, at: siteCause.at, photo_urls: await photoUrls(siteCause.photos) }
      : null,
  }
}

export async function getAlertDetail(alertId: string, user: CurrentUser) {
  return presentAlert(await getAlert(alertId, user))
}

// Ghi chú "Báo động giả" giữ làm dữ liệu đánh giá model. Xác nhận trước escalation_min thì không leo thang
export async function acknowledgeAlert(
  alertId: string, user: CurrentUser, note?: string, cause?: SiteCause,
) {
  const { alert } = await findAlertWithAccess(alertId, user)
  if (alert.status === 'DISMISSED') throw ConflictError('Cảnh báo này đã bị bác bỏ, không còn hiệu lực')
  if (alert.status !== 'ACTIVE') throw ConflictError('Cảnh báo này đã được xác nhận trước đó')

  alert.status = 'ACKNOWLEDGED'
  alert.acknowledged_at = new Date()
  alert.acknowledged_by = user._id as never
  alert.acknowledgement_note = note
  if (cause) alert.site_cause = { cause, photos: [], by: user._id as never, at: alert.acknowledged_at }
  // Cảnh báo của kế hoạch chỉ đóng khi duyệt Work Order phòng ngừa
  if (alert.type === 'MAINTENANCE_DUE' && !alert.details?.plan_id) {
    // xác nhận = đã bảo trì
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
  return presentAlert(alert)
}

// REJECTED khi còn hiệu lực → DISMISSED; CONFIRMED khi DISMISSED → previous_status và báo lại
export async function setAlertVerdict(
  alertId: string, user: CurrentUser, result: AlertVerdictResult, note?: string, needsVisit = false,
) {
  const { alert, farm } = await findAlertWithAccess(alertId, user)
  if (!INFERRED_ALERT_TYPES.includes(alert.type)) {
    throw BadRequestError(`Chỉ kiểm chứng cảnh báo suy luận (${INFERRED_ALERT_TYPES.join(', ')})`)
  }
  await assertExpertDecision(farm, user)
  const trimmedNote = note?.trim() || undefined
  // Route đã chặn; giữ cho đường gọi khác
  if (result === 'REJECTED' && !trimmedNote) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Bác bỏ cảnh báo phải ghi lý do')
  }
  if (result === 'REJECTED' && needsVisit) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Cảnh báo bị bác bỏ thì không mở Work Order')
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
  // Định tuyến trước khi lưu: job leo thang không được thấy ACTIVE mà owners_notified còn false
  const reconfirmed = statusBefore === 'DISMISSED' && alert.status !== 'DISMISSED'
  const recipientIds = reconfirmed
    ? await rerouteReconfirmedAlert(alert).catch((err: Error) => {
      logger.error('Định tuyến lại cảnh báo được xác nhận lại thất bại', { alertId: String(alert._id), err })
      return undefined
    })
    : undefined
  await alert.save()

  const auditId = await logAction(user._id, 'ALERT_VERDICT_SET', 'alert', String(alert._id), {
    type: alert.type, result, note: trimmedNote, needs_visit: needsVisit || undefined, status_before: statusBefore, status_after: alert.status,
    zone_id: alert.zone_id ? String(alert.zone_id) : undefined, house_id: alert.house_id ? String(alert.house_id) : undefined,
  }, { farmId: String(farm._id) })
  await notifyExpertDecision(user, farm._id, auditId, {
    what: result === 'CONFIRMED' ? 'xác nhận một cảnh báo' : 'bác bỏ một cảnh báo',
    place: alert.title,
    detail: trimmedNote,
  })
  if (reconfirmed) {
    void dispatchAlertNotification(alert, { recipientIds }).catch((err: Error) =>
      logger.error('Báo lại cảnh báo được xác nhận lại thất bại', { alertId: String(alert._id), err }),
    )
  }
  // đã có Work Order mở thì không thêm
  if (needsVisit) await openWorkOrderForAlert(alert, 'EXPERT', user._id)
  // Kết luận đã lưu: lỗi ở phiếu chỉ ghi log
  if (result === 'REJECTED' && trimmedNote) {
    await handleAlertRejected(alert._id, user, trimmedNote).catch((err: Error) =>
      logger.error('Xử lý Work Order của cảnh báo bị bác bỏ thất bại', { alertId: String(alert._id), err }))
  }
  return presentAlert(alert)
}

// confirmedPct null khi chưa kiểm chứng cái nào; kết luận cũ không có vai trò, tính cho DOMAIN_EXPERT
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

// Không đóng thì job vẫn gửi lại về thiết bị đã tháo
export async function resolveAlertsForNode(nodeId: string, reason: string, type?: AlertType): Promise<number> {
  const open = await Alert.find({ node_id: nodeId, status: { $in: OPEN_STATUSES }, ...(type && { type }) }).select('_id').lean()
  if (open.length === 0) return 0

  await Alert.updateMany(
    { _id: { $in: open.map(a => a._id) } },
    { status: 'RESOLVED', resolved_at: new Date(), acknowledgement_note: reason },
  )
  return open.length
}

export async function resolveHouseAlerts(houseId: string, type: AlertType, reason: string): Promise<number> {
  const { modifiedCount } = await Alert.updateMany(
    { house_id: houseId, type, status: { $in: OPEN_STATUSES } },
    { status: 'RESOLVED', resolved_at: new Date(), acknowledgement_note: reason },
  )
  return modifiedCount
}

// Thiết bị ngừng gửi thì đã có NODE_OFFLINE riêng
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

// Lần tái phát sau đó là cảnh báo mới
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
    // Giữ ghi chú xác nhận nếu đã có
    [{
      $set: {
        status: 'RESOLVED',
        resolved_at: now,
        acknowledgement_note: { $ifNull: ['$acknowledgement_note', 'Không còn ghi nhận lại, đợt sự cố đã qua'] },
      },
    }],
  )
  return modifiedCount
}

// gửi lại đúng 1 lần, giữ giờ im lặng. Bỏ qua thiết bị đã gỡ và đã ONLINE lại
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
    // Giữ chỗ trước: 2 lượt job chồng nhau chỉ 1 lượt gửi
    const { modifiedCount } = await Alert.updateOne(
      { _id: alert._id, status: 'ACTIVE', renotified_at: { $exists: false } }, { renotified_at: now },
    )
    if (modifiedCount === 0) continue
    try {
      // Cảnh báo cũ chưa có routing thì gửi Farm Owner
      const recipientIds = await repeatRecipientIds(alert)
      await dispatchAlertNotification(alert, { repeat: true, ...(recipientIds && { recipientIds }) })
      sent++
    } catch (err) {
      // Không gửi lại lần nữa (tối đa 2 lần)
      logger.error('Gửi lại cảnh báo chưa xác nhận thất bại', { alertId: String(alert._id), err })
    }
  }
  return sent
}

// Lưới an toàn: job offline và heartbeat chạy song song, không phụ thuộc thứ tự sự kiện
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

export async function raiseCameraOfflineAlert(cameraId: string): Promise<void> {
  const camera = await CameraNode.findById(cameraId).lean()
  if (!camera || camera.status !== 'OFFLINE') return
  const house = await House.findById(camera.house_id).lean()
  if (!house) return

  // Cùng khoá dedup với FPS thấp: không đóng trước thì mất kết nối bị gộp vào cảnh báo cũ
  await resolveAlertsForNode(cameraId, 'Camera đếm chim mất kết nối, chuyển sang cảnh báo mất kết nối', 'EDGE_AI_DEGRADED')
  await createAlert({
    farmId:  String(house.farm_id),
    houseId: String(house._id),
    nodeId:  String(camera._id),
    type:    'EDGE_AI_DEGRADED',
    title:   `Camera đếm chim ${camera.device_id} mất kết nối`,
    message: `Không nhận được tín hiệu từ camera đếm chim ${camera.device_id} tại ${house.name}; số đếm chim đang gián đoạn.`,
  })
}

// Cùng khoá dedup với mất kết nối: heartbeat thấp liên tiếp chỉ tăng occurrence_count
export async function raiseCameraLowFpsAlert(cameraId: string, fps: number, minFps: number): Promise<void> {
  const camera = await CameraNode.findById(cameraId).lean()
  if (!camera) return
  const house = await House.findById(camera.house_id).lean()
  if (!house) return
  await createAlert({
    farmId:  String(house.farm_id),
    houseId: String(house._id),
    nodeId:  String(camera._id),
    type:    'EDGE_AI_DEGRADED',
    title:   `Camera đếm chim ${camera.device_id} xử lý chậm`,
    message: `Camera đếm chim ${camera.device_id} tại ${house.name} chỉ xử lý ${fps} khung hình/giây (cần từ ${minFps}); số đếm chim có thể thiếu.`,
    metadata: { cause: 'LOW_FPS', fps, min_fps: minFps },
  })
}

export async function raiseNodeOfflineAlert(nodeId: string): Promise<void> {
  const node = await SensorNode.findById(nodeId).lean()
  // Heartbeat có thể tới giữa lúc đổi OFFLINE và lúc tạo cảnh báo
  if (!node || node.status !== 'OFFLINE') return
  const zone = await Zone.findById(node.zone_id).lean()
  if (!zone) return

  await createAlert({
    farmId:  String(zone.farm_id),
    zoneId:  String(zone._id),
    nodeId:  String(node._id),
    type:    'NODE_OFFLINE',
    title:   `Thiết bị ${node.device_id} mất kết nối`,
    message: `Không nhận được tín hiệu từ ${node.device_id} tại ${zone.name} quá thời gian cho phép.`,
  })
}
