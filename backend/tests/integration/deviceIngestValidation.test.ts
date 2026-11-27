jest.mock('@/mqtt/mqtt.client', () => ({ publishDeviceCommand: jest.fn().mockReturnValue(true), publishDeviceConfig: jest.fn().mockReturnValue(true) }))
jest.mock('@/socket', () => new Proxy({}, { get: () => jest.fn() }))

import { Alert } from '@/models/alert.model'
import { CameraNode, SensorNode } from '@/models/device.model'
import { Telemetry } from '@/models/telemetry.model'
import { MAX_OVERRIDE_MS, confirmRelayStatus, recordHeartbeat } from '@/services/device.service'
import { ingestBirdCount } from '@/services/birdCount.service'
import { ingestDeviceAlert } from '@/services/alert.service'
import { ingestTelemetry } from '@/services/telemetry.service'
import type { BirdCountPayload, HeartbeatPayload, RelayStatusPayload, TelemetryPayload } from '@/types'
import { seedOwnerFarm, useTestDb } from '../helpers/ownerFarm'

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

useTestDb()
// useTestDb không xoá camera
afterEach(async () => { await CameraNode.deleteMany({}) })

// Tin MQTT là JSON tuỳ ý: ép kiểu như handler làm
const as = <T>(value: Record<string, unknown>) => value as unknown as T

describe('telemetry: số đo ngoài khoảng cảm biến được coi là thiếu', () => {
  it('độ ẩm 9999 không được lưu và không tạo cảnh báo', async () => {
    const { node } = await seedOwnerFarm()
    await ingestTelemetry(as<TelemetryPayload>({
      deviceId: node.device_id, temperature: 29, humidity: 9999, light_lux: 0, nh3_ppm: 5, co2_ppm: 800, sound_db: 40,
      relay_states: { misting: false, ventilation: false, speaker: false }, control_mode: 'AUTO', timestamp: Date.now(),
    }))
    const stored = await Telemetry.findOne({ node_id: node._id }).lean()
    expect(stored?.temperature).toBe(29)
    expect(stored?.humidity).toBeUndefined()
    expect(stored?.stale_fields).toContain('humidity')
    expect(await Alert.countDocuments()).toBe(0)
  })

  it('relay_states sai kiểu không làm hỏng tin', async () => {
    const { node } = await seedOwnerFarm()
    await ingestTelemetry(as<TelemetryPayload>({
      deviceId: node.device_id, temperature: 29, humidity: 85, light_lux: 0, nh3_ppm: 5, co2_ppm: 800, sound_db: 40,
      relay_states: 'on', control_mode: 'LẠ', timestamp: Date.now(),
    }))
    expect(await Telemetry.countDocuments({ node_id: node._id })).toBe(1)
  })
})

describe('heartbeat: trường sai kiểu không làm mất heartbeat', () => {
  it('rssi là chuỗi vẫn ghi last_heartbeat và bỏ rssi', async () => {
    const { node } = await seedOwnerFarm()
    await SensorNode.updateOne({ _id: node._id }, { status: 'OFFLINE' })
    await recordHeartbeat(as<HeartbeatPayload>({ deviceId: node.device_id, rssi: 'abc', firmwareVersion: { v: 1 }, uptime: 1000 }))
    const after = await SensorNode.findById(node._id).lean()
    expect(after?.status).toBe('ONLINE')
    expect(after?.rssi).toBeUndefined()
  })

  it('nút AI: fps và phiên bản mô hình sai kiểu bị bỏ', async () => {
    const { farm } = await seedOwnerFarm()
    const house = await (await import('@/models/houseZone.model')).House.findOne({ farm_id: farm._id })
    const camera = await CameraNode.create({ device_id: 'cam-1', house_id: house!._id, status: 'ONLINE' })
    await recordHeartbeat(as<HeartbeatPayload>({ deviceId: 'cam-1', fps: 'nhanh', modelVersion: ['x'] }))
    const after = await CameraNode.findById(camera._id).lean()
    expect(after?.fps).toBeUndefined()
    expect(after?.model_version).toBeUndefined()
  })
})

describe('relay/status', () => {
  it('thiếu relay_states → từ chối, không ném TypeError', async () => {
    const { node } = await seedOwnerFarm()
    await expect(confirmRelayStatus(as<RelayStatusPayload>({ deviceId: node.device_id }))).rejects.toMatchObject({ statusCode: 400 })
  })

  it('remaining_ms khổng lồ chỉ cho hạn tối đa 24 giờ', async () => {
    const { node } = await seedOwnerFarm()
    const before = Date.now()
    await confirmRelayStatus(as<RelayStatusPayload>({
      deviceId: node.device_id, control_mode: 'MANUAL',
      relay_states: { misting: true, ventilation: false, speaker: false },
      relays: { misting: { mode: 'MANUAL', remaining_ms: 10 ** 12 } },
    }))
    const after = await SensorNode.findById(node._id).lean()
    const expiry = after?.relays.misting.override_expiry?.getTime() ?? 0
    expect(expiry).toBeLessThanOrEqual(Date.now() + MAX_OVERRIDE_MS)
    expect(expiry).toBeGreaterThan(before)
  })
})

describe('cảnh báo từ thiết bị', () => {
  it('nội dung và link ảnh không hợp lệ bị bỏ, vẫn tạo cảnh báo', async () => {
    const { node } = await seedOwnerFarm()
    const alert = await ingestDeviceAlert({
      deviceId: node.device_id, type: 'NOISE_ANOMALY', message: { a: 1 }, snapshotUrl: 'javascript:alert(1)',
    })
    expect(alert?.snapshot_url ?? alert?.metadata?.snapshotUrl).toBeUndefined()
    expect(typeof alert?.message).toBe('string')
  })
})

describe('bird-count', () => {
  const camera = async () => {
    const { farm } = await seedOwnerFarm()
    const house = await (await import('@/models/houseZone.model')).House.findOne({ farm_id: farm._id })
    return CameraNode.create({ device_id: 'cam-bc', house_id: house!._id, status: 'ONLINE' })
  }

  it.each([
    ['số đếm quá lớn', { entry_count: 1_000_001, exit_count: 0, session_type: 'MORNING_EXIT' }],
    ['bucket_start năm 1970', { kind: 'BUCKET', entry_count: 1, exit_count: 1, bucket_start: 1000 }],
    ['bucket_start ở tương lai xa', { kind: 'BUCKET', entry_count: 1, exit_count: 1, bucket_start: Date.now() + 86_400_000 }],
  ])('%s → từ chối', async (_label, payload) => {
    await camera()
    await expect(ingestBirdCount(as<BirdCountPayload>({ deviceId: 'cam-bc', ...payload }))).rejects.toMatchObject({ statusCode: 400 })
  })

  it('giờ của phiên năm 1970 thì lấy giờ nhận', async () => {
    await camera()
    const result = await ingestBirdCount(as<BirdCountPayload>({
      deviceId: 'cam-bc', session_type: 'MORNING_EXIT', entry_count: 3, exit_count: 5, timestamp: 1000,
    }))
    expect(result?.sessionDate).not.toBe('1970-01-01')
  })
})
