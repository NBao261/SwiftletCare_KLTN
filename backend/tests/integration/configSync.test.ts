/**
 * ENV-FR-027, BR-24, Report 3 §6.12 (SM-12) — phiên bản cấu hình của Zone, trạng thái đồng bộ từng
 * controller và CONFIG_MISMATCH. TC-ST-28…32 (Report 5) cùng các chuyển của SRS 4.2.1.
 */
import { Alert } from '@/models/alert.model'
import { SensorNode } from '@/models/device.model'
import { Zone } from '@/models/houseZone.model'
import { publishDeviceConfig } from '@/mqtt/mqtt.client'
import { syncControllerConfigs } from '@/services/configSync.service'
import { publishZoneConfig } from '@/services/deviceConfig.service'
import { reassignZone, recordHeartbeat } from '@/services/device.service'
import { updateZoneThresholds } from '@/services/farm.service'
import { seedOwnerFarm, useTestDb } from '../helpers/ownerFarm'
import type { HeartbeatPayload } from '@/types'

jest.mock('@/mqtt/mqtt.client', () => ({ publishDeviceCommand: jest.fn().mockReturnValue(true), publishDeviceConfig: jest.fn().mockReturnValue(true) }))
jest.mock('@/socket', () => ({
  emitTelemetryUpdate: jest.fn(), emitRelayUpdate: jest.fn(), emitAlertNew: jest.fn(),
  emitDeviceStatusChange: jest.fn(), emitBirdCountUpdate: jest.fn(), disconnectUser: jest.fn(),
}))
jest.mock('@/services/notification.service', () => ({
  ...jest.requireActual('@/services/notification.service'),
  dispatchAlertNotification: jest.fn().mockResolvedValue(undefined),
  notifyUser: jest.fn().mockResolvedValue(undefined),
  notifyAdmins: jest.fn().mockResolvedValue(undefined),
}))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

useTestDb()

const heartbeat = (deviceId: string, appliedConfigVersion?: number) =>
  recordHeartbeat({ deviceId, firmwareVersion: '2.1.0', rssi: -60, freeHeap: 1, uptime: 1, timestamp: 1, appliedConfigVersion } as HeartbeatPayload)

const zoneVersion = async (zoneId: unknown) => (await Zone.findById(zoneId).lean())!.config_version
const syncOf = async (nodeId: unknown) => (await SensorNode.findById(nodeId).lean())!.config_sync
const openMismatches = () => Alert.countDocuments({ type: 'CONFIG_MISMATCH', status: { $in: ['ACTIVE', 'ACKNOWLEDGED'] } })

describe('Phiên bản cấu hình của Zone (ENV-FR-027)', () => {
  it('controller mới đăng ký bắt đầu ở PENDING (FARM-FR-012, SRS 6.12 (new) → PENDING)', async () => {
    const { node } = await seedOwnerFarm()
    expect(await syncOf(node._id)).toBe('PENDING')
  })

  it('mỗi lần đổi tham số cho phiên bản lớn hơn, kể cả hai lần trong cùng một giây', async () => {
    const { zone } = await seedOwnerFarm()
    const before = await zoneVersion(zone._id)
    await publishZoneConfig(zone._id)
    const first = await zoneVersion(zone._id)
    await publishZoneConfig(zone._id)
    expect(first).toBeGreaterThan(before)
    expect(await zoneVersion(zone._id)).toBeGreaterThan(first)
  })

  it('TC-ST-28 APPLIED → PENDING: sửa ngưỡng gửi cấu hình kèm phiên bản mới, controller về PENDING', async () => {
    const { zone, node, user } = await seedOwnerFarm()
    await heartbeat(node.device_id, await zoneVersion(zone._id))
    expect(await syncOf(node._id)).toBe('APPLIED')

    await updateZoneThresholds(String(zone._id), user, { temp_max: 32 })

    const version = await zoneVersion(zone._id)
    expect(await syncOf(node._id)).toBe('PENDING')
    expect(publishDeviceConfig).toHaveBeenLastCalledWith(node.device_id, expect.objectContaining({ config_version: version, temp_max: 32 }))
  })

  it('TC-ST-29 PENDING → APPLIED: heartbeat báo đúng phiên bản của Zone', async () => {
    const { zone, node } = await seedOwnerFarm()
    await publishZoneConfig(zone._id)
    await heartbeat(node.device_id, await zoneVersion(zone._id))
    const saved = (await SensorNode.findById(node._id).lean())!
    expect(saved.config_sync).toBe('APPLIED')
    expect(saved.applied_config_version).toBe(await zoneVersion(zone._id))
  })

  it('TC-ST-30 PENDING → MISMATCH: 3 heartbeat online vẫn báo bản cũ thì một CONFIG_MISMATCH và cấu hình được gửi lại', async () => {
    const { zone, node } = await seedOwnerFarm()
    const old = await zoneVersion(zone._id)
    await publishZoneConfig(zone._id)

    await heartbeat(node.device_id, old)
    await heartbeat(node.device_id, old)
    expect(await syncOf(node._id)).toBe('PENDING')
    await syncControllerConfigs()
    expect(await openMismatches()).toBe(0)

    await heartbeat(node.device_id, old)
    expect(await syncOf(node._id)).toBe('MISMATCH')
    jest.mocked(publishDeviceConfig).mockClear()
    const run = await syncControllerConfigs()
    await syncControllerConfigs()

    expect(run).toMatchObject({ republished: 1, raised: 1 })
    expect(publishDeviceConfig).toHaveBeenCalledWith(node.device_id, expect.objectContaining({ config_version: await zoneVersion(zone._id) }))
    const alert = (await Alert.findOne({ type: 'CONFIG_MISMATCH' }).lean())!
    expect(await openMismatches()).toBe(1)
    expect(alert.severity).toBe('MEDIUM')
    expect(String(alert.node_id)).toBe(String(node._id))
  })

  it('TC-ST-31 MISMATCH → APPLIED: áp đúng phiên bản thì cảnh báo được đóng', async () => {
    const { zone, node } = await seedOwnerFarm()
    const old = await zoneVersion(zone._id)
    await publishZoneConfig(zone._id)
    for (let i = 0; i < 3; i++) await heartbeat(node.device_id, old)
    await syncControllerConfigs()
    expect(await openMismatches()).toBe(1)

    await heartbeat(node.device_id, await zoneVersion(zone._id))
    const run = await syncControllerConfigs()

    expect(await syncOf(node._id)).toBe('APPLIED')
    expect(run.resolved).toBe(1)
    expect(await openMismatches()).toBe(0)
  })

  it('TC-ST-32 any → UNKNOWN: firmware không báo phiên bản thì UNKNOWN và không có cảnh báo', async () => {
    const { zone, node } = await seedOwnerFarm()
    await publishZoneConfig(zone._id)
    for (let i = 0; i < 4; i++) await heartbeat(node.device_id)
    jest.mocked(publishDeviceConfig).mockClear()
    await syncControllerConfigs()

    const saved = (await SensorNode.findById(node._id).lean())!
    expect(saved.config_sync).toBe('UNKNOWN')
    expect(saved.applied_config_version).toBeNull()
    expect(await openMismatches()).toBe(0)
    expect(publishDeviceConfig).not.toHaveBeenCalled()
  })

  it('UNKNOWN → APPLIED khi firmware mới báo đúng phiên bản, UNKNOWN → PENDING khi báo bản cũ', async () => {
    const { zone, node } = await seedOwnerFarm()
    const old = await zoneVersion(zone._id)
    await publishZoneConfig(zone._id)
    await heartbeat(node.device_id)
    await heartbeat(node.device_id, old)
    expect(await syncOf(node._id)).toBe('PENDING')
    await heartbeat(node.device_id)
    await heartbeat(node.device_id, await zoneVersion(zone._id))
    expect(await syncOf(node._id)).toBe('APPLIED')
  })

  it('controller offline đang MISMATCH không bị cảnh báo và không được gửi lại; nó nhận config retained khi kết nối', async () => {
    const { zone, node } = await seedOwnerFarm()
    const old = await zoneVersion(zone._id)
    await publishZoneConfig(zone._id)
    for (let i = 0; i < 3; i++) await heartbeat(node.device_id, old)
    await SensorNode.updateOne({ _id: node._id }, { status: 'OFFLINE' })
    jest.mocked(publishDeviceConfig).mockClear()

    expect(await syncControllerConfigs()).toEqual({ republished: 0, raised: 0, resolved: 0 })
    expect(publishDeviceConfig).not.toHaveBeenCalled()
  })

  it('dời controller (FARM-FR-007b): Zone đích có phiên bản mới, controller dời và controller cũ của Zone đích về PENDING', async () => {
    const { zone, node, user, farm } = await seedOwnerFarm()
    const dest = await Zone.create({ house_id: zone.house_id, farm_id: farm._id, name: 'Z2', config_version: await zoneVersion(zone._id) })
    const sibling = await SensorNode.create({ device_id: 'ESP-SIB', zone_id: dest._id, status: 'ONLINE', config_sync: 'APPLIED' })
    await heartbeat(node.device_id, await zoneVersion(zone._id))

    await reassignZone(String(node._id), user, { newZoneId: String(dest._id) })

    expect(await zoneVersion(dest._id)).toBeGreaterThan(await zoneVersion(zone._id))
    expect(await syncOf(node._id)).toBe('PENDING')
    expect(await syncOf(sibling._id)).toBe('PENDING')
    // Phiên bản cũ trùng số với Zone đích trước khi dời không còn được coi là đã áp
    await heartbeat(node.device_id, await zoneVersion(zone._id))
    expect(await syncOf(node._id)).toBe('PENDING')
  })

  it('TC-F19-03 dời controller đang offline: cấu hình Zone mới chờ retained, "đã áp" chỉ sau heartbeat báo phiên bản mới', async () => {
    const { zone, node, user, farm } = await seedOwnerFarm()
    const dest = await Zone.create({ house_id: zone.house_id, farm_id: farm._id, name: 'Z2' })
    await SensorNode.updateOne({ _id: node._id }, { status: 'OFFLINE' })

    const { delivered } = await reassignZone(String(node._id), user, { newZoneId: String(dest._id) })
    const version = await zoneVersion(dest._id)

    expect(delivered).toBe(true)
    expect(publishDeviceConfig).toHaveBeenCalledWith(node.device_id, expect.objectContaining({ config_version: version }))
    expect(await syncOf(node._id)).toBe('PENDING')
    await heartbeat(node.device_id, version)
    const saved = (await SensorNode.findById(node._id).lean())!
    expect(saved).toMatchObject({ status: 'ONLINE', config_sync: 'APPLIED', zone_id: dest._id })
  })
})
