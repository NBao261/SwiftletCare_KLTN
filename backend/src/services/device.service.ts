import { SensorNode, CameraNode, ISensorNode, ICameraNode, IN_SERVICE, CAMERA_STATUSES, type CameraStatus } from '@/models/device.model'
import { House, Zone } from '@/models/houseZone.model'
import { Farm } from '@/models/farm.model'
import { Alert } from '@/models/alert.model'
import {
  findZoneChainOrThrow, findHouseChainOrThrow, assertZoneAccess, assertHouseAccess, assertHouseAccessByParams,
  listAccessibleZoneIds, listAccessibleHouseIds, listActiveZoneIds, listActiveHouseIds,
} from '@/utils/farmAccess.util'
import { publishDeviceCommand, publishDeviceConfig } from '@/mqtt/mqtt.client'
import { publishNodeConfig, publishZoneConfig } from '@/services/deviceConfig.service'
import { emitRelayUpdate, emitDeviceStatusChange, emitHouseDeviceStatusChange } from '@/socket'
import { raiseCameraLowFpsAlert, raiseCameraOfflineAlert, raiseNodeOfflineAlert, resolveAlertsForNode } from '@/services/alert.service'
import { logAction } from '@/services/auditLog.service'
import { noteDeviceReplaced } from '@/services/workOrder.service'
import { notifyExpertDecision } from '@/services/expertActivity.service'
import { trackParameterChange, type ReviewApplyOptions } from '@/services/parameterReview.service'
import { findRecipients, notifyUser, type UserNotification } from '@/services/notification.service'
import { verifyActivationKey, markClaimed } from '@/services/provisionedDevice.service'
import { assertNotInRollout, onControllerHeartbeat, onOtaTimedOut } from '@/services/firmwareRollout.service'
import { THRESHOLD_HISTORY_LIMIT } from '@/utils/thresholdUpdate.util'
import { syncAfterHeartbeat } from '@/utils/configSync.util'
import { COMMAND_SUPPORT_SINCE, OTA_CONFIRM_TIMEOUT_MS, versionAtLeast } from '@/utils/firmwareImage.util'
import { sessionWindowsAhead, vnDateOf } from '@/utils/countingSchedule.util'
import { DEVICE_STATUS_LABEL, formatVnDateTime } from '@/utils/displayLabel.util'
import {
  closeOrphanedOverrideLogs, closeOverrideLogs, closeOverrideLogFromDevice, closeRelayOverrideLog,
  openOverrideLog, openOverrideStates, DEVICE_CONFIRM_GRACE_MS,
} from '@/services/relayOverrideLog.service'
import { AppError, NotFoundError, ForbiddenError, ConflictError, BadRequestError, ServiceUnavailableError, NotImplementedError } from '@/utils/appError.util'
import { clampRemainingMs, parseHeartbeatBasics } from '@/utils/deviceInput.util'
import logger from '@/utils/logger.util'
import type { AlertType, ControlMode, RelayStates, HeartbeatPayload, RelayStatusPayload, CurrentUser, DeviceStatus, WsDeviceStatusChange, CountingRing } from '@/types'

// IN4 dự phòng, không còn sưởi
export const RELAY_NAMES = ['misting', 'speaker', 'ventilation'] as const
type RelayName = typeof RELAY_NAMES[number]

const perRelay = <T>(value: (name: RelayName) => T) =>
  Object.fromEntries(RELAY_NAMES.map(name => [name, value(name)])) as Record<RelayName, T>

// control_mode, override_expiry là tóm tắt của relays
function syncOverrideSummary(node: ISensorNode): void {
  const expiries = RELAY_NAMES.filter(name => node.relays[name].mode === 'MANUAL').map(name => node.relays[name].override_expiry?.getTime() ?? 0)
  node.control_mode = expiries.length > 0 ? 'MANUAL' : 'AUTO'
  const latest = Math.max(0, ...expiries)
  node.override_expiry = latest > 0 ? new Date(latest) : undefined
}

function setRelayAuto(node: ISensorNode, name: RelayName): void {
  const relay = node.relays[name]
  relay.mode = 'AUTO'
  relay.override_expiry = undefined
  relay.override_by = undefined
}

function resetOverrides(node: ISensorNode): void {
  RELAY_NAMES.forEach(name => setRelayAuto(node, name))
  syncOverrideSummary(node)
}

// 1 lệnh ghi: job hết hạn không được đè override vừa bật giữa lúc đọc và ghi
async function refreshOverrideSummary(nodeId: unknown): Promise<void> {
  const expiries = RELAY_NAMES.map(name => ({ $cond: [{ $eq: [`$relays.${name}.mode`, 'MANUAL'] }, `$relays.${name}.override_expiry`, null] }))
  await SensorNode.updateOne({ _id: nodeId }, [
    { $set: { override_expiry: { $ifNull: [{ $max: expiries }, '$$REMOVE'] } } },
    { $set: { control_mode: { $cond: [{ $gt: ['$override_expiry', null] }, 'MANUAL', 'AUTO'] } } },
  ])
}
const DEFAULT_OVERRIDE_MS = 30 * 60 * 1000
// 24 giờ chọn tay. Tối thiểu 2 × DEVICE_CONFIRM_GRACE_MS, ngắn hơn thì tin AUTO lúc hết hạn bị coi là cũ
export const MIN_OVERRIDE_MS = 2 * DEVICE_CONFIRM_GRACE_MS
export const MAX_OVERRIDE_MS = 24 * 60 * 60 * 1000
// lệnh bị quên không được chạy bơm hàng giờ trên cảm biến hỏng
export const MAX_PUMP_ON_OVERRIDE_MS = 30 * 60 * 1000
// có cảnh báo loại này thì bật bơm phải được xác nhận
export const PUMP_CONFIRM_ALERT_TYPES: AlertType[] = ['SENSOR_FAULT', 'RS485_BUS_FAILURE', 'MISTING_INEFFECTIVE']

export const OFFLINE_THRESHOLD_MS = 30_000
// Heartbeat mỗi 30 s. 90 s = 3 nhịp liền mất, chọn tay
export const CAMERA_OFFLINE_THRESHOLD_MS = 90_000
export const MIN_AI_FPS = 10

export interface RegisterDeviceInput { device_id: string; zone_id: string; secret_key: string }

// Nói rõ thuộc farm khác hay chỉ đăng ký trùng trong farm
async function assertNotRegistered(
  existing: { zoneId?: unknown; houseId?: unknown }, targetFarmId: string,
): Promise<never> {
  const chain = existing.houseId
    ? await findHouseChainOrThrow(String(existing.houseId)).catch(() => null)
    : await findZoneChainOrThrow(String(existing.zoneId)).catch(() => null)
  if (chain && String(chain.farm._id) !== targetFarmId) {
    throw ConflictError('Thiết bị đã thuộc về Farm khác', 'DEVICE_IN_OTHER_FARM')
  }
  throw ConflictError('device_id đã được đăng ký', 'DEVICE_ALREADY_REGISTERED')
}

// device_id unique nên đổi tên bản ghi cũ; giữ _id để lịch sử vẫn trỏ đúng
async function retireDeviceId(Model: typeof SensorNode, nodeId: unknown, deviceId: string): Promise<void> {
  await Model.updateOne({ _id: nodeId }, { device_id: `${deviceId}#retired-${Date.now()}` })
}

// Không throw: thông báo hỏng không được làm hỏng thao tác thiết bị
async function notifyOwnersOfTechnicianAction(
  user: CurrentUser, farmId: unknown, deviceId: unknown, message: UserNotification,
): Promise<void> {
  if (user.role !== 'ADMIN' && user.role !== 'FARM_TECHNICIAN') return
  try {
    const owners = await findRecipients(String(farmId))
    const withRef = { ...message, ref: { kind: 'device_action' as const, id: String(deviceId) } }
    await Promise.all(owners.map(o => notifyUser(String(o._id), withRef)))
  } catch (err) {
    logger.warn('Báo Farm Owner về thao tác thiết bị của Technician thất bại', { err, farmId: String(farmId), title: message.title })
  }
}

// Vị trí lắp không thuộc người đăng ký: code riêng để màn thiết lập nói đúng lý do
async function inSetupLocation<T>(find: () => Promise<T>): Promise<T> {
  try {
    return await find()
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 403) {
      throw ForbiddenError('Bạn không thiết lập được thiết bị ở vị trí này', 'SETUP_LOCATION_NOT_ALLOWED')
    }
    throw err
  }
}

// Tạo ở PENDING, chỉ ONLINE khi có heartbeat đầu tiên
export async function registerSensorNode(user: CurrentUser, input: RegisterDeviceInput): Promise<ISensorNode> {
  const { zone, farm } = await inSetupLocation(() => assertZoneAccess(input.zone_id, user, 'device'))
  const { simulated } = await verifyActivationKey(input.device_id, 'SENSOR', input.secret_key)

  const existing = await SensorNode.findOne({ device_id: input.device_id }).select('zone_id decommissioned_at').lean()
  if (existing?.decommissioned_at) await retireDeviceId(SensorNode, existing._id, input.device_id)
  else if (existing) await assertNotRegistered({ zoneId: existing.zone_id }, String(farm._id))

  const node = await SensorNode.create({
    device_id: input.device_id, zone_id: input.zone_id, status: 'PENDING', registered_by: user._id, simulated,
  })
  await markClaimed(input.device_id)
  await logAction(user._id, 'DEVICE_REGISTERED', 'sensor_node', String(node._id), {
    deviceId: input.device_id, zoneId: input.zone_id,
  })
  await notifyOwnersOfTechnicianAction(user, farm._id, node._id, {
    title: 'Kỹ thuật viên đã đăng ký thiết bị',
    body: `${input.device_id} đã được đăng ký vào Zone "${zone.name}".`,
  })
  return node
}

// Không có zoneId thì lọc theo zone được xem, không trả mọi thiết bị
export async function listSensorNodes(zoneId: string | undefined, user: CurrentUser, removed?: 'recent'): Promise<ISensorNode[]> {
  let scope: Record<string, unknown>
  if (zoneId) {
    await assertZoneAccess(zoneId, user, 'device')
    scope = { zone_id: zoneId }
  } else {
    scope = { zone_id: { $in: await listAccessibleZoneIds(user, 'device') } }
  }
  if (removed === 'recent') return listRestorableDevices('sensor', scope, user) as unknown as ISensorNode[]
  return SensorNode.find({ ...scope, ...IN_SERVICE }).sort({ registered_at: -1 }).lean() as unknown as ISensorNode[]
}

// Đã gỡ vẫn xem được nhưng không nhận lệnh
export function assertInService(node: { decommissioned_at?: Date }): void {
  if (node.decommissioned_at) throw ConflictError('Thiết bị đã được gỡ bỏ khỏi hệ thống')
}

export async function getSensorNode(nodeId: string, user: CurrentUser): Promise<ISensorNode> {
  const node = await SensorNode.findById(nodeId)
  if (!node) throw NotFoundError('Không tìm thấy thiết bị')
  await assertZoneAccess(String(node.zone_id), user, 'device')
  return node
}

export async function controlRelay(
  nodeId: string,
  user: CurrentUser,
  input: { relayName: string; state: boolean; durationMs?: number; confirmed?: boolean },
): Promise<{ node: ISensorNode; delivered: boolean }> {
  const node = await SensorNode.findById(nodeId)
  if (!node) throw NotFoundError('Không tìm thấy thiết bị')
  assertInService(node)
  const chain = await assertZoneAccess(String(node.zone_id), user)

  if (!RELAY_NAMES.includes(input.relayName as RelayName)) {
    throw BadRequestError(`relayName phải là 1 trong: ${RELAY_NAMES.join(', ')}`)
  }
  const overrideMs = input.durationMs ?? DEFAULT_OVERRIDE_MS
  const alertConfirmed = await assertPumpOnAllowed(String(node.zone_id), input, overrideMs)

  // Cập nhật lạc quan; ESP32 xác nhận qua relay/status
  const relayName = input.relayName as RelayName
  const expiresAt = new Date(Date.now() + overrideMs)
  node.relay_states[relayName] = input.state
  // các relay khác giữ hạn của chúng
  Object.assign(node.relays[relayName], { mode: 'MANUAL', override_expiry: expiresAt, override_by: user._id })
  syncOverrideSummary(node)
  await node.save()

  // Không tới broker thì DB vẫn giữ trạng thái mong muốn, nhưng báo thật cho UI qua delivered
  const delivered = publishDeviceCommand(node.device_id, 'RELAY', { relayName, state: input.state, durationMs: overrideMs })

  emitRelayUpdate(String(chain.zone._id), {
    zoneId: String(chain.zone._id),
    relayName,
    state: input.state,
    mode: 'MANUAL',
    overrideExpiry: expiresAt.toISOString(),
  })

  // Ghi sau publish và không throw: lịch sử hỏng không được chặn lệnh
  await openOverrideLog({
    nodeId: node._id, zoneId: chain.zone._id, farmId: chain.farm._id,
    relay: relayName, state: input.state, user, expiresAt, alertConfirmed,
  })
  await logAction(user._id, 'RELAY_OVERRIDE', 'sensor_node', String(node._id), {
    relayName: input.relayName, state: input.state, durationMs: overrideMs, delivered, alertConfirmed,
  })
  return { node, delivered }
}

// Chỉ áp cho BẬT bơm. Trả true khi đã xác nhận trên cảnh báo đang mở
async function assertPumpOnAllowed(
  zoneId: string, input: { relayName: string; state: boolean; confirmed?: boolean }, overrideMs: number,
): Promise<boolean> {
  if (input.relayName !== 'misting' || !input.state) return false
  if (overrideMs > MAX_PUMP_ON_OVERRIDE_MS) {
    throw new AppError(422, 'VALIDATION_ERROR', `Bật bơm tay tối đa ${MAX_PUMP_ON_OVERRIDE_MS / 60_000} phút`)
  }
  const open = await Alert.find({
    zone_id: zoneId, type: { $in: PUMP_CONFIRM_ALERT_TYPES }, status: { $in: ['ACTIVE', 'ACKNOWLEDGED'] },
  }).select('type title created_at').sort({ created_at: -1 }).lean()
  if (open.length === 0) return false
  if (input.confirmed !== true) {
    throw new AppError(409, 'CONFIRMATION_REQUIRED',
      'Zone đang có cảnh báo cảm biến hoặc phun sương. Xác nhận để vẫn bật bơm.',
      open.map(a => ({ _id: String(a._id), type: a.type, title: a.title, created_at: a.created_at })))
  }
  return true
}

// Không có relayName thì mọi relay về AUTO
export async function clearRelayOverride(nodeId: string, user: CurrentUser, relayName?: RelayName): Promise<ISensorNode> {
  const node = await SensorNode.findById(nodeId)
  if (!node) throw NotFoundError('Không tìm thấy thiết bị')
  assertInService(node)
  const chain = await assertZoneAccess(String(node.zone_id), user)
  if (node.control_mode === 'AUTO') return node
  if (relayName) return clearOneRelayOverride(node, chain, user, relayName)

  resetOverrides(node)
  await node.save()

  const zoneId = String(chain.zone._id)
  publishDeviceCommand(node.device_id, 'CLEAR_OVERRIDE')
  for (const name of RELAY_NAMES) {
    emitRelayUpdate(zoneId, { zoneId, relayName: name, state: node.relay_states[name], mode: 'AUTO' })
  }
  await closeOverrideLogs([node._id], 'CLEARED_EARLY')
  await logAction(user._id, 'RELAY_OVERRIDE_CLEARED', 'sensor_node', String(node._id), {})
  return node
}

// Relay không đang tay thì không làm gì
async function clearOneRelayOverride(
  node: ISensorNode, chain: Awaited<ReturnType<typeof assertZoneAccess>>, user: CurrentUser, relayName: RelayName,
): Promise<ISensorNode> {
  if (node.relays[relayName].mode !== 'MANUAL') return node
  const zoneId = String(chain.zone._id)
  publishDeviceCommand(node.device_id, 'CLEAR_OVERRIDE', { relayName })
  await closeRelayOverrideLog(node._id, relayName, 'CLEARED_EARLY')
  setRelayAuto(node, relayName)
  syncOverrideSummary(node)
  await node.save()
  emitRelayUpdate(zoneId, { zoneId, relayName, state: node.relay_states[relayName], mode: 'AUTO' })
  await logAction(user._id, 'RELAY_OVERRIDE_CLEARED', 'sensor_node', String(node._id), { relayName })
  return node
}

// chỉ đổi DB rồi publish lại config retained; offline thì nhận khi kết nối lại
export async function reassignZone(
  nodeId: string,
  user: CurrentUser,
  input: { newZoneId: string },
): Promise<{ node: ISensorNode; delivered: boolean }> {
  const node = await SensorNode.findById(nodeId)
  if (!node) throw NotFoundError('Không tìm thấy thiết bị')
  assertInService(node)

  // Kiểm quyền cả farm nguồn lẫn đích
  const sourceChain = await assertZoneAccess(String(node.zone_id), user, 'device')
  // Dời về chính Zone đang ở chỉ ghi audit sai
  if (String(sourceChain.zone._id) === input.newZoneId) {
    throw BadRequestError('Thiết bị đã ở Zone này, hãy chọn Zone khác để dời')
  }
  const destChain = await assertZoneAccess(input.newZoneId, user, 'device')

  // Override đang chạy thuộc Zone cũ nên kết thúc ở đây
  node.zone_id = destChain.zone._id
  resetOverrides(node)
  node.config_sync = 'PENDING'
  node.config_stale_heartbeats = 0
  await node.save()
  // Không có khởi động lại nên phải tự huỷ override trên thiết bị
  const overrideCleared = publishDeviceCommand(node.device_id, 'CLEAR_OVERRIDE')
  // tăng phiên bản Zone đích để số cũ không trùng mà bị coi là đã áp
  const delivered = (await publishZoneConfig(destChain.zone._id)) && overrideCleared
  await closeOverrideLogs([node._id], 'CLEARED_EARLY')
  // Để lại thì job gửi lại cho Farm Owner farm cũ; sự cố thật sẽ được báo lại
  await resolveAlertsForNode(String(node._id), 'Thiết bị đã dời sang Zone khác')

  await logAction(user._id, 'DEVICE_REASSIGNED', 'sensor_node', String(node._id), {
    fromZoneId: String(sourceChain.zone._id), toZoneId: String(destChain.zone._id), delivered,
  })
  const moved = {
    title: 'Kỹ thuật viên đã dời thiết bị',
    body: `${node.device_id} đã được dời từ Zone "${sourceChain.zone.name}" sang Zone "${destChain.zone.name}".`,
  }
  await notifyOwnersOfTechnicianAction(user, destChain.farm._id, node._id, moved)
  if (String(sourceChain.farm._id) !== String(destChain.farm._id)) await notifyOwnersOfTechnicianAction(user, sourceChain.farm._id, node._id, moved)
  return { node, delivered }
}

export interface RegisterCameraInput {
  device_id: string; secret_key: string
  house_id?: string
  zone_id?: string
}

// Camera ở cửa của cả nhà nên gắn House
export async function registerCameraNode(user: CurrentUser, input: RegisterCameraInput) {
  const { house, farm } = await inSetupLocation(() => assertHouseAccessByParams({ houseId: input.house_id, zoneId: input.zone_id }, user, 'device'))
  const { simulated } = await verifyActivationKey(input.device_id, 'CAMERA', input.secret_key)

  const existing = await CameraNode.findOne({ device_id: input.device_id }).select('house_id decommissioned_at').lean()
  if (existing?.decommissioned_at) await retireDeviceId(CameraNode as never, existing._id, input.device_id)
  else if (existing) await assertNotRegistered({ houseId: existing.house_id }, String(farm._id))

  // Chọn field tường minh: không cho client tự đặt status
  const node = await CameraNode.create({
    device_id: input.device_id, house_id: house._id,
    status: 'PENDING', registered_by: user._id, simulated,
  })
  await markClaimed(input.device_id)
  await logAction(user._id, 'DEVICE_REGISTERED', 'camera_node', String(node._id), {
    deviceId: input.device_id, houseId: String(house._id),
  })
  await notifyOwnersOfTechnicianAction(user, farm._id, node._id, {
    title: 'Kỹ thuật viên đã đăng ký thiết bị',
    body: `Camera ${input.device_id} đã được đăng ký vào nhà "${house.name}".`,
  })
  return node
}

// Chứa mật khẩu camera, không trả ra API
const CAMERA_PUBLIC_FIELDS = '-rtsp_url'

// zoneId cũ: quy ra House chứa Zone
export async function listCameraNodes(
  params: { houseId?: string; zoneId?: string; removed?: 'recent' }, user: CurrentUser,
): Promise<Array<Omit<ICameraNode, 'rtsp_url'>>> {
  let scope: Record<string, unknown>
  if (params.houseId || params.zoneId) {
    const { house } = await assertHouseAccessByParams(params, user, 'device')
    scope = { house_id: house._id }
  } else {
    scope = { house_id: { $in: await listAccessibleHouseIds(user, 'device') } }
  }
  if (params.removed === 'recent') return listRestorableDevices('camera', scope, user) as unknown as ICameraNode[]
  return CameraNode.find({ ...scope, ...IN_SERVICE }).select(CAMERA_PUBLIC_FIELDS).sort({ registered_at: -1 }).lean() as unknown as ICameraNode[]
}

// deviceId trong tin đã khớp topic ở mqtt.client
export async function recordHeartbeat(payload: HeartbeatPayload): Promise<void> {
  if (!payload.deviceId) throw NotFoundError('Thiếu deviceId trong heartbeat payload')

  const node = await SensorNode.findOne({ device_id: payload.deviceId, ...IN_SERVICE })
  // Nút AI dùng chung topic heartbeat
  if (!node) return recordCameraHeartbeat(payload)

  const wasOffline = node.status !== 'ONLINE'
  // Giá trị sai kiểu thì bỏ: một trường lạ không được làm mất cả heartbeat
  const { rssi, firmwareVersion } = parseHeartbeatBasics(payload as unknown as Record<string, unknown>)
  node.status = 'ONLINE'
  node.last_heartbeat = new Date()
  if (rssi !== undefined) node.rssi = rssi
  if (firmwareVersion) node.firmware_version = firmwareVersion
  applyDiagnostics(node, payload)
  const zone = await Zone.findById(node.zone_id).select('config_version').lean()
  const sync = syncAfterHeartbeat({ stale: node.config_stale_heartbeats ?? 0 }, payload.appliedConfigVersion, zone?.config_version ?? 0)
  node.config_sync = sync.state
  node.applied_config_version = sync.applied
  node.config_stale_heartbeats = sync.stale
  // Heartbeat chạy đúng bản mới = OTA thành công
  const otaDone = node.ota_pending && firmwareVersion === node.ota_pending.version ? node.ota_pending : null
  if (otaDone) node.ota_pending = undefined
  node.activation_overdue_at = undefined
  await node.save()

  if (otaDone) {
    await logAction(otaDone.requested_by ? String(otaDone.requested_by) : undefined, 'DEVICE_OTA_SUCCEEDED', 'sensor_node', String(node._id), {
      deviceId: node.device_id, version: otaDone.version,
    })
  }

  if (wasOffline) await announceBackOnline(node)

  // Máy đang chờ trong một đợt cập nhật firmware nhận lệnh ngay khi online lại
  await onControllerHeartbeat(node._id, firmwareVersion)
    .catch((err: Error) => logger.warn('Không xử lý được đợt cập nhật firmware của thiết bị', { deviceId: payload.deviceId, err: err.message }))

  // Gửi lại để lấp lần publish lỡ khi backend mất broker
  if (payload.justConnected || wasOffline) {
    await findZoneChainOrThrow(String(node.zone_id))
      .then(chain => publishNodeConfig(chain.zone, node))
      .catch((err: Error) => logger.warn('Không gửi lại được cấu hình thiết bị', { deviceId: payload.deviceId, err: err.message }))
  }
}

// Payload không đáng tin: chỉ nhận đúng kiểu, chuỗi có giới hạn. uptime đổi thành booted_at
function applyDiagnostics(node: ISensorNode, payload: HeartbeatPayload): void {
  const { uptime, freeHeap, resetReason, ip, actuatorBaseline } = payload as unknown as Record<string, unknown>
  const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
  if (isCount(uptime)) node.booted_at = new Date(Date.now() - uptime)
  if (isCount(freeHeap)) node.free_heap = freeHeap
  if (typeof resetReason === 'string' && resetReason.length <= 32) node.reset_reason = resetReason
  if (typeof ip === 'string' && ip.length <= 45) node.ip = ip
  // chỉ nhận số dương
  if (actuatorBaseline && typeof actuatorBaseline === 'object') {
    const { misting, ventilation } = actuatorBaseline as Record<string, unknown>
    const amps = (v: unknown) => (isCount(v) && v > 0 ? v : undefined)
    node.actuator_baseline = {
      misting_a: amps(misting) ?? node.actuator_baseline?.misting_a,
      ventilation_a: amps(ventilation) ?? node.actuator_baseline?.ventilation_a,
    }
  }
}

// firmwareVersion của nút AI là phiên bản model
async function recordCameraHeartbeat(payload: HeartbeatPayload): Promise<void> {
  const camera = await CameraNode.findOne({ device_id: payload.deviceId, ...IN_SERVICE })
  if (!camera) throw NotFoundError(`Không tìm thấy thiết bị với device_id="${payload.deviceId}"`)

  const wasOnline = camera.status === 'ONLINE'
  camera.status = 'ONLINE'
  camera.last_heartbeat = new Date()
  const { modelVersion, fps } = parseHeartbeatBasics(payload as unknown as Record<string, unknown>)
  if (modelVersion) camera.model_version = modelVersion
  if (fps !== undefined) camera.fps = fps
  const defaults = parseDefaultRings(payload.defaultRings)
  if (defaults) camera.default_rings = defaults.length ? defaults : undefined
  // Payload không đáng tin: chỉ nhận giá trị trong danh sách
  const cameraStatus = payload.cameraStatus
  if (typeof cameraStatus === 'string' && (CAMERA_STATUSES as readonly string[]).includes(cameraStatus)) {
    if (camera.camera_status !== cameraStatus) camera.camera_status_at = new Date()
    camera.camera_status = cameraStatus as CameraStatus
  }
  camera.activation_overdue_at = undefined
  await camera.save()
  if (payload.justConnected || !wasOnline) await pushCameraConfig(camera)
  if (!wasOnline) {
    emitHouseDeviceStatusChange(String(camera.house_id), {
      nodeId: String(camera._id),
      status: 'ONLINE',
      timestamp: new Date().toISOString(),
    })
    await resolveAlertsForNode(String(camera._id), 'Camera đếm chim đã kết nối lại', 'EDGE_AI_DEGRADED').catch((err: Error) =>
      logger.error('Đóng cảnh báo EDGE_AI_DEGRADED thất bại', { nodeId: String(camera._id), err }),
    )
  }
  await checkCameraFps(String(camera._id), fps)
}

// fps <= 0 là chưa đo (heartbeat đầu khi khởi động), xét sẽ thành cảnh báo giả. Không throw
async function checkCameraFps(cameraId: string, fps: number | undefined): Promise<void> {
  if (typeof fps !== 'number' || !Number.isFinite(fps) || fps <= 0) return
  try {
    if (fps < MIN_AI_FPS) await raiseCameraLowFpsAlert(cameraId, fps, MIN_AI_FPS)
    else await resolveAlertsForNode(cameraId, 'Camera đếm chim xử lý đủ khung hình trở lại', 'EDGE_AI_DEGRADED')
  } catch (err) {
    logger.error('Kiểm tra số khung hình của nút AI thất bại', { nodeId: cameraId, fps, err })
  }
}

// updateOne vì được gọi dày
export async function markNodeSeen(node: Pick<ISensorNode, '_id' | 'zone_id' | 'status'>): Promise<void> {
  await SensorNode.updateOne({ _id: node._id }, { status: 'ONLINE', last_heartbeat: new Date() })
  if (node.status !== 'ONLINE') await announceBackOnline(node)
}

// Heartbeat và telemetry tới không theo thứ tự nên cả 2 phải đóng NODE_OFFLINE
async function announceBackOnline(node: Pick<ISensorNode, '_id' | 'zone_id'>): Promise<void> {
  emitDeviceStatusChange(String(node.zone_id), {
    nodeId: String(node._id),
    status: 'ONLINE',
    timestamp: new Date().toISOString(),
  })
  // Lỗi ở đây không được chặn bước gửi lại cấu hình; cảnh báo sót được job dọn
  await resolveAlertsForNode(String(node._id), 'Thiết bị đã kết nối lại', 'NODE_OFFLINE').catch((err: Error) =>
    logger.error('Đóng cảnh báo NODE_OFFLINE thất bại', { nodeId: String(node._id), err }),
  )
}



export interface SpeakerScheduleInput {
  enabled?: boolean
  windows?: Array<{ start: string; end: string }>
  volume?: number
  track?: number
}

export async function updateSpeakerSchedule(nodeId: string, user: CurrentUser, input: SpeakerScheduleInput): Promise<ISensorNode> {
  const node = await SensorNode.findById(nodeId)
  if (!node) throw NotFoundError('Không tìm thấy thiết bị')
  assertInService(node)
  const chain = await assertZoneAccess(String(node.zone_id), user)

  // "HH:00" cùng 2 chữ số nên so chuỗi = so giờ
  const badWindow = input.windows?.find(w => w.start >= w.end)
  if (badWindow) throw BadRequestError(`Khung giờ ${badWindow.start}-${badWindow.end} không hợp lệ: giờ bắt đầu phải trước giờ kết thúc`)

  if (input.enabled !== undefined) node.speaker_schedule.enabled = input.enabled
  if (input.windows) node.speaker_schedule.windows = input.windows.map(({ start, end }) => ({ start, end }))
  if (input.volume !== undefined) node.audio.volume = input.volume
  if (input.track !== undefined) node.audio.current_track = input.track
  await node.save()

  publishNodeConfig(chain.zone, node)
  await logAction(user._id, 'SPEAKER_SCHEDULE_UPDATED', 'sensor_node', String(node._id), { ...input })
  return node
}

// Chiều ngược lại của recordHeartbeat
export async function markStaleDevicesOffline(): Promise<void> {
  const staleBefore = new Date(Date.now() - OFFLINE_THRESHOLD_MS)
  const staleNodes = await SensorNode.find({ status: 'ONLINE', last_heartbeat: { $lt: staleBefore } })
    .select('_id zone_id')
    .lean()

  // Lỗi ở SensorNode không được bỏ qua lượt quét camera
  try {
    await Promise.all(staleNodes.map(async node => {
      // Lặp lại điều kiện trong lệnh ghi: heartbeat tới giữa chừng thì không đè OFFLINE
      const { modifiedCount } = await SensorNode.updateOne(
        { _id: node._id, status: 'ONLINE', last_heartbeat: { $lt: staleBefore } },
        { status: 'OFFLINE' },
      )
      if (modifiedCount === 0) return

      emitDeviceStatusChange(String(node.zone_id), {
        nodeId: String(node._id),
        status: 'OFFLINE',
        timestamp: new Date().toISOString(),
      })
      await raiseNodeOfflineAlert(String(node._id)).catch((err: Error) =>
        logger.error('Tạo cảnh báo NODE_OFFLINE thất bại', { nodeId: String(node._id), err }),
      )
    }))
  } finally {
    await markStaleCamerasOffline()
  }
}

async function markStaleCamerasOffline(): Promise<void> {
  const staleBefore = new Date(Date.now() - CAMERA_OFFLINE_THRESHOLD_MS)
  const stale = await CameraNode.find({ status: 'ONLINE', last_heartbeat: { $lt: staleBefore } }).select('_id house_id').lean()

  await Promise.all(stale.map(async camera => {
    // Như SensorNode
    // Tình trạng camera cũ không còn đúng khi nút AI im: web hiện "chưa báo" thay vì "Đang nhận hình"
    const { modifiedCount } = await CameraNode.updateOne(
      { _id: camera._id, status: 'ONLINE', last_heartbeat: { $lt: staleBefore } },
      { status: 'OFFLINE', $unset: { camera_status: '', camera_status_at: '' } },
    )
    if (modifiedCount === 0) return

    emitHouseDeviceStatusChange(String(camera.house_id), {
      nodeId: String(camera._id),
      status: 'OFFLINE',
      timestamp: new Date().toISOString(),
    })
    await raiseCameraOfflineAlert(String(camera._id)).catch((err: Error) =>
      logger.error('Tạo cảnh báo EDGE_AI_DEGRADED thất bại', { nodeId: String(camera._id), err }),
    )
  }))
}

export type DeviceKind = 'sensor' | 'camera'
const DEVICE_MODELS = { sensor: SensorNode, camera: CameraNode as unknown as typeof SensorNode }
const TARGET_TYPES = { sensor: 'sensor_node', camera: 'camera_node' } as const

async function locateDevice(kind: DeviceKind, node: { zone_id?: unknown; house_id?: unknown }, user: CurrentUser) {
  if (kind === 'camera') {
    const { house, farm } = await assertHouseAccess(String(node.house_id), user, 'device')
    const houseId = String(house._id)
    return {
      farm, place: `nhà "${house.name}"`, audit: { houseId },
      emitStatus: (data: WsDeviceStatusChange) => emitHouseDeviceStatusChange(houseId, data),
    }
  }
  const { zone, farm } = await assertZoneAccess(String(node.zone_id), user, 'device')
  const zoneId = String(zone._id)
  return {
    farm, place: `Zone "${zone.name}"`, audit: { zoneId },
    emitStatus: (data: WsDeviceStatusChange) => emitDeviceStatusChange(zoneId, data),
  }
}


// Giữ document vì telemetry/alert tham chiếu node_id
export async function decommissionDevice(
  kind: DeviceKind, nodeId: string, user: CurrentUser, reason: string,
  opts: { replacedBy?: unknown; force?: boolean } = {},
) {
  const { replacedBy, force } = opts
  const Model = DEVICE_MODELS[kind]
  const node = await Model.findById(nodeId)
  if (!node) throw NotFoundError('Không tìm thấy thiết bị')
  const loc = await locateDevice(kind, node, user)
  assertInService(node)

  // Gỡ thiết bị đang sống là mất giám sát cả Zone: bắt gửi force
  const isAlive = node.status === 'ONLINE'
  if (isAlive && force !== true) {
    const lastSeen = node.last_heartbeat ? ` (lần cuối lúc ${formatVnDateTime(node.last_heartbeat)})` : ''
    throw ConflictError(
      `Thiết bị đang kết nối${lastSeen}, gỡ sẽ mất giám sát tại ${loc.place}. ` +
      'Gửi kèm force=true nếu vẫn muốn gỡ.',
    )
  }

  node.decommissioned_at = new Date()
  node.decommission_reason = reason
  node.status = 'OFFLINE'
  // Để lại thì job hết hạn gửi clear_override cho thiết bị thay thế
  resetOverrides(node)
  if (replacedBy) node.replaced_by = replacedBy as never
  await node.save()
  await closeOverrideLogs([node._id], 'CLEARED_EARLY')

  loc.emitStatus({ nodeId: String(node._id), status: 'OFFLINE', timestamp: new Date().toISOString() })

  const closedAlerts = await resolveAlertsForNode(String(node._id), `Thiết bị đã được gỡ bỏ: ${reason}`)

  await logAction(user._id, 'DEVICE_DECOMMISSIONED', TARGET_TYPES[kind], String(node._id), {
    deviceId: node.device_id, ...loc.audit, reason,
    replacedBy: replacedBy ? String(replacedBy) : null, closedAlerts,
    ...(isAlive ? { forcedWhileOnline: true } : {}),
  })

  await notifyOwnersOfTechnicianAction(user, loc.farm._id, node._id, {
    title: 'Thiết bị đã được gỡ khỏi nhà yến',
    body: `Kỹ thuật viên đã gỡ ${node.device_id} khỏi ${loc.place}. Lý do: ${reason}`,
  })
  return node
}

export const RESTORE_WINDOW_MS = 24 * 60 * 60 * 1000
const RETIRED_SUFFIX = '#retired-'

// Cùng điều kiện với restoreDevice
async function listRestorableDevices(kind: DeviceKind, scope: Record<string, unknown>, user: CurrentUser) {
  if (user.role !== 'FARM_OWNER' && user.role !== 'FARM_TECHNICIAN') throw ForbiddenError('Chỉ chủ nhà yến và kỹ thuật viên của nhà xem và khôi phục thiết bị đã gỡ')
  const Model = DEVICE_MODELS[kind]
  const removed = await Model.find({
    ...scope,
    decommissioned_at: { $gte: new Date(Date.now() - RESTORE_WINDOW_MS) },
    device_id: { $not: new RegExp(RETIRED_SUFFIX) },
  }).select(kind === 'camera' ? CAMERA_PUBLIC_FIELDS : '').sort({ decommissioned_at: -1 }).lean()
  const replacementIds = removed.map(node => node.replaced_by).filter(Boolean)
  const liveReplacements = new Set(
    (await Model.find({ _id: { $in: replacementIds }, ...IN_SERVICE }).select('_id').lean()).map(node => String(node._id)),
  )
  return removed
    .filter(node => !node.replaced_by || !liveReplacements.has(String(node.replaced_by)))
    .map(node => ({ ...node, restorable_until: new Date((node.decommissioned_at as Date).getTime() + RESTORE_WINDOW_MS) }))
}

// Chỉ trong 24 giờ và khi device_id chưa bị đăng ký lại hay thay thế, không thì 2 thiết bị sống cùng ID
export async function restoreDevice(kind: DeviceKind, nodeId: string, user: CurrentUser, reason: string) {
  const Model = DEVICE_MODELS[kind]
  const node = await Model.findById(nodeId)
  if (!node) throw NotFoundError('Không tìm thấy thiết bị')
  const loc = await locateDevice(kind, node, user)
  if (!node.decommissioned_at) throw ConflictError('Thiết bị này chưa bị gỡ nên không cần khôi phục')

  const elapsed = Date.now() - node.decommissioned_at.getTime()
  if (elapsed > RESTORE_WINDOW_MS) {
    throw ConflictError(
      `Thiết bị đã gỡ quá ${RESTORE_WINDOW_MS / 3600_000} giờ, hãy đăng ký lại như thiết bị mới ` +
      '(lịch sử dữ liệu cũ vẫn tra cứu được theo bản ghi này).',
    )
  }
  if (node.device_id.includes(RETIRED_SUFFIX)) {
    throw ConflictError('Mã thiết bị này đã được đăng ký lại ở chỗ khác nên không khôi phục được')
  }
  if (node.replaced_by) {
    const replacement = await Model.findOne({ _id: node.replaced_by, ...IN_SERVICE }).select('device_id').lean()
    if (replacement) {
      throw ConflictError(`Thiết bị này đã được thay bằng ${replacement.device_id}. Gỡ thiết bị thay thế trước nếu muốn khôi phục`)
    }
  }

  node.decommissioned_at = undefined
  node.decommission_reason = undefined
  node.replaced_by = undefined
  // Để lại thì job quá hạn không báo lần nữa
  node.activation_overdue_at = undefined
  // Chờ heartbeat thật; chưa từng kết nối thì về PENDING để job quá hạn vẫn quét
  node.status = node.last_heartbeat ? 'OFFLINE' : 'PENDING'
  await node.save()

  // Phát đúng trạng thái vừa lưu
  loc.emitStatus({ nodeId: String(node._id), status: node.status, timestamp: new Date().toISOString() })
  await logAction(user._id, 'DEVICE_RESTORED', TARGET_TYPES[kind], String(node._id), {
    deviceId: node.device_id, ...loc.audit, reason, decommissionedForMs: elapsed,
  })
  await notifyOwnersOfTechnicianAction(user, loc.farm._id, node._id, {
    title: 'Thiết bị đã được khôi phục',
    body: `Kỹ thuật viên đã khôi phục ${node.device_id} tại ${loc.place}. Lý do: ${reason}`,
  })
  return node
}

// Tạo node mới trước khi gỡ node cũ: secretKey sai thì node cũ vẫn nguyên
export async function replaceSensorNode(
  nodeId: string, user: CurrentUser, input: { new_device_id: string; secret_key: string; reason: string },
): Promise<{ oldNode: ISensorNode; newNode: ISensorNode }> {
  const old = await SensorNode.findById(nodeId)
  if (!old) throw NotFoundError('Không tìm thấy thiết bị')
  assertInService(old)
  if (old.device_id === input.new_device_id) throw BadRequestError('Thiết bị mới phải có device_id khác thiết bị cũ')

  const newNode = await registerSensorNode(user, {
    device_id: input.new_device_id, zone_id: String(old.zone_id), secret_key: input.secret_key,
  })
  newNode.speaker_schedule = old.speaker_schedule
  newNode.audio = { ...old.audio, playing: false }
  await newNode.save()

  // Thiết bị cũ thường vẫn ONLINE
  const oldNode = await decommissionDevice('sensor', nodeId, user, input.reason, { replacedBy: newNode._id, force: true })
  // Máy đã thay xong: ghi chú phiếu lỗi gặp trục trặc thì thôi, không làm hỏng việc thay
  await noteDeviceReplaced(nodeId, old.device_id, input.new_device_id, user._id)
    .catch(err => logger.warn('Không ghi được việc thay thiết bị vào phiếu công việc', { nodeId, err }))
  await logAction(user._id, 'DEVICE_REPLACED', 'sensor_node', String(old._id), {
    oldDeviceId: old.device_id, newDeviceId: input.new_device_id, newNodeId: String(newNode._id), reason: input.reason,
  })
  return { oldNode, newNode }
}

export type RemoteCommand = 'RESTART' | 'PUSH_CONFIG' | 'OTA'

// Firmware < 1.4.0 bỏ qua command: API báo 202 mà thiết bị không làm gì. Xét theo từng thiết bị
const COMMANDS_NEED_FIRMWARE: RemoteCommand[] = ['RESTART', 'OTA']
export interface RemoteCommandInput {
  command: RemoteCommand
  ota?: { version: string; url: string; sha256: string }
}

// Cả 3 lệnh đi qua config/update, phân biệt bằng command; firmware cũ bỏ qua key lạ
// sha256 do người gửi đặt nên không chống được file độc: chỉ HTTPS và host trong OTA_ALLOWED_HOSTS
function assertAllowedFirmwareUrl(url: string): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw BadRequestError('URL firmware không hợp lệ')
  }
  if (parsed.protocol !== 'https:') throw BadRequestError('Firmware phải tải qua HTTPS')

  const allowed = (process.env.OTA_ALLOWED_HOSTS ?? '').split(',').map(h => h.trim().toLowerCase()).filter(Boolean)
  if (!allowed.includes(parsed.hostname.toLowerCase())) {
    throw BadRequestError(`Host firmware "${parsed.hostname}" không nằm trong danh sách được phép (OTA_ALLOWED_HOSTS)`)
  }
}

export { OTA_CONFIRM_TIMEOUT_MS }

// ESP32 tự rollback và không báo lỗi: chỉ biết qua heartbeat vẫn báo bản cũ
export async function markOtaTimeouts(): Promise<number> {
  const cutoff = new Date(Date.now() - OTA_CONFIRM_TIMEOUT_MS)
  const nodes = await SensorNode.find({ 'ota_pending.requested_at': { $lt: cutoff }, ...IN_SERVICE })
  for (const node of nodes) {
    const pending = node.ota_pending!
    node.ota_failed = { version: pending.version, failed_at: new Date(), running_version: node.firmware_version }
    node.ota_pending = undefined
    await node.save()

    const requester = pending.requested_by ? String(pending.requested_by) : undefined
    await logAction(requester, 'DEVICE_OTA_TIMEOUT', 'sensor_node', String(node._id), {
      deviceId: node.device_id, version: pending.version, runningVersion: node.firmware_version,
    })
    // Máy thuộc một đợt cập nhật: đợt tự dừng và báo người tạo
    if (await onOtaTimedOut(node._id, pending.version, node.firmware_version)) continue
    if (requester) {
      void notifyUser(requester, {
        title: 'Cập nhật firmware không thành công',
        body: `Thiết bị ${node.device_id} vẫn chạy ${node.firmware_version} sau 30 phút (mục tiêu ${pending.version}). Có thể thiết bị đã quay về bản cũ, kiểm tra nhật ký thiết bị.`,
      })
    }
  }
  return nodes.length
}

export async function sendRemoteCommand(nodeId: string, user: CurrentUser, input: RemoteCommandInput) {
  const node = await SensorNode.findById(nodeId)
  if (!node) throw NotFoundError('Không tìm thấy thiết bị')
  assertInService(node)
  const chain = await assertZoneAccess(String(node.zone_id), user, 'device')
  if (user.role !== 'ADMIN' && input.command !== 'RESTART') {
    throw ForbiddenError('Chỉ quản trị viên gửi được lệnh đẩy cấu hình hoặc cập nhật firmware. Chủ nhà yến và kỹ thuật viên chỉ khởi động lại thiết bị')
  }
  // Kiểm lệnh trước trạng thái: URL sai thì báo đúng lý do đó
  if (input.command === 'OTA') {
    if (!input.ota) throw BadRequestError('Lệnh OTA cần version, url, sha256')
    assertAllowedFirmwareUrl(input.ota.url)
    await assertNotInRollout(node._id)
  }
  if (node.status !== 'ONLINE') {
    throw ConflictError(`Thiết bị đang ${DEVICE_STATUS_LABEL[node.status]}, lệnh từ xa chỉ gửi được khi thiết bị đang kết nối`)
  }

  if (COMMANDS_NEED_FIRMWARE.includes(input.command) && !versionAtLeast(node.firmware_version, COMMAND_SUPPORT_SINCE)) {
    throw NotImplementedError(
      `Firmware ${node.firmware_version} trên thiết bị chưa xử lý lệnh ${input.command}. Cần firmware ${COMMAND_SUPPORT_SINCE} trở lên ` +
      '(nạp lần đầu bằng ElegantOTA trong LAN hoặc USB). PUSH_CONFIG vẫn dùng được.',
    )
  }

  let delivered: boolean
  switch (input.command) {
    case 'PUSH_CONFIG':
      // Gửi cả hệ số mờ, lịch loa, không chỉ ngưỡng
      delivered = publishNodeConfig(chain.zone, node)
      break
    case 'RESTART':
      delivered = publishDeviceCommand(node.device_id, 'RESTART')
      break
    case 'OTA': {
      if (!input.ota) throw BadRequestError('Lệnh OTA cần version, url, sha256')
      if (input.ota.version === node.firmware_version) {
        throw ConflictError(`Thiết bị đang chạy đúng phiên bản ${input.ota.version}`)
      }
      const { version, url, sha256 } = input.ota
      delivered = publishDeviceCommand(node.device_id, 'OTA', { version, url, sha256 })
      break
    }
    default:
      throw BadRequestError('command phải là RESTART, PUSH_CONFIG hoặc OTA')
  }

  if (!delivered) {
    // Không ghi ota_pending khi lệnh chưa rời backend
    throw ServiceUnavailableError('Không gửi được lệnh: backend chưa kết nối MQTT broker. Thử lại sau ít phút.')
  }

  if (input.command === 'OTA' && input.ota) {
    node.ota_pending = { version: input.ota.version, url: input.ota.url, requested_at: new Date(), requested_by: user._id as never }
    node.ota_failed = undefined
    await node.save()
  }

  await logAction(user._id, 'DEVICE_COMMAND_SENT', 'sensor_node', String(node._id), {
    deviceId: node.device_id, command: input.command,
    ...(input.ota ? { version: input.ota.version, url: input.ota.url } : {}),
  })
  const actor = user.role === 'ADMIN' ? 'Quản trị viên' : 'Kỹ thuật viên'
  await notifyOwnersOfTechnicianAction(user, chain.farm._id, node._id, {
    title: input.command === 'OTA' ? `${actor} đã cập nhật firmware` : `${actor} đã gửi lệnh tới thiết bị`,
    body: input.command === 'OTA'
      ? `${node.device_id} đang được cập nhật lên firmware ${input.ota?.version}.`
      : `Lệnh ${input.command} đã được gửi tới ${node.device_id} ở Zone "${chain.zone.name}".`,
  })
  return node
}

const ringOf = (ring: CountingRing): CountingRing => ({
  points: ring.points.map(([x, y]) => [x, y]),
  into_ring_is_exit: ring.into_ring_is_exit,
})

const isPoint = (p: unknown): p is [number, number] =>
  Array.isArray(p) && p.length === 2 && p.every(v => typeof v === 'number' && v >= 0 && v <= 1)

// Cùng giới hạn với route vẽ vòng; sai thì bỏ qua, giữ vòng đã lưu
// [] = nút AI không còn vòng mặc định
export function parseDefaultRings(value: unknown): CountingRing[] | null {
  if (!Array.isArray(value) || value.length > 4) return null
  const rings: CountingRing[] = []
  for (const ring of value as unknown[]) {
    if (typeof ring !== 'object' || ring === null) return null
    const { points, into_ring_is_exit } = ring as Record<string, unknown>
    if (!Array.isArray(points) || points.length < 3 || points.length > 12 || !points.every(isPoint)) return null
    if (typeof into_ring_is_exit !== 'boolean') return null
    rings.push({ points: points.map(([x, y]) => [x, y]), into_ring_is_exit })
  }
  return rings
}

// Bản ghi trước khi có nhiều vòng chỉ có counting_ring
export function ringsOf(camera: Pick<ICameraNode, 'counting_ring' | 'counting_rings'>): CountingRing[] {
  if (camera.counting_rings) return camera.counting_rings.map(ringOf)
  return camera.counting_ring ? [ringOf(camera.counting_ring)] : []
}

const CAMERA_CONFIG_FIELDS = 'device_id house_id counting_ring counting_rings'

// Luôn gửi counting_rings: [] để nút AI biết vòng đã xoá. false khi broker chưa kết nối, nút AI nhận lại khi kết nối
// camera_source_version: nút AI thấy đổi thì lấy lại địa chỉ camera qua /agent/camera-source; tin này không chứa mật khẩu.
// camera_source không được chọn mặc định (select: false) nên đọc số phiên bản ở đây, không tin chỗ gọi đã nạp
export async function pushCameraConfig(camera: Pick<ICameraNode, 'device_id' | 'house_id' | 'counting_ring' | 'counting_rings'>,
  now = new Date()): Promise<boolean> {
  const [house, withSource] = await Promise.all([
    House.findById(camera.house_id).select('counting_schedule_history').lean(),
    CameraNode.findOne({ device_id: camera.device_id }).select('+camera_source').lean(),
  ])
  return publishDeviceConfig(camera.device_id, {
    deviceId: camera.device_id,
    counting_rings: ringsOf(camera),
    session_windows: sessionWindowsAhead(house?.counting_schedule_history, vnDateOf(now)),
    camera_source_version: withSource?.camera_source?.version ?? 0,
  })
}

export async function pushHouseCameraConfigs(houseId: unknown): Promise<number> {
  const cameras = await CameraNode.find({ house_id: houseId, ...IN_SERVICE }).select(CAMERA_CONFIG_FIELDS).lean()
  let delivered = 0
  for (const camera of cameras) if (await pushCameraConfig(camera)) delivered++
  return delivered
}

export async function refreshCameraConfigs(now = new Date()): Promise<number> {
  const cameras = await CameraNode.find(IN_SERVICE).select(CAMERA_CONFIG_FIELDS).lean()
  let delivered = 0
  for (const camera of cameras) {
    try {
      if (await pushCameraConfig(camera, now)) delivered++
    } catch (err) {
      logger.error('Gửi config cho nút AI thất bại', { deviceId: camera.device_id, err })
    }
  }
  return delivered
}

// rings: 0–4 vòng, [] = xoá để dùng vòng trong config.yaml. Đổi vòng thì số trước và sau không so được, nên giữ lịch sử.
// firstRing: body một vòng của app mobile cũ, chỉ thay vòng đầu để không mất các vòng vẽ trên web
export async function updateCountingRing(
  cameraNodeId: string, user: CurrentUser, input: { rings: CountingRing[] } | { firstRing: CountingRing },
  opts: ReviewApplyOptions = {},
) {
  const camera = await CameraNode.findById(cameraNodeId)
  if (!camera) throw NotFoundError('Không tìm thấy camera')
  assertInService(camera)
  const { house, farm } = await assertHouseAccess(String(camera.house_id), user)

  const before = ringsOf(camera)
  const after = ('rings' in input ? input.rings : [input.firstRing, ...before.slice(1)]).map(ringOf)
  // Không đổi gì (vd xoá khi chưa vẽ vòng) thì không ghi lịch sử, không báo ai
  if (JSON.stringify(before) === JSON.stringify(after)) {
    const { rtsp_url: _unchangedRtspUrl, ...unchanged } = camera.toObject()
    return { ...unchanged, ring_delivered: await pushCameraConfig(camera) }
  }
  camera.counting_rings = after
  camera.counting_ring = after[0] && { ...after[0], updated_at: new Date(), updated_by: user._id as never }
  camera.counting_ring_history.push({
    changed_by: user._id as never, changed_by_role: user.role, changed_at: new Date(), old_value: before, new_value: after,
  } as never)
  const overflow = camera.counting_ring_history.length - THRESHOLD_HISTORY_LIMIT
  if (overflow > 0) camera.counting_ring_history.splice(0, overflow)
  await camera.save()

  const delivered = await pushCameraConfig(camera)
  const auditId = await logAction(user._id, 'COUNTING_RING_UPDATED', 'camera_node', String(camera._id), {
    before, after, delivered, house_id: String(house._id),
    ...(opts.fromReview && { decided_in: 'parameter_review' }),
  }, { farmId: String(farm._id) })
  await trackParameterChange({ farm, house, camera }, user, 'counting_ring', { rings: before }, { rings: after })
  if (!opts.fromReview) {
    await notifyExpertDecision(user, farm._id, auditId, {
      what: after.length ? 'vẽ lại vòng đếm' : 'xoá vòng đếm', place: `Camera ${camera.device_id}, nhà "${house.name}"`,
      detail: after.length ? `${after.length} vòng` : 'Camera dùng lại vòng mặc định',
    })
  }
  const { rtsp_url: _rtspUrl, ...publicFields } = camera.toObject()
  return { ...publicFields, ring_delivered: delivered }
}

export const ACTIVATION_TIMEOUT_MS = 15 * 60 * 1000

// Chỉ quét SensorNode: camera chưa có kênh kích hoạt riêng, sẽ bị báo quá hạn dù lắp đúng
export async function markOverdueActivations(): Promise<number> {
  const cutoff = new Date(Date.now() - ACTIVATION_TIMEOUT_MS)
  const nodes = await SensorNode.find({
    status: 'PENDING', registered_at: { $lt: cutoff }, activation_overdue_at: null, ...IN_SERVICE,
  }).select('device_id zone_id registered_by').lean()
  if (nodes.length === 0) return 0

  await SensorNode.updateMany({ _id: { $in: nodes.map(n => n._id) } }, { activation_overdue_at: new Date() })
  for (const node of nodes) {
    await logAction(undefined, 'DEVICE_ACTIVATION_OVERDUE', 'sensor_node', String(node._id), {
      deviceId: node.device_id, zoneId: String(node.zone_id),
    })
    if (node.registered_by) {
      void notifyUser(String(node.registered_by), {
        title: 'Thiết bị kích hoạt quá hạn',
        body: `Thiết bị ${node.device_id} chưa kết nối sau 15 phút. Kiểm tra lại chế độ phát Wi-Fi của thiết bị và Wi-Fi của trang trại tại nhà yến.`,
      })
    }
  }
  return nodes.length
}

// Firmware cũng tự hết hạn, nhưng mất kết nối đúng lúc đó thì DB kẹt MANUAL
export async function expireManualOverrides(): Promise<number> {
  const now = new Date()
  const overdue = (name: RelayName) => ({ [`relays.${name}.mode`]: 'MANUAL', [`relays.${name}.override_expiry`]: { $lt: now } })
  const nodes = await SensorNode.find({ $or: RELAY_NAMES.map(overdue), ...IN_SERVICE }).lean()

  // Kiểm lại trong lệnh ghi: relay vừa được gia hạn thì để yên
  const results = await Promise.all(nodes.flatMap(node => RELAY_NAMES.map(async relayName => {
    const expiredAt = node.relays[relayName]?.override_expiry
    if (node.relays[relayName]?.mode !== 'MANUAL' || !expiredAt || expiredAt >= now) return null
    const { modifiedCount } = await SensorNode.updateOne(
      { _id: node._id, ...overdue(relayName) },
      { $set: { [`relays.${relayName}.mode`]: 'AUTO' }, $unset: { [`relays.${relayName}.override_expiry`]: 1, [`relays.${relayName}.override_by`]: 1 } },
    )
    return modifiedCount === 1 ? { node, relayName, expiredAt } : null
  })))
  const reverted = results.filter((r): r is NonNullable<typeof r> => r !== null)
  await Promise.all([...new Set(reverted.map(r => r.node))].map(n => refreshOverrideSummary(n._id)))

  const uniqueZoneIds = [...new Set(reverted.map(r => String(r.node.zone_id)))]
  const chainByZone = new Map(
    await Promise.all(
      uniqueZoneIds.map(async zid => [zid, await findZoneChainOrThrow(zid).catch(() => null)] as const),
    ),
  )

  for (const { node, relayName } of reverted) {
    const chain = chainByZone.get(String(node.zone_id))
    if (!chain) continue
    publishDeviceCommand(node.device_id, 'CLEAR_OVERRIDE', { relayName })
    emitRelayUpdate(String(chain.zone._id), {
      zoneId: String(chain.zone._id),
      relayName,
      state: node.relay_states[relayName],
      mode: 'AUTO',
    })
  }
  // Đóng đúng hạn, không phải giờ job chạy (lệch tỷ lệ tự động)
  await Promise.all(reverted.map(r => closeRelayOverrideLog(r.node._id, r.relayName, 'EXPIRED', r.expiredAt)))
  await closeOrphanedOverrideLogs()
  return reverted.length
}

// Firmware < 1.6.0 chỉ báo 1 chế độ cho cả thiết bị
function reportedRelayModes(payload: RelayStatusPayload, node: ISensorNode): Record<RelayName, ControlMode> {
  if (payload.relays) return perRelay(name => (payload.relays?.[name]?.mode === 'MANUAL' ? 'MANUAL' : 'AUTO'))
  if (payload.control_mode === 'AUTO') return perRelay(() => 'AUTO')
  if (node.control_mode === 'MANUAL') return perRelay(name => node.relays[name].mode)
  return perRelay(() => 'MANUAL')
}

export async function confirmRelayStatus(payload: RelayStatusPayload): Promise<void> {
  if (!payload.deviceId) throw NotFoundError('Thiếu deviceId trong relay/status payload')
  if (!payload.relay_states || typeof payload.relay_states !== 'object') throw BadRequestError('relay/status thiếu relay_states')

  const node = await SensorNode.findOne({ device_id: payload.deviceId, ...IN_SERVICE })
  if (!node) throw NotFoundError(`Không tìm thấy SensorNode với device_id="${payload.deviceId}"`)

  // Không đụng liveness: tin relay/status retained cũ từng hồi sinh thiết bị chết. Firmware < 1.3.0 còn gửi heating
  const states: RelayStates = perRelay(name => !!payload.relay_states[name])
  const reported = reportedRelayModes(payload, node)
  const leftManual = RELAY_NAMES.filter(name => node.relays[name].mode === 'MANUAL' && reported[name] === 'AUTO')
  const manualWithoutExpiry = RELAY_NAMES.filter(name => reported[name] === 'MANUAL' && !node.relays[name].override_expiry)
  const open = leftManual.length > 0 || manualWithoutExpiry.length > 0 ? await openOverrideStates(node._id) : {}

  // Tin AUTO phát trước lệnh mà tới sau là tin cũ: nghe theo thì relay kẹt MANUAL không hạn. Bỏ qua
  if (leftManual.some(name => open[name]?.fresh)) {
    logger.debug('Bỏ qua relay/status AUTO tới ngay sau khi vừa can thiệp tay', { deviceId: payload.deviceId })
    return
  }

  node.relay_states = states
  leftManual.forEach(name => setRelayAuto(node, name))
  // Luôn đặt hạn để job có cái mà làm: thời gian còn lại thiết bị báo, rồi log mở, rồi mặc định
  const now = Date.now()
  for (const name of manualWithoutExpiry) {
    const remainingMs = clampRemainingMs(payload.relays?.[name]?.remaining_ms, MAX_OVERRIDE_MS)
    const fromLog = open[name]?.expiry
    node.relays[name].mode = 'MANUAL'
    node.relays[name].override_expiry = remainingMs && remainingMs > 0
      ? new Date(now + remainingMs)
      : fromLog && fromLog.getTime() > now ? fromLog : new Date(now + DEFAULT_OVERRIDE_MS)
  }
  syncOverrideSummary(node)
  await node.save()
  await Promise.all(leftManual.map(name => closeOverrideLogFromDevice(node._id, name)))

  const zoneId = String(node.zone_id)
  for (const relayName of RELAY_NAMES) {
    emitRelayUpdate(zoneId, {
      zoneId,
      relayName,
      state: states[relayName],
      mode: node.relays[relayName].mode,
      overrideExpiry: node.relays[relayName].override_expiry?.toISOString(),
    })
  }
}

export interface DeviceStatusSummary {
  total: number; online: number; offline: number; pending: number; error: number; degraded: number
}

export function summarizeByStatus(nodes: Array<{ status: DeviceStatus }>): DeviceStatusSummary {
  const summary: DeviceStatusSummary = { total: nodes.length, online: 0, offline: 0, pending: 0, error: 0, degraded: 0 }
  for (const n of nodes) summary[n.status.toLowerCase() as Exclude<keyof DeviceStatusSummary, 'total'>]++
  return summary
}

// Chỉ farm chưa xoá mềm, cùng phạm vi với getHealthOverview
export async function getSystemStatus() {
  const [activeZoneIds, activeHouseIds] = await Promise.all([listActiveZoneIds(), listActiveHouseIds()])
  const [sensorNodes, cameraNodes] = await Promise.all([
    SensorNode.find({ zone_id: { $in: activeZoneIds }, ...IN_SERVICE }).sort({ registered_at: -1 }).lean(),
    CameraNode.find({ house_id: { $in: activeHouseIds }, ...IN_SERVICE }).sort({ registered_at: -1 }).lean(),
  ])

  const zoneIds = [...new Set(sensorNodes.map(n => String(n.zone_id)))]
  const zones = await Zone.find({ _id: { $in: zoneIds } }).select('name floor house_id').lean()
  const houseIds = [...new Set([...zones.map(z => String(z.house_id)), ...cameraNodes.map(n => String(n.house_id))])]
  const houses = await House.find({ _id: { $in: houseIds } }).select('name farm_id').lean()
  const farmIds = [...new Set(houses.map(h => String(h.farm_id)))]
  const farms = await Farm.find({ _id: { $in: farmIds } }).select('name').lean()

  const zoneById  = new Map(zones.map(z => [String(z._id), z]))
  const houseById = new Map(houses.map(h => [String(h._id), h]))
  const farmById  = new Map(farms.map(f => [String(f._id), f]))

  function resolveLocation(zoneId: string) {
    const zone  = zoneById.get(zoneId)
    const house = zone ? houseById.get(String(zone.house_id)) : undefined
    const farm  = house ? farmById.get(String(house.farm_id)) : undefined
    // Tên phòng có thể trùng giữa các nhà
    return {
      zone_id: zoneId, farm_id: house ? String(house.farm_id) : '', farm_name: farm?.name ?? '', house_name: house?.name ?? '', floor: zone?.floor, zone_name: zone?.name ?? '',
    }
  }

  function resolveHouseLocation(houseId: string) {
    const house = houseById.get(houseId)
    const farm  = house ? farmById.get(String(house.farm_id)) : undefined
    return {
      zone_id: '', house_id: houseId, farm_id: house ? String(house.farm_id) : '', farm_name: farm?.name ?? '', house_name: house?.name ?? '', zone_name: '',
    }
  }

  return {
    summary: summarizeByStatus([...sensorNodes, ...cameraNodes]),
    nodes: [
      ...sensorNodes.map(n => ({
        _id: String(n._id), device_id: n.device_id, type: 'sensor' as const, status: n.status,
        last_heartbeat: n.last_heartbeat, rssi: n.rssi, firmware_version: n.firmware_version,
        registered_at: n.registered_at, simulated: n.simulated ?? false, ...resolveLocation(String(n.zone_id)),
      })),
      ...cameraNodes.map(n => ({
        _id: String(n._id), device_id: n.device_id, type: 'camera' as const, status: n.status,
        last_heartbeat: n.last_heartbeat, registered_at: n.registered_at, simulated: n.simulated ?? false,
        ...resolveHouseLocation(String(n.house_id)),
      })),
    ],
  }
}
