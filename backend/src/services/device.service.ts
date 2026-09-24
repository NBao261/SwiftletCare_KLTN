import { SensorNode, CameraNode, ISensorNode, IN_SERVICE } from '@/models/device.model'
import { Ticket } from '@/models/ticket.model'
import { House, Zone } from '@/models/houseZone.model'
import { Farm } from '@/models/farm.model'
import { findZoneChainOrThrow, assertZoneAccess, listAccessibleZoneIds, listActiveZoneIds } from '@/utils/farmAccess.util'
import { publishCommand } from '@/mqtt/mqtt.client'
import { emitRelayUpdate, emitDeviceStatusChange } from '@/socket'
import { raiseNodeOfflineAlert, resolveAlertsForNode } from '@/services/alert.service'
import { Alert } from '@/models/alert.model'
import { logAction } from '@/services/auditLog.service'
import { notifyUser } from '@/services/notification.service'
import { verifyActivationKey, markClaimed } from '@/services/provisionedDevice.service'
import { assertValidThresholds, pickThresholds } from '@/utils/thresholds.util'
import { applyThresholdUpdate } from '@/utils/thresholdUpdate.util'
import { NotFoundError, ConflictError, BadRequestError, ForbiddenError, ServiceUnavailableError, NotImplementedError } from '@/utils/appError.util'
import logger from '@/utils/logger.util'
import type { RelayStates, HeartbeatPayload, RelayStatusPayload, CurrentUser, DeviceStatus, Thresholds } from '@/types'

const RELAY_NAMES = ['misting', 'speaker', 'ventilation', 'heating'] as const
type RelayName = typeof RELAY_NAMES[number]

/** FARM-FR-005 — quá thời gian này không có heartbeat mới thì coi là mất kết nối */
export const OFFLINE_THRESHOLD_MS = 30_000

export interface RegisterDeviceInput { device_id: string; zone_id: string; secret_key: string }

/**
 * Flow 1 case 3a — thiết bị đã có bản ghi: nói rõ là thuộc Farm khác (Technician
 * cần kiểm tra lại nhãn) hay chỉ là đăng ký trùng trong cùng Farm.
 */
async function assertNotRegistered(existingZoneId: unknown, targetFarmId: string): Promise<never> {
  const chain = await findZoneChainOrThrow(String(existingZoneId)).catch(() => null)
  if (chain && String(chain.farm._id) !== targetFarmId) {
    throw ConflictError('Thiết bị đã thuộc về Farm khác')
  }
  throw ConflictError('device_id đã được đăng ký')
}

/**
 * FARM-FR-008 — thiết bị đã gỡ được lắp lại (ở chỗ khác): `device_id` là unique
 * nên đổi tên bản ghi cũ để nhường chỗ. Bản ghi cũ giữ nguyên `_id` nên toàn bộ
 * telemetry/alert lịch sử vẫn trỏ đúng vào nó.
 */
async function retireDeviceId(Model: typeof SensorNode, nodeId: unknown, deviceId: string): Promise<void> {
  await Model.updateOne({ _id: nodeId }, { device_id: `${deviceId}#retired-${Date.now()}` })
}

/**
 * FARM-FR-003 — chỉ Technician (hoặc Admin) thực hiện, qua Web Console Onboarding.
 * Phải nhập đúng cặp {device_id, secretKey} trên nhãn (Flow 1 bước 3–4). Node
 * được tạo ở trạng thái PENDING và chỉ chuyển ONLINE khi thiết bị gửi heartbeat
 * đầu tiên (bước 8), nên Farm Owner nhìn thấy ngay là thiết bị đã khai báo nhưng
 * chưa thật sự kết nối.
 */
export async function registerSensorNode(user: CurrentUser, input: RegisterDeviceInput): Promise<ISensorNode> {
  const { farm } = await assertZoneAccess(input.zone_id, user)
  await verifyActivationKey(input.device_id, 'SENSOR', input.secret_key)

  const existing = await SensorNode.findOne({ device_id: input.device_id }).select('zone_id decommissioned_at').lean()
  if (existing?.decommissioned_at) await retireDeviceId(SensorNode, existing._id, input.device_id)
  else if (existing) await assertNotRegistered(existing.zone_id, String(farm._id))

  const node = await SensorNode.create({
    device_id: input.device_id, zone_id: input.zone_id, status: 'PENDING', registered_by: user._id,
  })
  await markClaimed(input.device_id)
  await logAction(user._id, 'DEVICE_REGISTERED', 'sensor_node', String(node._id), {
    deviceId: input.device_id, zoneId: input.zone_id,
  })
  return node
}

/**
 * FARM-FR-005/006 — có `zoneId` thì check quyền đúng zone đó; không có thì lọc
 * theo toàn bộ zone user được quyền xem, KHÔNG trả về mọi thiết bị trong hệ
 * thống (trước đây bỏ sót — Farm Owner farm A đọc được thiết bị farm B).
 */
export async function listSensorNodes(zoneId: string | undefined, user: CurrentUser): Promise<ISensorNode[]> {
  if (zoneId) {
    await assertZoneAccess(zoneId, user)
    return SensorNode.find({ zone_id: zoneId, ...IN_SERVICE }).sort({ registered_at: -1 }).lean() as unknown as ISensorNode[]
  }
  const accessibleZoneIds = await listAccessibleZoneIds(user)
  return SensorNode.find({ zone_id: { $in: accessibleZoneIds }, ...IN_SERVICE }).sort({ registered_at: -1 }).lean() as unknown as ISensorNode[]
}

/** Thiết bị đã gỡ vẫn xem được (lịch sử) nhưng không còn nhận lệnh */
function assertInService(node: { decommissioned_at?: Date }): void {
  if (node.decommissioned_at) throw ConflictError('Thiết bị đã được gỡ bỏ khỏi hệ thống')
}

/** FARM-FR-006 */
export async function getSensorNode(nodeId: string, user: CurrentUser): Promise<ISensorNode> {
  const node = await SensorNode.findById(nodeId)
  if (!node) throw NotFoundError('Không tìm thấy thiết bị')
  await assertZoneAccess(String(node.zone_id), user)
  return node
}

/** ENV-FR-006 (qua device, tương đương farmService.updateZoneThresholds — cùng validate) */
export async function updateNodeThresholds(nodeId: string, user: CurrentUser, updates: Partial<Thresholds>) {
  const node = await SensorNode.findById(nodeId)
  if (!node) throw NotFoundError('Không tìm thấy thiết bị')
  assertInService(node)
  const chain = await assertZoneAccess(String(node.zone_id), user)

  const picked = pickThresholds(updates as Record<string, unknown>)
  const merged = { ...chain.zone.thresholds, ...picked }
  assertValidThresholds(merged)

  return applyThresholdUpdate(chain, user, {
    thresholds: merged, historyValues: picked, source: 'MANUAL', logDetails: { viaNodeId: nodeId },
  })
}

/** ENV-FR-016..018 (Manual Override) */
export async function controlRelay(
  nodeId: string,
  user: CurrentUser,
  input: { relayName: string; state: boolean; durationMs?: number },
): Promise<{ node: ISensorNode; delivered: boolean }> {
  const node = await SensorNode.findById(nodeId)
  if (!node) throw NotFoundError('Không tìm thấy thiết bị')
  assertInService(node)
  const chain = await assertZoneAccess(String(node.zone_id), user)

  if (!RELAY_NAMES.includes(input.relayName as RelayName)) {
    throw BadRequestError(`relayName phải là 1 trong: ${RELAY_NAMES.join(', ')}`)
  }
  const overrideMs = input.durationMs ?? 30 * 60 * 1000 // mặc định 30 phút (ENV-FR-018)

  // Cập nhật lạc quan trong DB — trạng thái thật sẽ được ESP32 xác nhận lại
  // qua topic relay/status (relayStatus.handler.ts) khi lệnh được thực thi.
  node.control_mode = 'MANUAL'
  node.relay_states[input.relayName as RelayName] = input.state
  node.override_expiry = new Date(Date.now() + overrideMs)
  await node.save()

  // Lệnh không tới được broker thì DB vẫn giữ trạng thái mong muốn (ESP32 sẽ
  // đồng bộ khi online lại), nhưng phải nói thật cho UI biết qua `delivered`.
  const delivered = publishCommand(String(chain.farm._id), String(chain.house._id), String(chain.zone._id), 'relay/command', {
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

  await logAction(user._id, 'RELAY_OVERRIDE', 'sensor_node', String(node._id), {
    relayName: input.relayName, state: input.state, durationMs: overrideMs, delivered,
  })
  return { node, delivered }
}

/** ENV-FR-018 — trả thiết bị về AUTO ngay, không đợi hết hạn override */
export async function clearRelayOverride(nodeId: string, user: CurrentUser): Promise<ISensorNode> {
  const node = await SensorNode.findById(nodeId)
  if (!node) throw NotFoundError('Không tìm thấy thiết bị')
  const chain = await assertZoneAccess(String(node.zone_id), user)
  if (node.control_mode === 'AUTO') return node

  node.control_mode = 'AUTO'
  node.override_expiry = undefined
  await node.save()

  const zoneId = String(chain.zone._id)
  publishCommand(String(chain.farm._id), String(chain.house._id), zoneId, 'relay/command', { action: 'clear_override' })
  for (const relayName of RELAY_NAMES) {
    emitRelayUpdate(zoneId, { zoneId, relayName, state: node.relay_states[relayName], mode: 'AUTO' })
  }
  await logAction(user._id, 'RELAY_OVERRIDE_CLEARED', 'sensor_node', String(node._id), {})
  return node
}

/**
 * FARM-FR-007b, Flow 21 Nhánh A — Technician dời thiết bị sang Zone/Farm khác
 * trong khi thiết bị còn ONLINE. Publish MQTT config/reassign lên topic CŨ
 * (farm/house/zone hiện tại), ESP32 tự lưu định danh mới vào NVS + restart +
 * kết nối lại theo topic mới. Nhánh B (thiết bị OFFLINE, AP-mode + secretKey)
 * chưa được implement — chỉ hỗ trợ dời khi ONLINE.
 */
export async function reassignZone(
  nodeId: string,
  user: CurrentUser,
  input: { newZoneId: string },
): Promise<{ node: ISensorNode; delivered: boolean }> {
  const node = await SensorNode.findById(nodeId)
  if (!node) throw NotFoundError('Không tìm thấy thiết bị')
  assertInService(node)

  if (node.status !== 'ONLINE') {
    throw ConflictError('Thiết bị đang OFFLINE — chỉ dời Zone được khi thiết bị ONLINE (nhánh AP-mode chưa được hỗ trợ)')
  }

  // Check quyền trên CẢ Farm nguồn lẫn Farm đích (SRS Flow 21 bước 4a).
  const sourceChain = await assertZoneAccess(String(node.zone_id), user)
  const destChain = await assertZoneAccess(input.newZoneId, user)

  // Publish lên topic CŨ — thiết bị vẫn đang lắng nghe ở đó cho tới khi restart.
  const delivered = publishCommand(String(sourceChain.farm._id), String(sourceChain.house._id), String(sourceChain.zone._id), 'config/reassign', {
    newFarmId: String(destChain.farm._id),
    newHouseId: String(destChain.house._id),
    newZoneId: String(destChain.zone._id),
  })

  // Cập nhật lạc quan — giống pattern controlRelay/updateNodeThresholds ở trên.
  node.zone_id = destChain.zone._id
  await node.save()

  await logAction(user._id, 'DEVICE_REASSIGNED', 'sensor_node', String(node._id), {
    fromZoneId: String(sourceChain.zone._id), toZoneId: String(destChain.zone._id), delivered,
  })
  return { node, delivered }
}

/** FARM-FR-004 — chỉ Technician/Admin, cùng Web Console Onboarding với sensor node (Flow 1b) */
export async function registerCameraNode(user: CurrentUser, input: RegisterDeviceInput & { rtsp_url?: string }) {
  const { farm } = await assertZoneAccess(input.zone_id, user)
  await verifyActivationKey(input.device_id, 'CAMERA', input.secret_key)

  const existing = await CameraNode.findOne({ device_id: input.device_id }).select('zone_id decommissioned_at').lean()
  if (existing?.decommissioned_at) await retireDeviceId(CameraNode as never, existing._id, input.device_id)
  else if (existing) await assertNotRegistered(existing.zone_id, String(farm._id))

  // Chọn field tường minh — trải thẳng body vào create() cho phép client tự đặt status/registered_at
  const node = await CameraNode.create({
    device_id: input.device_id, zone_id: input.zone_id, rtsp_url: input.rtsp_url,
    status: 'PENDING', registered_by: user._id,
  })
  await markClaimed(input.device_id)
  await logAction(user._id, 'DEVICE_REGISTERED', 'camera_node', String(node._id), {
    deviceId: input.device_id, zoneId: input.zone_id,
  })
  return node
}

export async function listCameraNodes(zoneId: string | undefined, user: CurrentUser) {
  if (zoneId) {
    await assertZoneAccess(zoneId, user)
    return CameraNode.find({ zone_id: zoneId, ...IN_SERVICE }).sort({ registered_at: -1 }).lean()
  }
  const accessibleZoneIds = await listAccessibleZoneIds(user)
  return CameraNode.find({ zone_id: { $in: accessibleZoneIds }, ...IN_SERVICE }).sort({ registered_at: -1 }).lean()
}

/** FARM-FR-005 — gọi từ mqtt/handlers/heartbeat.handler.ts. */
/**
 * `topicParts` — ['swiftletcare', farmId, houseId, zoneId, 'heartbeat'] (mqtt.client.ts
 * đã split() sẵn topic thật của message này, khác payload.deviceId chỉ để tra SensorNode).
 * FARM-FR-003b (tự chữa): thiết bị mới onboarding vẫn publish theo farmId/houseId/zoneId
 * MẶC ĐỊNH (Secrets.h/NVS cũ) cho tới khi có ai đẩy identity thật xuống — AP-mode form
 * không còn làm việc này nữa (đã thử, vướng captive-portal auto-detect của OS làm mất
 * dữ liệu, xem WiFiProvisioner.cpp). Thay vào đó: so farmId/houseId/zoneId TRÊN TOPIC
 * heartbeat vừa nhận với chain THẬT của node.zone_id — lệch thì tự đẩy config/reassign
 * lên đúng topic (cũ) mà heartbeat vừa tới, y hệt cơ chế Flow 21 Nhánh A nhưng do backend
 * tự kích hoạt thay vì Technician bấm nút.
 */
export async function recordHeartbeat(payload: HeartbeatPayload, topicParts?: string[]): Promise<void> {
  if (!payload.deviceId) throw NotFoundError('Thiếu deviceId trong heartbeat payload')

  const node = await SensorNode.findOne({ device_id: payload.deviceId, ...IN_SERVICE })
  if (!node) throw NotFoundError(`Không tìm thấy SensorNode với device_id="${payload.deviceId}"`)

  const wasOffline = node.status !== 'ONLINE'
  node.status = 'ONLINE'
  node.last_heartbeat = new Date()
  if (payload.rssi !== undefined) node.rssi = payload.rssi
  if (payload.firmwareVersion) node.firmware_version = payload.firmwareVersion
  // Flow 15 bước 5 — heartbeat đầu tiên chạy đúng bản mới = OTA thành công
  const otaDone = node.ota_pending && payload.firmwareVersion === node.ota_pending.version ? node.ota_pending : null
  if (otaDone) node.ota_pending = undefined
  node.activation_overdue_at = undefined // đã kết nối được thì không còn "kích hoạt quá hạn"
  await node.save()

  if (otaDone) {
    await logAction(otaDone.requested_by ? String(otaDone.requested_by) : undefined, 'DEVICE_OTA_SUCCEEDED', 'sensor_node', String(node._id), {
      deviceId: node.device_id, version: otaDone.version,
    })
  }

  if (wasOffline) {
    emitDeviceStatusChange(String(node.zone_id), {
      nodeId: String(node._id),
      status: 'ONLINE',
      timestamp: new Date().toISOString(),
    })
  }

  if (topicParts && topicParts.length >= 4) {
    const [, topicFarmId, topicHouseId, topicZoneId] = topicParts
    try {
      const chain = await findZoneChainOrThrow(String(node.zone_id))
      const realFarmId = String(chain.farm._id)
      const realHouseId = String(chain.house._id)
      const realZoneId = String(chain.zone._id)
      const topicMatches = topicFarmId === realFarmId && topicHouseId === realHouseId && topicZoneId === realZoneId
      if (topicMatches && (payload.justConnected || wasOffline)) {
        // config/update không retained + PubSubClient clean session → thiết bị
        // offline/restart lúc ngưỡng hay lịch loa bị sửa sẽ giữ mãi giá trị cũ
        // trong NVS. Đẩy lại bộ config hiện hành mỗi lần thiết bị vừa (re)connect.
        publishCommand(realFarmId, realHouseId, realZoneId, 'config/update', buildDeviceConfig(chain.zone.thresholds, node))
      }
      // Topic lệch: chỉ reassign — thiết bị restart, heartbeat `justConnected`
      // kế tiếp (đúng topic) sẽ tự đồng bộ config ở nhánh trên.
      if (!topicMatches) {
        logger.info('Heartbeat tới trên topic lệch với Zone thật — tự đẩy config/reassign', {
          deviceId: payload.deviceId,
          from: `${topicFarmId}/${topicHouseId}/${topicZoneId}`,
          to: `${realFarmId}/${realHouseId}/${realZoneId}`,
        })
        publishCommand(topicFarmId, topicHouseId, topicZoneId, 'config/reassign', {
          newFarmId: realFarmId,
          newHouseId: realHouseId,
          newZoneId: realZoneId,
        })
      }
    } catch (err) {
      // Zone của node có thể đã bị xoá/đổi — không chặn xử lý heartbeat bình
      // thường chỉ vì bước tự chữa topic thất bại.
      logger.warn('Không tự sửa được topic lệch cho heartbeat', { deviceId: payload.deviceId, err: (err as Error).message })
    }
  }
}

/**
 * FARM-FR-005 — thiết bị vừa gửi dữ liệu (telemetry): làm mới last_heartbeat và,
 * nếu trước đó chưa ONLINE, phát DEVICE_STATUS_CHANGE giống recordHeartbeat.
 * Dùng updateOne thay vì save() vì được gọi dày (telemetry.service).
 */
export async function markNodeSeen(node: Pick<ISensorNode, '_id' | 'zone_id' | 'status'>): Promise<void> {
  await SensorNode.updateOne({ _id: node._id }, { status: 'ONLINE', last_heartbeat: new Date() })
  if (node.status !== 'ONLINE') {
    emitDeviceStatusChange(String(node.zone_id), {
      nodeId: String(node._id),
      status: 'ONLINE',
      timestamp: new Date().toISOString(),
    })
  }
}

const hourOf = (hhmm: string) => Number(hhmm.slice(0, 2))

/**
 * Payload MQTT `config/update` đầy đủ cho 1 ESP32 — key khớp firmware
 * `Config::update()` (firmware/src/config/Config.cpp). Ngưỡng thuộc Zone, lịch
 * loa ru thuộc từng thiết bị (ENV-FR-006, ENV-FR-013b). Firmware chỉ có 2 khung
 * giờ theo giờ tròn; `windows` rỗng = chưa từng cấu hình → không gửi key khung
 * giờ để firmware giữ mặc định của nó; chỉ 1 khung → khung 2 = 0-0 (không bao giờ khớp).
 */
export function buildDeviceConfig(t: Thresholds, node: Pick<ISensorNode, 'speaker_schedule' | 'audio'>) {
  const [w1, w2] = node.speaker_schedule.windows
  return {
    temp_min: t.temp_min,
    temp_max: t.temp_max,
    humidity_min: t.humidity_min,
    humidity_max: t.humidity_max,
    light_max: t.light_max,
    nh3_max: t.nh3_max,
    co2_max: t.co2_max,
    speaker_schedule_enabled: node.speaker_schedule.enabled,
    speaker_volume: node.audio.volume,
    speaker_track: node.audio.current_track,
    ...(w1 && {
      speaker_window1_start_hour: hourOf(w1.start),
      speaker_window1_end_hour: hourOf(w1.end),
      speaker_window2_start_hour: w2 ? hourOf(w2.start) : 0,
      speaker_window2_end_hour: w2 ? hourOf(w2.end) : 0,
    }),
  }
}

export interface SpeakerScheduleInput {
  enabled?: boolean
  windows?: Array<{ start: string; end: string }>
  volume?: number
  track?: number
}

/** ENV-FR-013b — lịch loa ru của 1 thiết bị, publish ngay xuống ESP32 qua config/update */
export async function updateSpeakerSchedule(nodeId: string, user: CurrentUser, input: SpeakerScheduleInput): Promise<ISensorNode> {
  const node = await SensorNode.findById(nodeId)
  if (!node) throw NotFoundError('Không tìm thấy thiết bị')
  const chain = await assertZoneAccess(String(node.zone_id), user)

  // "HH:00" cùng định dạng 2 chữ số nên so sánh chuỗi = so sánh giờ
  const badWindow = input.windows?.find(w => w.start >= w.end)
  if (badWindow) throw BadRequestError(`Khung giờ ${badWindow.start}-${badWindow.end} không hợp lệ: giờ bắt đầu phải trước giờ kết thúc`)

  if (input.enabled !== undefined) node.speaker_schedule.enabled = input.enabled
  if (input.windows) node.speaker_schedule.windows = input.windows.map(({ start, end }) => ({ start, end }))
  if (input.volume !== undefined) node.audio.volume = input.volume
  if (input.track !== undefined) node.audio.current_track = input.track
  await node.save()

  publishCommand(String(chain.farm._id), String(chain.house._id), String(chain.zone._id), 'config/update',
    buildDeviceConfig(chain.zone.thresholds, node))
  await logAction(user._id, 'SPEAKER_SCHEDULE_UPDATED', 'sensor_node', String(node._id), { ...input })
  return node
}

/**
 * FARM-FR-005 — gọi định kỳ từ jobs/deviceOffline.job.ts (node-cron). `recordHeartbeat`
 * chỉ chuyển node sang ONLINE khi có heartbeat tới; hàm này là chiều ngược lại —
 * quét các node đang ONLINE nhưng last_heartbeat đã quá `OFFLINE_THRESHOLD_MS`
 * (mất kết nối/mất nguồn) và tự chuyển sang OFFLINE, phát DEVICE_STATUS_CHANGE.
 */
export async function markStaleDevicesOffline(): Promise<void> {
  const staleBefore = new Date(Date.now() - OFFLINE_THRESHOLD_MS)
  const staleNodes = await SensorNode.find({ status: 'ONLINE', last_heartbeat: { $lt: staleBefore } })
    .select('_id zone_id')
    .lean()
  if (staleNodes.length === 0) return

  // 1 updateMany thay vì N lần .save() tuần tự — job này chạy mỗi 10s, N có
  // thể lớn khi cả nhà mất điện cùng lúc.
  await SensorNode.updateMany({ _id: { $in: staleNodes.map(n => n._id) } }, { status: 'OFFLINE' })

  await Promise.all(staleNodes.map(async node => {
    emitDeviceStatusChange(String(node.zone_id), {
      nodeId: String(node._id),
      status: 'OFFLINE',
      timestamp: new Date().toISOString(),
    })
    // THREAT-FR-009 — trước đây job này chỉ đổi trạng thái, không hề tạo Alert
    // nên NODE_OFFLINE không bao giờ xuất hiện trong danh sách cảnh báo.
    await raiseNodeOfflineAlert(String(node._id)).catch((err: Error) =>
      logger.error('Tạo cảnh báo NODE_OFFLINE thất bại', { nodeId: String(node._id), err }),
    )
  }))
}

// ── FARM-FR-008: gỡ bỏ / thay thế thiết bị ───────────────────────────────────

export type DeviceKind = 'sensor' | 'camera'
const DEVICE_MODELS = { sensor: SensorNode, camera: CameraNode as unknown as typeof SensorNode }
const TARGET_TYPES = { sensor: 'sensor_node', camera: 'camera_node' } as const

/**
 * Ticket đang mở sinh ra từ cảnh báo của thiết bị vừa gỡ: chỉ thêm ghi chú, KHÔNG
 * tự đóng — người xử lý vẫn phải xác nhận đã bàn giao xong (TICKET-FR-007).
 */
async function noteTicketsOfRemovedDevice(nodeId: string, deviceId: string): Promise<number> {
  const alertIds = await Alert.find({ node_id: nodeId }).select('_id').lean()
  if (alertIds.length === 0) return 0

  const tickets = await Ticket.find({ alert_id: { $in: alertIds.map(a => a._id) }, status: { $ne: 'CLOSED' } })
  for (const ticket of tickets) {
    ticket.notes.push({
      content: `Thiết bị ${deviceId} đã được gỡ khỏi hệ thống — kiểm tra lại trước khi đóng ticket này`,
      created_at: new Date(),
    } as never)
    await ticket.save()
  }
  return tickets.length
}

/**
 * FARM-FR-008 — Technician gỡ thiết bị khỏi hiện trường. Document được giữ lại
 * (telemetry/alert cũ tham chiếu `node_id`), chỉ đánh dấu `decommissioned_at`
 * để loại khỏi danh sách, thống kê và mọi luồng MQTT (heartbeat/telemetry từ
 * device_id này bị bỏ qua).
 */
export async function decommissionDevice(
  kind: DeviceKind, nodeId: string, user: CurrentUser, reason: string,
  opts: { replacedBy?: unknown; force?: boolean } = {},
) {
  const { replacedBy, force } = opts
  const Model = DEVICE_MODELS[kind]
  const node = await Model.findById(nodeId)
  if (!node) throw NotFoundError('Không tìm thấy thiết bị')
  const chain = await assertZoneAccess(String(node.zone_id), user)
  assertInService(node)

  // Gỡ thiết bị hỏng (OFFLINE/ERROR/PENDING) là việc thường ngày nên không hỏi gì
  // thêm. Nhưng thiết bị đang sống mà gỡ là mất luôn giám sát của cả Zone — bắt
  // gửi `force` để đó là quyết định có ý thức, không phải một cú bấm nhầm
  // (cùng cách `adminOverrideTicket` bắt force khi gán Technician ngoài vùng).
  const isAlive = node.status === 'ONLINE' || node.status === 'DEGRADED'
  if (isAlive && force !== true) {
    const lastSeen = node.last_heartbeat ? ` (heartbeat lúc ${node.last_heartbeat.toISOString()})` : ''
    throw ConflictError(
      `Thiết bị đang ${node.status}${lastSeen} — gỡ sẽ mất giám sát của Zone này. ` +
      'Gửi kèm force=true nếu vẫn muốn gỡ.',
    )
  }

  node.decommissioned_at = new Date()
  node.decommission_reason = reason
  node.status = 'OFFLINE'
  if (replacedBy) node.replaced_by = replacedBy as never
  await node.save()

  emitDeviceStatusChange(String(node.zone_id), {
    nodeId: String(node._id), status: 'OFFLINE', timestamp: new Date().toISOString(),
  })

  const closedAlerts = await resolveAlertsForNode(String(node._id), `Thiết bị đã được gỡ bỏ: ${reason}`)
  const notedTickets = await noteTicketsOfRemovedDevice(String(node._id), node.device_id)

  await logAction(user._id, 'DEVICE_DECOMMISSIONED', TARGET_TYPES[kind], String(node._id), {
    deviceId: node.device_id, zoneId: String(node.zone_id), reason,
    replacedBy: replacedBy ? String(replacedBy) : null, closedAlerts, notedTickets,
    ...(isAlive ? { forcedWhileOnline: true } : {}),
  })

  // Farm Owner không tham gia luồng tháo lắp (RACI mục 4.4) nhưng phải biết nhà
  // yến của mình vừa mất một thiết bị giám sát.
  void notifyUser(String(chain.farm.owner_id), {
    title: 'Thiết bị đã được gỡ khỏi nhà yến',
    body: `Kỹ thuật viên đã gỡ ${node.device_id} khỏi khu vực "${chain.zone.name}". Lý do: ${reason}`,
  })
  return node
}

/** Cửa sổ sửa sai cho thao tác gỡ nhầm — quá hạn thì đăng ký lại như thiết bị mới */
export const RESTORE_WINDOW_MS = 24 * 60 * 60 * 1000
const RETIRED_SUFFIX = '#retired-'

/**
 * FARM-FR-008 — khôi phục thiết bị vừa bị gỡ nhầm. Chỉ trong 24 giờ và chỉ khi
 * chỗ của nó chưa bị ai chiếm: đăng ký lại `device_id` cũ sẽ đổi tên bản ghi này
 * thành `<device_id>#retired-…` và tạo node mới, còn `replace` thì trỏ
 * `replaced_by` sang node thay thế — khôi phục trong 2 trường hợp đó sẽ tạo ra 2
 * thiết bị "sống" cùng một device_id trong cùng Zone.
 */
export async function restoreDevice(kind: DeviceKind, nodeId: string, user: CurrentUser, reason: string) {
  const Model = DEVICE_MODELS[kind]
  const node = await Model.findById(nodeId)
  if (!node) throw NotFoundError('Không tìm thấy thiết bị')
  const chain = await assertZoneAccess(String(node.zone_id), user)
  if (!node.decommissioned_at) throw ConflictError('Thiết bị này chưa bị gỡ nên không cần khôi phục')

  const elapsed = Date.now() - node.decommissioned_at.getTime()
  if (elapsed > RESTORE_WINDOW_MS) {
    throw ConflictError(
      `Thiết bị đã gỡ quá ${RESTORE_WINDOW_MS / 3600_000} giờ — hãy đăng ký lại như thiết bị mới ` +
      '(lịch sử dữ liệu cũ vẫn tra cứu được theo bản ghi này).',
    )
  }
  if (node.device_id.includes(RETIRED_SUFFIX)) {
    throw ConflictError('device_id của thiết bị này đã được đăng ký lại cho một bản ghi khác — không khôi phục được')
  }
  if (node.replaced_by) {
    const replacement = await Model.findOne({ _id: node.replaced_by, ...IN_SERVICE }).select('device_id').lean()
    if (replacement) {
      throw ConflictError(`Thiết bị này đã được thay bằng ${replacement.device_id} — gỡ thiết bị thay thế trước nếu muốn khôi phục`)
    }
  }

  node.decommissioned_at = undefined
  node.decommission_reason = undefined
  node.replaced_by = undefined
  // Chờ heartbeat thật rồi mới ONLINE trở lại, không tự nhận là đang chạy
  node.status = 'OFFLINE'
  await node.save()

  emitDeviceStatusChange(String(node.zone_id), {
    nodeId: String(node._id), status: 'OFFLINE', timestamp: new Date().toISOString(),
  })
  await logAction(user._id, 'DEVICE_RESTORED', TARGET_TYPES[kind], String(node._id), {
    deviceId: node.device_id, zoneId: String(node.zone_id), reason, decommissionedForMs: elapsed,
  })
  void notifyUser(String(chain.farm.owner_id), {
    title: 'Thiết bị đã được khôi phục',
    body: `Kỹ thuật viên đã khôi phục ${node.device_id} tại khu vực "${chain.zone.name}". Lý do: ${reason}`,
  })
  return node
}

/**
 * FARM-FR-008 — thay thiết bị hỏng bằng thiết bị mới cùng Zone. Thiết bị mới đi
 * qua đúng luồng onboarding (secretKey trên nhãn, PENDING chờ heartbeat); cấu
 * hình loa của node cũ được chép sang để Farm Owner không phải cài lại. Ngưỡng
 * môi trường nằm ở Zone nên tự áp dụng. Tạo node mới TRƯỚC khi gỡ node cũ: nếu
 * secretKey sai thì node cũ vẫn nguyên, không rơi vào trạng thái mất cả hai.
 */
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

  // force: thay thiết bị là thao tác đã có chủ đích, thiết bị cũ thường vẫn ONLINE
  const oldNode = await decommissionDevice('sensor', nodeId, user, input.reason, { replacedBy: newNode._id, force: true })
  await logAction(user._id, 'DEVICE_REPLACED', 'sensor_node', String(old._id), {
    oldDeviceId: old.device_id, newDeviceId: input.new_device_id, newNodeId: String(newNode._id), reason: input.reason,
  })
  return { oldNode, newNode }
}

// ── TICKET-FR-008 / Flow 15: xử lý từ xa ─────────────────────────────────────

export type RemoteCommand = 'RESTART' | 'PUSH_CONFIG' | 'OTA'

/**
 * Firmware hiện tại (`MQTTManager::onConfigUpdate` → `Config::update`) chỉ đọc
 * các khoá ngưỡng/loa và BỎ QUA `command`; OTA của nó là đẩy file qua ElegantOTA
 * `/update`, không tự tải từ URL. Nếu vẫn nhận RESTART/OTA thì API báo 202 còn
 * thiết bị không làm gì, và mọi lệnh OTA chắc chắn bị `markOtaTimeouts` báo thất
 * bại sau 30 phút — Technician kết luận sai về tình trạng thiết bị.
 * Bật cờ này khi firmware đã xử lý `command` (xem SRS TICKET-FR-008, Flow 15).
 */
const UNSUPPORTED_COMMANDS: RemoteCommand[] = ['RESTART', 'OTA']
const firmwareHandlesCommands = () => process.env.FIRMWARE_COMMAND_SUPPORT === 'true'

export interface RemoteCommandInput {
  command: RemoteCommand
  /** Ghi kết quả vào ticket đang xử lý (Flow 9 bước 5) */
  ticket_id?: string
  ota?: { version: string; url: string; sha256: string }
}

/**
 * TICKET-FR-008 — Technician thử xử lý từ xa trước khi quyết định ra hiện
 * trường. Cả 3 lệnh đi qua topic `config/update` đã có trong §9.2 (Flow 15 bước
 * 3 chỉ định OTA dùng topic này), phân biệt bằng trường `command`:
 * - PUSH_CONFIG: đẩy lại toàn bộ ngưỡng hiện hành của Zone (thiết bị lệch cấu hình)
 * - RESTART: `{ command: 'RESTART' }`
 * - OTA: `{ command: 'OTA', ota: { version, url, sha256 } }` — ESP32 tự tải, kiểm
 *   checksum, ghi partition dự phòng, rollback nếu lỗi (Flow 15 bước 4, case 4a–5a)
 * Firmware cũ bỏ qua key lạ trong `config/update` nên gửi RESTART/OTA tới thiết
 * bị chưa hỗ trợ không làm hỏng ngưỡng đang chạy.
 */
/**
 * Flow 15 — ESP32 sẽ tải và flash đúng file ở URL này, còn sha256 do chính người
 * gửi lệnh đặt nên không chống được file độc. Nguồn firmware vì vậy phải bị khoá:
 * chỉ HTTPS và chỉ các host nội bộ khai báo trong `OTA_ALLOWED_HOSTS` (nơi team
 * upload bản build, VD MinIO). Chưa cấu hình thì chặn hết — an toàn mặc định.
 */
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

/** Flow 15 case 4a–5a — quá thời gian này chưa có heartbeat chạy bản mới thì coi OTA thất bại (đã rollback) */
export const OTA_CONFIRM_TIMEOUT_MS = 30 * 60 * 1000

/**
 * Gọi từ jobs/activationOverdue.job.ts. ESP32 tự rollback khi OTA lỗi nên backend
 * không bao giờ nhận được tin báo lỗi — chỉ biết qua việc heartbeat vẫn báo bản
 * cũ. Không có bước này `ota_pending` treo mãi, Technician tưởng vẫn đang cập nhật.
 */
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
    if (requester) {
      void notifyUser(requester, {
        title: 'Cập nhật firmware không thành công',
        body: `Thiết bị ${node.device_id} vẫn chạy ${node.firmware_version} sau 30 phút (mục tiêu ${pending.version}) — có thể đã rollback, kiểm tra log thiết bị.`,
      })
    }
  }
  return nodes.length
}

export async function sendRemoteCommand(nodeId: string, user: CurrentUser, input: RemoteCommandInput) {
  const node = await SensorNode.findById(nodeId)
  if (!node) throw NotFoundError('Không tìm thấy thiết bị')
  assertInService(node)
  const chain = await assertZoneAccess(String(node.zone_id), user)
  // Validate nội dung lệnh trước trạng thái thiết bị: URL firmware sai thì phải
  // báo đúng lý do đó, không lẫn với "thiết bị chưa ONLINE".
  if (input.command === 'OTA') {
    if (!input.ota) throw BadRequestError('Lệnh OTA cần version, url, sha256')
    assertAllowedFirmwareUrl(input.ota.url)
  }
  // DEGRADED = vẫn online, chỉ hỏng 1 phần (VD 1 cảm biến im) — restart/đẩy lại
  // cấu hình chính là cách xử lý đầu tiên cho tình trạng đó, không được chặn.
  if (node.status !== 'ONLINE' && node.status !== 'DEGRADED') {
    throw ConflictError(`Thiết bị đang ${node.status} — lệnh từ xa chỉ gửi được khi thiết bị ONLINE hoặc DEGRADED`)
  }

  if (!firmwareHandlesCommands() && UNSUPPORTED_COMMANDS.includes(input.command)) {
    throw NotImplementedError(
      `Firmware trên thiết bị chưa xử lý lệnh ${input.command} — hiện chỉ dùng được PUSH_CONFIG. ` +
      'Bật FIRMWARE_COMMAND_SUPPORT=true sau khi firmware hỗ trợ.',
    )
  }

  const ticket = input.ticket_id ? await Ticket.findById(input.ticket_id) : null
  if (input.ticket_id) {
    if (!ticket) throw NotFoundError('Không tìm thấy ticket')
    if (String(ticket.farm_id) !== String(chain.farm._id)) throw BadRequestError('Ticket không thuộc farm của thiết bị này')
    if (ticket.status === 'CLOSED') throw ConflictError('Ticket đã đóng')
    // Ghi note vào ticket là thao tác xử lý — cùng quy tắc với đổi trạng thái: chỉ người được gán
    if (user.role === 'TECHNICIAN' && String(ticket.assigned_to ?? '') !== user._id) {
      throw ForbiddenError('Chỉ Technician đang được gán ticket này mới ghi lệnh từ xa vào ticket')
    }
  }

  let payload: Record<string, unknown>
  let summary: string
  switch (input.command) {
    case 'PUSH_CONFIG':
      payload = { ...chain.zone.thresholds }
      summary = 'đẩy lại cấu hình ngưỡng của Zone'
      break
    case 'RESTART':
      payload = { command: 'RESTART' }
      summary = 'khởi động lại thiết bị'
      break
    case 'OTA': {
      if (!input.ota) throw BadRequestError('Lệnh OTA cần version, url, sha256')
      if (input.ota.version === node.firmware_version) {
        throw ConflictError(`Thiết bị đang chạy đúng phiên bản ${input.ota.version}`)
      }
      const { version, url, sha256 } = input.ota
      payload = { command: 'OTA', ota: { version, url, sha256 } }
      summary = `đẩy OTA ${node.firmware_version} → ${input.ota.version}`
      break
    }
    default:
      throw BadRequestError('command phải là RESTART, PUSH_CONFIG hoặc OTA')
  }

  const delivered = publishCommand(String(chain.farm._id), String(chain.house._id), String(chain.zone._id), 'config/update', payload)
  if (!delivered) {
    // Không ghi ota_pending khi lệnh chưa rời backend: nếu ghi, UI hiện "đang cập
    // nhật" rồi 30 phút sau báo thất bại cho một lệnh chưa từng được gửi đi.
    throw ServiceUnavailableError('Không gửi được lệnh: backend chưa kết nối MQTT broker. Thử lại sau ít phút.')
  }

  if (input.command === 'OTA' && input.ota) {
    node.ota_pending = { version: input.ota.version, url: input.ota.url, requested_at: new Date(), requested_by: user._id as never }
    node.ota_failed = undefined
    await node.save()
  }

  if (ticket) {
    // Chỉ biết lệnh đã tới broker, KHÔNG biết thiết bị đã thực thi — note phải nói
    // đúng chừng đó, nếu không Technician đọc ticket tưởng việc đã xong.
    ticket.notes.push({
      author_id: user._id as never,
      content: `Xử lý từ xa trên thiết bị ${node.device_id}: đã gửi lệnh ${summary}, chờ thiết bị xác nhận`,
      created_at: new Date(),
    })
    await ticket.save()
  }
  await logAction(user._id, 'DEVICE_COMMAND_SENT', 'sensor_node', String(node._id), {
    deviceId: node.device_id, command: input.command, ticketId: input.ticket_id ?? null,
    ...(input.ota ? { version: input.ota.version, url: input.ota.url } : {}),
  })
  return node
}

/** Flow 1 case 8a — SRS: quá 15 phút từ lúc đăng ký (bước 4) mà chưa có heartbeat đầu tiên */
export const ACTIVATION_TIMEOUT_MS = 15 * 60 * 1000

/**
 * Flow 1 case 8a — gọi từ jobs/activationOverdue.job.ts. Node còn PENDING quá
 * hạn được đánh dấu 1 lần (không đổi status: thiết bị vẫn có thể lên mạng sau
 * khi Technician kiểm tra lại bước 5–7), ghi audit và báo người đã onboarding.
 *
 * CHỈ quét SensorNode: Camera Node (Raspberry Pi) chưa có kênh heartbeat nào —
 * `ai-pipeline` chưa deploy, mqtt/handlers không xử lý `vision/heartbeat` — nên
 * camera nào cũng sẽ bị báo "quá hạn" sau 15 phút dù lắp đúng. Mở lại phần
 * camera khi có handler heartbeat cho nó.
 */
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
        body: `Thiết bị ${node.device_id} chưa gửi heartbeat sau 15 phút. Kiểm tra lại AP-mode, WiFi farm và kết nối MQTT tại hiện trường.`,
      })
    }
  }
  return nodes.length
}

/**
 * ENV-FR-018 — gọi định kỳ từ jobs/overrideExpiry.job.ts. Firmware cũng tự hết
 * hạn override sau 30 phút, nhưng backend phải tự trả về AUTO độc lập: nếu chỉ
 * dựa vào firmware, khi thiết bị mất kết nối đúng lúc hết hạn thì DB sẽ kẹt ở
 * MANUAL vĩnh viễn và dashboard hiển thị sai chế độ.
 */
export async function expireManualOverrides(): Promise<number> {
  const expired = await SensorNode.find({
    control_mode: 'MANUAL',
    override_expiry: { $lt: new Date() },
  }).lean()
  if (expired.length === 0) return 0

  await SensorNode.updateMany(
    { _id: { $in: expired.map(n => n._id) } },
    { control_mode: 'AUTO', $unset: { override_expiry: 1 } },
  )

  // Nhiều node có thể cùng zone — dedupe zoneId trước khi tra chain, tránh
  // lặp lại 3 lượt findById (Zone→House→Farm) cho cùng 1 zone nhiều lần.
  const uniqueZoneIds = [...new Set(expired.map(n => String(n.zone_id)))]
  const chainByZone = new Map(
    await Promise.all(
      uniqueZoneIds.map(async zid => [zid, await findZoneChainOrThrow(zid).catch(() => null)] as const),
    ),
  )

  for (const node of expired) {
    const chain = chainByZone.get(String(node.zone_id))
    if (!chain) continue
    publishCommand(String(chain.farm._id), String(chain.house._id), String(chain.zone._id), 'relay/command', {
      action: 'clear_override',
    })
    for (const relayName of Object.keys(node.relay_states) as Array<keyof RelayStates>) {
      emitRelayUpdate(String(chain.zone._id), {
        zoneId: String(chain.zone._id),
        relayName,
        state: node.relay_states[relayName],
        mode: 'AUTO',
      })
    }
  }
  return expired.length
}

/** ENV-FR-015 — xác nhận trạng thái relay thật từ ESP32 (gọi từ mqtt/handlers/relayStatus.handler.ts) */
export async function confirmRelayStatus(payload: RelayStatusPayload): Promise<void> {
  if (!payload.deviceId) throw NotFoundError('Thiếu deviceId trong relay/status payload')

  const node = await SensorNode.findOne({ device_id: payload.deviceId, ...IN_SERVICE })
  if (!node) throw NotFoundError(`Không tìm thấy SensorNode với device_id="${payload.deviceId}"`)

  // Không đụng status/last_heartbeat: liveness chỉ do heartbeat/telemetry quyết
  // định (message relay/status retained cũ từng làm "hồi sinh" thiết bị đã chết).
  node.relay_states = payload.relay_states
  node.control_mode = payload.control_mode
  if (payload.control_mode === 'AUTO') node.override_expiry = undefined
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

export interface DeviceStatusSummary {
  total: number; online: number; offline: number; pending: number; error: number; degraded: number
}

export function summarizeByStatus(nodes: Array<{ status: DeviceStatus }>): DeviceStatusSummary {
  const summary: DeviceStatusSummary = { total: nodes.length, online: 0, offline: 0, pending: 0, error: 0, degraded: 0 }
  for (const n of nodes) summary[n.status.toLowerCase() as Exclude<keyof DeviceStatusSummary, 'total'>]++
  return summary
}

/**
 * OPS-NFR-004 — Admin xem nhanh trạng thái toàn bộ node trong hệ thống (không
 * giới hạn theo Farm, khác `listSensorNodes`). Shape khớp `SystemNodeStatus`
 * bên frontend (trang AdminNodeStatus). Join Zone→House→Farm bằng vài query gộp
 * thay vì N+1 populate. Chỉ tính thiết bị của Farm chưa xoá mềm — cùng phạm vi với
 * `getHealthOverview` (SYSTEM-FR-003), để 2 màn hình trên cùng trang không lệch số.
 */
export async function getSystemStatus() {
  const activeZoneIds = await listActiveZoneIds()
  const [sensorNodes, cameraNodes] = await Promise.all([
    SensorNode.find({ zone_id: { $in: activeZoneIds }, ...IN_SERVICE }).sort({ registered_at: -1 }).lean(),
    CameraNode.find({ zone_id: { $in: activeZoneIds }, ...IN_SERVICE }).sort({ registered_at: -1 }).lean(),
  ])

  const zoneIds = [...new Set([...sensorNodes, ...cameraNodes].map(n => String(n.zone_id)))]
  const zones = await Zone.find({ _id: { $in: zoneIds } }).select('name house_id').lean()
  const houseIds = [...new Set(zones.map(z => String(z.house_id)))]
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
    return { farm_name: farm?.name ?? '', house_name: house?.name ?? '', zone_name: zone?.name ?? '' }
  }

  return {
    summary: summarizeByStatus([...sensorNodes, ...cameraNodes]),
    nodes: [
      ...sensorNodes.map(n => ({
        _id: String(n._id), device_id: n.device_id, type: 'sensor' as const, status: n.status,
        last_heartbeat: n.last_heartbeat, rssi: n.rssi, ...resolveLocation(String(n.zone_id)),
      })),
      ...cameraNodes.map(n => ({
        _id: String(n._id), device_id: n.device_id, type: 'camera' as const, status: n.status,
        last_heartbeat: n.last_heartbeat, ...resolveLocation(String(n.zone_id)),
      })),
    ],
  }
}
