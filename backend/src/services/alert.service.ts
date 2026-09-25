import { Alert, IAlert } from '@/models/alert.model'
import { Farm } from '@/models/farm.model'
import { Zone, House } from '@/models/houseZone.model'
import { SensorNode, IN_SERVICE } from '@/models/device.model'
import { emitAlertNew } from '@/socket'
import { dispatchAlertNotification } from '@/services/notification.service'
import { applyZoneScope, assertRecordAccess, listAccessibleFarmIds } from '@/utils/farmAccess.util'
import { NotFoundError, ForbiddenError, ConflictError } from '@/utils/appError.util'
import { paginate } from '@/utils/helpers.util'
import logger from '@/utils/logger.util'
import type { AlertType, AlertSeverity, CurrentUser, Thresholds, TelemetryPayload } from '@/types'

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
  BIRD_PANIC:        'HIGH',
  THRESHOLD_BREACH:  'MEDIUM',
  SENSOR_FAULT:      'MEDIUM',
  PUMP_DRY:          'MEDIUM',
  EDGE_AI_DEGRADED:  'MEDIUM',
  LOW_RETURN_RATE:   'LOW',
}

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
 * PUMP_DRY, POWER_OUTAGE — THREAT-FR-006/011/012/013; RPi `vision/alert`:
 * PREDATOR_DETECTED, BIRD_PANIC — THREAT-FR-001/007).
 *
 * Thiết bị được nhận diện qua `deviceId` trong payload, KHÔNG qua slug trong
 * topic (xem ghi chú ở telemetry.service) — nên cảnh báo vẫn vào đúng farm kể
 * cả khi firmware chưa trỏ đúng farmId/houseId/zoneId thật.
 */
export async function ingestDeviceAlert(message: Record<string, unknown>): Promise<IAlert | null> {
  const deviceId = message.deviceId as string | undefined
  const type = message.type as AlertType | undefined
  if (!deviceId || !type) throw NotFoundError('Payload cảnh báo thiếu deviceId hoặc type')

  const node = await SensorNode.findOne({ device_id: deviceId, ...IN_SERVICE })
  if (!node) throw NotFoundError(`Không tìm thấy SensorNode với device_id="${deviceId}"`)
  const zone = await Zone.findById(node.zone_id)
  const house = zone ? await House.findById(zone.house_id) : null
  if (!zone || !house) throw NotFoundError(`Thiết bị "${deviceId}" chưa gắn Zone/House hợp lệ`)

  return createAlert({
    farmId:      String(house.farm_id),
    zoneId:      String(zone._id),
    nodeId:      String(node._id),
    type,
    severity:    message.severity as AlertSeverity | undefined,
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
  const house = await House.findById(zone.house_id).lean()
  if (!house) return

  const detail = breaches
    .map(b => `${METRIC_LABEL[b.metric] ?? b.metric} ${b.value} (${b.direction === 'above' ? 'vượt' : 'dưới'} ngưỡng ${b.limit})`)
    .join(', ')

  await createAlert({
    farmId:   String(house.farm_id),
    zoneId,
    nodeId,
    type:     'THRESHOLD_BREACH',
    title:    `Vượt ngưỡng tại ${zone.name}`,
    message:  detail,
    metadata: { breaches },
  })
}

// ── Truy vấn phía Farm Owner (ALERT-FR-007/009) ─────────────────────────────

export interface ListAlertsQuery {
  farmId?: string
  zoneId?: string
  status?: string
  severity?: string
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
  // Farm Operator chỉ thấy cảnh báo của Zone trong phạm vi + cảnh báo cấp farm
  const scoped = await applyZoneScope(filter, user)

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
 * ALERT-FR-009 — Farm Owner / Farm Operator xác nhận đã xử lý kèm ghi chú. Ghi chú "Báo động giả"
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
  const house = await House.findById(zone.house_id).lean()
  if (!house) return

  await createAlert({
    farmId:  String(house.farm_id),
    zoneId:  String(zone._id),
    nodeId:  String(node._id),
    type:    'NODE_OFFLINE',
    title:   `Thiết bị ${node.device_id} mất kết nối`,
    message: `Không nhận được heartbeat từ ${node.device_id} tại ${zone.name} quá thời gian cho phép.`,
  })
}
