import { SensorNode, CameraNode, ISensorNode } from '@/models/Device'
import { findZoneChainOrThrow } from '@/services/farmService'
import { hasFarmAccess } from '@/utils/farmAccess'
import { publishCommand } from '@/mqtt/client'
import { emitRelayUpdate, emitDeviceStatusChange } from '@/socket'
import { NotFoundError, ForbiddenError, ConflictError, BadRequestError } from '@/utils/AppError'
import type { RelayStates, HeartbeatPayload, RelayStatusPayload } from '@/types'
import type { CurrentUser } from '@/services/farmService'

const RELAY_NAMES = ['misting', 'speaker', 'ventilation', 'heating'] as const
type RelayName = typeof RELAY_NAMES[number]

/**
 * Kiểm tra quyền + trả về chain Zone→House→Farm của 1 zone — dùng để (a) xác
 * thực quyền sở hữu và (b) ghép topic MQTT `swiftletcare/{farmId}/{houseId}/
 * {zoneId}/...`. LƯU Ý: firmware (Secrets.h) phải được cấu hình bằng đúng 3
 * ObjectId thật này (qua onboarding QR — FARM-FR-003) để lệnh điều khiển thật
 * sự tới đúng thiết bị.
 */
async function checkZoneAccess(zoneId: string, user: CurrentUser) {
  const chain = await findZoneChainOrThrow(zoneId)
  if (!hasFarmAccess(chain.farm, user._id, user.role)) throw ForbiddenError('Không có quyền trên zone này')
  return chain
}

/** FARM-FR-003 */
export async function registerSensorNode(user: CurrentUser, input: { device_id: string; zone_id: string }): Promise<ISensorNode> {
  await checkZoneAccess(input.zone_id, user)

  const existing = await SensorNode.findOne({ device_id: input.device_id })
  if (existing) throw ConflictError('device_id đã được đăng ký')

  return SensorNode.create({ device_id: input.device_id, zone_id: input.zone_id })
}

export async function listSensorNodes(zoneId?: string): Promise<ISensorNode[]> {
  const filter = zoneId ? { zone_id: zoneId } : {}
  return SensorNode.find(filter).sort({ registered_at: -1 })
}

/** FARM-FR-006 */
export async function getSensorNode(nodeId: string): Promise<ISensorNode> {
  const node = await SensorNode.findById(nodeId)
  if (!node) throw NotFoundError('Không tìm thấy thiết bị')
  return node
}

/** ENV-FR-006 (qua device, tương đương farmService.updateZoneThresholds) */
export async function updateNodeThresholds(nodeId: string, user: CurrentUser, updates: object) {
  const node = await getSensorNode(nodeId)
  const chain = await checkZoneAccess(String(node.zone_id), user)

  const oldValues = { ...chain.zone.thresholds }
  chain.zone.thresholds = { ...chain.zone.thresholds, ...updates }
  chain.zone.threshold_history.push({
    changed_by: user._id as never,
    changed_at: new Date(),
    old_values: oldValues,
    new_values: updates as never,
  } as never)
  await chain.zone.save()

  publishCommand(String(chain.farm._id), String(chain.house._id), String(chain.zone._id), 'config/update', chain.zone.thresholds)
  return chain.zone
}

/** ENV-FR-016..018 (Manual Override) */
export async function controlRelay(
  nodeId: string,
  user: CurrentUser,
  input: { relayName: string; state: boolean; durationMs?: number },
): Promise<ISensorNode> {
  const node = await getSensorNode(nodeId)
  const chain = await checkZoneAccess(String(node.zone_id), user)

  if (!RELAY_NAMES.includes(input.relayName as RelayName)) {
    throw BadRequestError(`relayName phải là 1 trong: ${RELAY_NAMES.join(', ')}`)
  }
  const overrideMs = input.durationMs ?? 30 * 60 * 1000 // mặc định 30 phút (ENV-FR-018)

  // Cập nhật lạc quan trong DB — trạng thái thật sẽ được ESP32 xác nhận lại
  // qua topic relay/status (relayStatusHandler.ts) khi lệnh được thực thi.
  node.control_mode = 'MANUAL'
  node.relay_states[input.relayName as RelayName] = input.state
  node.override_expiry = new Date(Date.now() + overrideMs)
  await node.save()

  publishCommand(String(chain.farm._id), String(chain.house._id), String(chain.zone._id), 'relay/command', {
    relayName: input.relayName,
    state: input.state,
    durationMs: overrideMs,
  })

  emitRelayUpdate(String(chain.zone._id), {
    zoneId: String(chain.zone._id),
    relayName: input.relayName as keyof RelayStates,
    state: input.state,
    mode: 'MANUAL',
    overrideExpiry: node.override_expiry.toISOString(),
  })

  return node
}

/** FARM-FR-004 */
export async function registerCameraNode(user: CurrentUser, input: { device_id: string; zone_id: string; rtsp_url?: string }) {
  await checkZoneAccess(input.zone_id, user)

  const existing = await CameraNode.findOne({ device_id: input.device_id })
  if (existing) throw ConflictError('device_id đã được đăng ký')

  return CameraNode.create(input)
}

export async function listCameraNodes(zoneId?: string) {
  const filter = zoneId ? { zone_id: zoneId } : {}
  return CameraNode.find(filter).sort({ registered_at: -1 })
}

/**
 * FARM-FR-005 — gọi từ mqtt/handlers/heartbeatHandler.ts.
 * TODO (mở rộng sau): cần 1 job định kỳ (node-cron — đã có trong package.json
 * nhưng chưa dùng) quét các node có last_heartbeat quá cũ (>30s) để tự
 * chuyển status → OFFLINE, vì hệ thống hiện chỉ cập nhật ONLINE khi có
 * heartbeat tới, không tự phát hiện mất kết nối.
 */
export async function recordHeartbeat(payload: HeartbeatPayload): Promise<void> {
  if (!payload.deviceId) throw NotFoundError('Thiếu deviceId trong heartbeat payload')

  const node = await SensorNode.findOne({ device_id: payload.deviceId })
  if (!node) throw NotFoundError(`Không tìm thấy SensorNode với device_id="${payload.deviceId}"`)

  const wasOffline = node.status !== 'ONLINE'
  node.status = 'ONLINE'
  node.last_heartbeat = new Date()
  if (payload.rssi !== undefined) node.rssi = payload.rssi
  if (payload.firmwareVersion) node.firmware_version = payload.firmwareVersion
  await node.save()

  if (wasOffline) {
    emitDeviceStatusChange(String(node.zone_id), {
      nodeId: String(node._id),
      status: 'ONLINE',
      timestamp: new Date().toISOString(),
    })
  }
}

/** ENV-FR-015 — xác nhận trạng thái relay thật từ ESP32 (gọi từ mqtt/handlers/relayStatusHandler.ts) */
export async function confirmRelayStatus(payload: RelayStatusPayload): Promise<void> {
  if (!payload.deviceId) throw NotFoundError('Thiếu deviceId trong relay/status payload')

  const node = await SensorNode.findOne({ device_id: payload.deviceId })
  if (!node) throw NotFoundError(`Không tìm thấy SensorNode với device_id="${payload.deviceId}"`)

  node.relay_states = payload.relay_states
  node.control_mode = payload.control_mode
  node.status = 'ONLINE'
  node.last_heartbeat = new Date()
  await node.save()

  const zoneId = String(node.zone_id)
  for (const relayName of Object.keys(payload.relay_states) as Array<keyof RelayStates>) {
    emitRelayUpdate(zoneId, {
      zoneId,
      relayName,
      state: payload.relay_states[relayName],
      mode: node.control_mode,
      overrideExpiry: node.override_expiry?.toISOString(),
    })
  }
}
