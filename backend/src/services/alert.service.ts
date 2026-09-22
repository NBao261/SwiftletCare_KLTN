import { Alert, IAlert } from '@/models/alert.model'
import { Zone, House } from '@/models/houseZone.model'
import { SensorNode } from '@/models/device.model'
import { emitAlertNew } from '@/socket'
import { dispatchAlertNotification } from '@/services/notification.service'
import { assertFarmAccess, listAccessibleFarmIds } from '@/utils/farmAccess.util'
import { NotFoundError, ForbiddenError, ConflictError } from '@/utils/appError.util'
import { paginate } from '@/utils/helpers.util'
import logger from '@/utils/logger.util'
import type { AlertType, AlertSeverity, CurrentUser, Thresholds, TelemetryPayload } from '@/types'

/** ALERT-FR-008 — cùng loại + cùng zone trong cửa sổ này thì không tạo bản ghi mới */
export const DEDUP_WINDOW_MS = 5 * 60 * 1000

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
 * Trả về `null` khi bị dedup (đã có cảnh báo cùng loại/zone còn ACTIVE trong
 * 5 phút) — không phải lỗi, chỉ là không tạo bản ghi trùng.
 */
export async function createAlert(input: CreateAlertInput): Promise<IAlert | null> {
  const severity = input.severity ?? DEFAULT_SEVERITY[input.type]

  const duplicate = await Alert.findOne({
    farm_id: input.farmId,
    zone_id: input.zoneId,
    type: input.type,
    status: 'ACTIVE',
    created_at: { $gte: new Date(Date.now() - DEDUP_WINDOW_MS) },
  })
  if (duplicate) {
    logger.debug('Alert bị dedup (ALERT-FR-008)', { type: input.type, zoneId: input.zoneId })
    return null
  }

  const alert = await Alert.create({
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

  const node = await SensorNode.findOne({ device_id: deviceId })
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

  const { page, skip, limit } = paginate(query.page, query.limit)

  const [records, total, unreadCount] = await Promise.all([
    Alert.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    Alert.countDocuments(filter),
    Alert.countDocuments({ ...filter, status: 'ACTIVE' }),
  ])

  return { records, total, page, limit, unreadCount }
}

export async function getAlert(alertId: string, user: CurrentUser): Promise<IAlert> {
  const alert = await Alert.findById(alertId)
  if (!alert) throw NotFoundError('Không tìm thấy cảnh báo')
  await assertFarmAccess(String(alert.farm_id), user)
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

/** Dùng cho job phát hiện thiết bị offline (FARM-FR-005 → THREAT-FR-009) */
export async function raiseNodeOfflineAlert(nodeId: string): Promise<void> {
  const node = await SensorNode.findById(nodeId).lean()
  if (!node) return
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
