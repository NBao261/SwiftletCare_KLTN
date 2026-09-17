import { SensorNode, CameraNode, ISensorNode } from '@/models/device.model'
import { findZoneChainOrThrow, assertZoneAccess, listAccessibleZoneIds } from '@/utils/farmAccess.util'
import { publishCommand } from '@/mqtt/mqtt.client'
import { emitRelayUpdate, emitDeviceStatusChange } from '@/socket'
import { raiseNodeOfflineAlert } from '@/services/alert.service'
import { NotFoundError, ConflictError, BadRequestError } from '@/utils/appError.util'
import logger from '@/utils/logger.util'
import type { RelayStates, HeartbeatPayload, RelayStatusPayload, CurrentUser } from '@/types'

const RELAY_NAMES = ['misting', 'speaker', 'ventilation', 'heating'] as const
type RelayName = typeof RELAY_NAMES[number]

/** FARM-FR-005 — quá thời gian này không có heartbeat mới thì coi là mất kết nối */
export const OFFLINE_THRESHOLD_MS = 30_000

/**
 * FARM-FR-003 — chỉ Technician (hoặc Admin) thực hiện, qua Web Console Onboarding.
 * Node được tạo ở trạng thái PENDING và chỉ chuyển ONLINE khi thiết bị gửi
 * heartbeat đầu tiên (Flow 1 bước 4→8), nên Farm Owner nhìn thấy ngay là thiết bị
 * đã khai báo nhưng chưa thật sự kết nối.
 */
export async function registerSensorNode(user: CurrentUser, input: { device_id: string; zone_id: string }): Promise<ISensorNode> {
  await assertZoneAccess(input.zone_id, user)

  const existing = await SensorNode.findOne({ device_id: input.device_id })
  if (existing) throw ConflictError('device_id đã được đăng ký')

  return SensorNode.create({ device_id: input.device_id, zone_id: input.zone_id, status: 'PENDING' })
}

/**
 * FARM-FR-005/006 — có `zoneId` thì check quyền đúng zone đó; không có thì lọc
 * theo toàn bộ zone user được quyền xem, KHÔNG trả về mọi thiết bị trong hệ
 * thống (trước đây bỏ sót — Farm Owner farm A đọc được thiết bị farm B).
 */
export async function listSensorNodes(zoneId: string | undefined, user: CurrentUser): Promise<ISensorNode[]> {
  if (zoneId) {
    await assertZoneAccess(zoneId, user)
    return SensorNode.find({ zone_id: zoneId }).sort({ registered_at: -1 }).lean() as unknown as ISensorNode[]
  }
  const accessibleZoneIds = await listAccessibleZoneIds(user)
  return SensorNode.find({ zone_id: { $in: accessibleZoneIds } }).sort({ registered_at: -1 }).lean() as unknown as ISensorNode[]
}

/** FARM-FR-006 */
export async function getSensorNode(nodeId: string, user: CurrentUser): Promise<ISensorNode> {
  const node = await SensorNode.findById(nodeId)
  if (!node) throw NotFoundError('Không tìm thấy thiết bị')
  await assertZoneAccess(String(node.zone_id), user)
  return node
}

/** ENV-FR-006 (qua device, tương đương farmService.updateZoneThresholds) */
export async function updateNodeThresholds(nodeId: string, user: CurrentUser, updates: object) {
  const node = await SensorNode.findById(nodeId)
  if (!node) throw NotFoundError('Không tìm thấy thiết bị')
  const chain = await assertZoneAccess(String(node.zone_id), user)

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
  const node = await SensorNode.findById(nodeId)
  if (!node) throw NotFoundError('Không tìm thấy thiết bị')
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

/** FARM-FR-004 — chỉ Technician/Admin, cùng Web Console Onboarding với sensor node (Flow 1b) */
export async function registerCameraNode(user: CurrentUser, input: { device_id: string; zone_id: string; rtsp_url?: string }) {
  await assertZoneAccess(input.zone_id, user)

  const existing = await CameraNode.findOne({ device_id: input.device_id })
  if (existing) throw ConflictError('device_id đã được đăng ký')

  return CameraNode.create({ ...input, status: 'PENDING' })
}

export async function listCameraNodes(zoneId: string | undefined, user: CurrentUser) {
  if (zoneId) {
    await assertZoneAccess(zoneId, user)
    return CameraNode.find({ zone_id: zoneId }).sort({ registered_at: -1 }).lean()
  }
  const accessibleZoneIds = await listAccessibleZoneIds(user)
  return CameraNode.find({ zone_id: { $in: accessibleZoneIds } }).sort({ registered_at: -1 }).lean()
}

/** FARM-FR-005 — gọi từ mqtt/handlers/heartbeat.handler.ts. */
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
