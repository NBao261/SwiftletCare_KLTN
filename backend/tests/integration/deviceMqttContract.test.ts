/**
 * Hợp đồng MQTT ESP32 ↔ backend: telemetry (throttle ghi DB, dữ liệu buffer offline),
 * cảnh báo thiết bị, relay/status, heartbeat resync config, API lịch loa ru.
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import deviceRoutes from '@/routes/devices.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { Alert } from '@/models/alert.model'
import { AuditLog } from '@/models/auditLog.model'
import { SensorNode } from '@/models/device.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { Telemetry } from '@/models/telemetry.model'
import { User } from '@/models/user.model'
import { publishCommand } from '@/mqtt/mqtt.client'
import { emitTelemetryUpdate } from '@/socket'
import { createAlert, ingestDeviceAlert, resolveStaleThresholdAlerts } from '@/services/alert.service'
import { buildDeviceConfig, confirmRelayStatus, markNodeSeen, recordHeartbeat } from '@/services/device.service'
import { ingestTelemetry } from '@/services/telemetry.service'
import { DEFAULT_THRESHOLDS } from '@/utils/thresholds.util'
import type { TelemetryPayload } from '@/types'

jest.mock('@/mqtt/mqtt.client', () => ({ publishCommand: jest.fn() }))
jest.mock('@/socket', () => ({
  emitTelemetryUpdate: jest.fn(), emitRelayUpdate: jest.fn(), emitAlertNew: jest.fn(),
  emitDeviceStatusChange: jest.fn(), emitBirdCountUpdate: jest.fn(),
}))
jest.mock('@/services/notification.service', () => ({ dispatchAlertNotification: jest.fn().mockResolvedValue(undefined) }))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/devices', deviceRoutes)
app.use(errorHandler)

let mongod: MongoMemoryServer

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  await mongoose.connect(mongod.getUri())
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongod.stop()
})

afterEach(async () => {
  jest.clearAllMocks()
  await Promise.all([
    Alert.deleteMany({}), AuditLog.deleteMany({}), Farm.deleteMany({}), House.deleteMany({}),
    SensorNode.deleteMany({}), Telemetry.deleteMany({}), User.deleteMany({}), Zone.deleteMany({}),
  ])
})

let seq = 0
async function seed(status: 'ONLINE' | 'OFFLINE' = 'ONLINE') {
  seq++
  const owner = await User.create({ email: `owner${seq}@test.vn`, password_hash: 'password123', full_name: 'Owner', role: 'FARM_OWNER' })
  const farm = await Farm.create({ name: 'Farm', address: 'HCMC', owner_id: owner._id })
  const house = await House.create({ farm_id: farm._id, name: 'House' })
  const zone = await Zone.create({ house_id: house._id, name: 'Zone' })
  const deviceId = `ESP32-${seq}`
  const node = await SensorNode.create({ device_id: deviceId, zone_id: zone._id, status })
  const token = jwt.sign({ sub: String(owner._id), role: 'FARM_OWNER' }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
  const topic = ['swiftletcare', String(farm._id), String(house._id), String(zone._id), 'heartbeat']
  return { farm, house, zone, node, deviceId, token, topic }
}

const reading = (deviceId: string, timestamp: number, over: Partial<TelemetryPayload> = {}) => ({
  deviceId, timestamp, temperature: 28, humidity: 85, light_lux: 0.1, nh3_ppm: 5, co2_ppm: 800, sound_db: 40,
  relay_states: { misting: false, speaker: false, ventilation: false, heating: false }, control_mode: 'AUTO' as const,
  ...over,
})

describe('ingestTelemetry', () => {
  it('persists live readings at most once per 10s but still pushes every reading to the dashboard', async () => {
    const { deviceId } = await seed()
    const t0 = Date.now()

    await ingestTelemetry(reading(deviceId, t0))
    await ingestTelemetry(reading(deviceId, t0 + 1_000))
    await ingestTelemetry(reading(deviceId, t0 + 10_000))

    expect(await Telemetry.countDocuments()).toBe(2)
    expect(emitTelemetryUpdate).toHaveBeenCalledTimes(3)
  })

  it('always persists a reading that breaches a threshold', async () => {
    const { deviceId } = await seed()
    const t0 = Date.now()

    await ingestTelemetry(reading(deviceId, t0))
    await ingestTelemetry(reading(deviceId, t0 + 1_000, { temperature: DEFAULT_THRESHOLDS.temp_max + 5 }))

    expect(await Telemetry.countDocuments({ is_anomaly: true })).toBe(1)
  })

  it('throttles a sustained breach like normal readings but records the moment it clears, with one alert', async () => {
    const { deviceId, zone } = await seed()
    const t0 = Date.now()
    const hot = { temperature: DEFAULT_THRESHOLDS.temp_max + 5 }

    for (let i = 0; i < 5; i++) await ingestTelemetry(reading(deviceId, t0 + i * 1_000, hot))
    await ingestTelemetry(reading(deviceId, t0 + 5_000))
    await new Promise(r => setImmediate(r)) // raiseThresholdAlert chạy fire-and-forget

    expect(await Telemetry.countDocuments({ is_anomaly: true })).toBe(1)
    expect(await Telemetry.countDocuments({ is_anomaly: false })).toBe(1)
    expect(await Alert.countDocuments({ zone_id: zone._id, type: 'THRESHOLD_BREACH' })).toBe(1)
  })

  it('stores flushed offline-buffer readings at their own time without touching the live dashboard', async () => {
    const { deviceId, zone } = await seed()
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000

    await ingestTelemetry(reading(deviceId, twoHoursAgo, { temperature: DEFAULT_THRESHOLDS.temp_max + 5 }))

    const [row] = await Telemetry.find().lean()
    expect(row.timestamp.getTime()).toBe(twoHoursAgo)
    expect(emitTelemetryUpdate).not.toHaveBeenCalled()
    expect(await Alert.countDocuments({ zone_id: zone._id })).toBe(0)
  })

  it('falls back to receive time when the device clock is not synced', async () => {
    const { deviceId } = await seed()

    await ingestTelemetry(reading(deviceId, 12_345)) // millis() since boot, not epoch

    const [row] = await Telemetry.find().lean()
    expect(Date.now() - row.timestamp.getTime()).toBeLessThan(5_000)
  })
})

describe('alert dedup per incident (ALERT-FR-008)', () => {
  const tenMinAgo = () => new Date(Date.now() - 10 * 60_000)
  const breachInput = (farm: { _id: unknown }, zone: { _id: unknown }, node: { _id: unknown }) => ({
    farmId: String(farm._id), zoneId: String(zone._id), nodeId: String(node._id),
    type: 'THRESHOLD_BREACH' as const, title: 'Vượt ngưỡng', message: 'Nhiệt độ 36',
  })

  it('folds a repeat into the open alert however old it is, instead of creating a new one', async () => {
    const { farm, zone, node } = await seed()
    const first = await createAlert(breachInput(farm, zone, node))
    await Alert.updateOne({ _id: first!._id }, { created_at: tenMinAgo(), last_seen_at: tenMinAgo(), status: 'ACKNOWLEDGED' })

    expect(await createAlert({ ...breachInput(farm, zone, node), message: 'Nhiệt độ 37' })).toBeNull()

    const [only] = await Alert.find().lean()
    expect(await Alert.countDocuments()).toBe(1)
    expect(only.occurrence_count).toBe(2)
    expect(only.message).toBe('Nhiệt độ 37')
    expect(Date.now() - only.last_seen_at!.getTime()).toBeLessThan(5_000)
  })

  it('auto-resolves threshold alerts not seen for 5 minutes and leaves fresh ones open', async () => {
    const { farm, zone, node } = await seed()
    const stale = await createAlert(breachInput(farm, zone, node))
    await Alert.updateOne({ _id: stale!._id }, { last_seen_at: tenMinAgo() })
    const other = await seed()
    const fresh = await createAlert(breachInput(other.farm, other.zone, other.node))

    expect(await resolveStaleThresholdAlerts()).toBe(1)
    expect((await Alert.findById(stale!._id).lean())!.status).toBe('RESOLVED')
    expect((await Alert.findById(fresh!._id).lean())!.status).toBe('ACTIVE')
  })

  it('closes the NODE_OFFLINE alert when the device comes back online', async () => {
    const { farm, zone, node } = await seed('OFFLINE')
    const offline = await createAlert({ ...breachInput(farm, zone, node), type: 'NODE_OFFLINE' })
    const breach = await createAlert(breachInput(farm, zone, node))

    await markNodeSeen(node)

    expect((await Alert.findById(offline!._id).lean())!.status).toBe('RESOLVED')
    expect((await Alert.findById(breach!._id).lean())!.status).toBe('ACTIVE')
  })
})

describe('ingestDeviceAlert', () => {
  it('creates an alert in the device farm/zone from the ESP32 payload', async () => {
    const { farm, zone, deviceId } = await seed()

    await ingestDeviceAlert({ type: 'SENSOR_FAULT', severity: 'MEDIUM', message: 'timeout', deviceId })

    const alert = await Alert.findOne().lean()
    expect(alert).toMatchObject({ type: 'SENSOR_FAULT', severity: 'MEDIUM', farm_id: farm._id, zone_id: zone._id })
  })

  it('rejects a payload without deviceId', async () => {
    await expect(ingestDeviceAlert({ type: 'SENSOR_FAULT', device_id: 'x' })).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('confirmRelayStatus', () => {
  it('updates relays without reviving an OFFLINE device and clears the override expiry on AUTO', async () => {
    const { node, deviceId } = await seed('OFFLINE')
    await SensorNode.updateOne({ _id: node._id }, { control_mode: 'MANUAL', override_expiry: new Date() })

    await confirmRelayStatus({ deviceId, relay_states: { misting: true, speaker: false, ventilation: false, heating: false }, control_mode: 'AUTO' })

    const after = (await SensorNode.findById(node._id))!
    expect(after.status).toBe('OFFLINE')
    expect(after.relay_states.misting).toBe(true)
    expect(after.override_expiry).toBeUndefined()
  })
})

describe('recordHeartbeat', () => {
  const hb = (deviceId: string, justConnected?: boolean) =>
    ({ deviceId, firmwareVersion: '1.1.0', rssi: -60, freeHeap: 1, uptime: 1, timestamp: 1, justConnected })

  it('re-sends the full config/update when the device has just (re)connected', async () => {
    const { deviceId, topic } = await seed()

    await recordHeartbeat(hb(deviceId, true), topic)

    expect(publishCommand).toHaveBeenCalledWith(topic[1], topic[2], topic[3], 'config/update',
      expect.objectContaining({ temp_max: DEFAULT_THRESHOLDS.temp_max, speaker_schedule_enabled: true }))
  })

  it('stays quiet on a routine heartbeat', async () => {
    const { deviceId, topic } = await seed()

    await recordHeartbeat(hb(deviceId), topic)

    expect(publishCommand).not.toHaveBeenCalled()
  })

  it('only sends config/reassign when the topic is wrong', async () => {
    const { deviceId, topic } = await seed()
    const wrongTopic = ['swiftletcare', 'farm-default', 'house-default', 'zone-default', 'heartbeat']

    await recordHeartbeat(hb(deviceId, true), wrongTopic)

    expect(publishCommand).toHaveBeenCalledTimes(1)
    expect(publishCommand).toHaveBeenCalledWith('farm-default', 'house-default', 'zone-default', 'config/reassign',
      { newFarmId: topic[1], newHouseId: topic[2], newZoneId: topic[3] })
  })
})

describe('buildDeviceConfig', () => {
  const node = (windows: Array<{ start: string; end: string }>) =>
    ({ speaker_schedule: { enabled: true, windows }, audio: { volume: 20, current_track: 3, playing: false, loop: true } })

  it('leaves window keys out when no schedule was ever set, so the firmware keeps its defaults', () => {
    const cfg = buildDeviceConfig(DEFAULT_THRESHOLDS, node([]))
    expect(cfg).not.toHaveProperty('speaker_window1_start_hour')
    expect(cfg).toMatchObject({ ...DEFAULT_THRESHOLDS, speaker_volume: 20, speaker_track: 3 })
  })

  it('maps one window and blanks the second', () => {
    expect(buildDeviceConfig(DEFAULT_THRESHOLDS, node([{ start: '05:00', end: '07:00' }]))).toMatchObject({
      speaker_window1_start_hour: 5, speaker_window1_end_hour: 7, speaker_window2_start_hour: 0, speaker_window2_end_hour: 0,
    })
  })

  it('maps two windows, including one ending at midnight', () => {
    expect(buildDeviceConfig(DEFAULT_THRESHOLDS, node([{ start: '05:00', end: '07:00' }, { start: '17:00', end: '24:00' }]))).toMatchObject({
      speaker_window2_start_hour: 17, speaker_window2_end_hour: 24,
    })
  })
})

describe('PUT /devices/sensor-nodes/:id/speaker-schedule', () => {
  it('saves the schedule, pushes it to the device and audits it', async () => {
    const { node, token, topic } = await seed()

    const res = await request(app)
      .put(`/devices/sensor-nodes/${node._id}/speaker-schedule`)
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: true, windows: [{ start: '04:00', end: '06:00' }], volume: 25, track: 2 })

    expect(res.status).toBe(200)
    const saved = (await SensorNode.findById(node._id))!.toObject()
    expect(saved.speaker_schedule.windows).toMatchObject([{ start: '04:00', end: '06:00' }])
    expect(saved.audio).toMatchObject({ volume: 25, current_track: 2 })
    expect(publishCommand).toHaveBeenCalledWith(topic[1], topic[2], topic[3], 'config/update',
      expect.objectContaining({ speaker_window1_start_hour: 4, speaker_window1_end_hour: 6, speaker_volume: 25, speaker_track: 2 }))
    expect(await AuditLog.countDocuments({ action: 'SPEAKER_SCHEDULE_UPDATED' })).toBe(1)
  })

  // 422 = express-validator (validate.middleware), 400 = BadRequestError từ service
  it.each([
    ['a window that ends before it starts', { windows: [{ start: '07:00', end: '05:00' }] }, 400],
    ['three windows', { windows: [{ start: '01:00', end: '02:00' }, { start: '03:00', end: '04:00' }, { start: '05:00', end: '06:00' }] }, 422],
    ['a non-whole hour', { windows: [{ start: '05:30', end: '07:00' }] }, 422],
    ['a volume above 30', { volume: 31 }, 422],
  ])('rejects %s', async (_label, body, status) => {
    const { node, token } = await seed()

    const res = await request(app)
      .put(`/devices/sensor-nodes/${node._id}/speaker-schedule`)
      .set('Authorization', `Bearer ${token}`)
      .send(body)

    expect(res.status).toBe(status)
    expect(publishCommand).not.toHaveBeenCalled()
  })
})
