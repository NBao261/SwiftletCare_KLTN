import { SensorNode, CameraNode, ISensorNode } from '@/models/device.model'
import { House, Zone } from '@/models/houseZone.model'
import { Farm } from '@/models/farm.model'
import { findZoneChainOrThrow, assertZoneAccess, listAccessibleZoneIds, listActiveZoneIds } from '@/utils/farmAccess.util'
import { publishCommand } from '@/mqtt/mqtt.client'
import { emitRelayUpdate, emitDeviceStatusChange } from '@/socket'
import { raiseNodeOfflineAlert } from '@/services/alert.service'
import { logAction } from '@/services/auditLog.service'
import { assertValidThresholds, pickThresholds } from '@/utils/thresholds.util'
import { applyThresholdUpdate } from '@/utils/thresholdUpdate.util'
import { NotFoundError, ConflictError, BadRequestError } from '@/utils/appError.util'
import logger from '@/utils/logger.util'
import type { RelayStates, HeartbeatPayload, RelayStatusPayload, CurrentUser, DeviceStatus, Thresholds } from '@/types'

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

  const node = await SensorNode.create({ device_id: input.device_id, zone_id: input.zone_id, status: 'PENDING' })
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

/** ENV-FR-006 (qua device, tương đương farmService.updateZoneThresholds — cùng validate) */
export async function updateNodeThresholds(nodeId: string, user: CurrentUser, updates: Partial<Thresholds>) {
  const node = await SensorNode.findById(nodeId)
  if (!node) throw NotFoundError('Không tìm thấy thiết bị')
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

  await logAction(user._id, 'RELAY_OVERRIDE', 'sensor_node', String(node._id), {
    relayName: input.relayName, state: input.state, durationMs: overrideMs,
  })
  return node
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
): Promise<ISensorNode> {
  const node = await SensorNode.findById(nodeId)
  if (!node) throw NotFoundError('Không tìm thấy thiết bị')

  if (node.status !== 'ONLINE') {
    throw ConflictError('Thiết bị đang OFFLINE — chỉ dời Zone được khi thiết bị ONLINE (nhánh AP-mode chưa được hỗ trợ)')
  }

  // Check quyền trên CẢ Farm nguồn lẫn Farm đích (SRS Flow 21 bước 4a).
  const sourceChain = await assertZoneAccess(String(node.zone_id), user)
  const destChain = await assertZoneAccess(input.newZoneId, user)

  // Publish lên topic CŨ — thiết bị vẫn đang lắng nghe ở đó cho tới khi restart.
  publishCommand(String(sourceChain.farm._id), String(sourceChain.house._id), String(sourceChain.zone._id), 'config/reassign', {
    newFarmId: String(destChain.farm._id),
    newHouseId: String(destChain.house._id),
    newZoneId: String(destChain.zone._id),
  })

  // Cập nhật lạc quan — giống pattern controlRelay/updateNodeThresholds ở trên.
  node.zone_id = destChain.zone._id
  await node.save()

  await logAction(user._id, 'DEVICE_REASSIGNED', 'sensor_node', String(node._id), {
    fromZoneId: String(sourceChain.zone._id), toZoneId: String(destChain.zone._id),
  })
  return node
}

/** FARM-FR-004 — chỉ Technician/Admin, cùng Web Console Onboarding với sensor node (Flow 1b) */
export async function registerCameraNode(user: CurrentUser, input: { device_id: string; zone_id: string; rtsp_url?: string }) {
  await assertZoneAccess(input.zone_id, user)

  const existing = await CameraNode.findOne({ device_id: input.device_id })
  if (existing) throw ConflictError('device_id đã được đăng ký')

  const node = await CameraNode.create({ ...input, status: 'PENDING' })
  await logAction(user._id, 'DEVICE_REGISTERED', 'camera_node', String(node._id), {
    deviceId: input.device_id, zoneId: input.zone_id,
  })
  return node
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
    SensorNode.find({ zone_id: { $in: activeZoneIds } }).sort({ registered_at: -1 }).lean(),
    CameraNode.find({ zone_id: { $in: activeZoneIds } }).sort({ registered_at: -1 }).lean(),
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
