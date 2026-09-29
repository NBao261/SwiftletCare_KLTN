/**
 * Bộ điều khiển mờ (SRS v1.24.0): lưu đầu ra vào telemetry (ENV-FR-010/011),
 * chỉnh hệ số theo Zone qua config/update (ENV-FR-021), đo hiệu quả điều khiển
 * (ANALYTICS-FR-008).
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import farmRoutes from '@/routes/farms.route'
import analyticsRoutes from '@/routes/analytics.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { AuditLog } from '@/models/auditLog.model'
import { SensorNode } from '@/models/device.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { Telemetry } from '@/models/telemetry.model'
import { User } from '@/models/user.model'
import { publishCommand } from '@/mqtt/mqtt.client'
import { ingestTelemetry } from '@/services/telemetry.service'
import { DEFAULT_FUZZY_TUNING } from '@/utils/fuzzyTuning.util'

jest.mock('@/mqtt/mqtt.client', () => ({ publishCommand: jest.fn() }))
jest.mock('@/socket', () => ({
  emitTelemetryUpdate: jest.fn(), emitRelayUpdate: jest.fn(), emitAlertNew: jest.fn(),
  emitDeviceStatusChange: jest.fn(), emitBirdCountUpdate: jest.fn(),
}))
jest.mock('@/services/notification.service', () => ({ dispatchAlertNotification: jest.fn().mockResolvedValue(undefined) }))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/farms', farmRoutes)
app.use('/analytics', analyticsRoutes)
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
    AuditLog.deleteMany({}), Farm.deleteMany({}), House.deleteMany({}), SensorNode.deleteMany({}),
    Telemetry.deleteMany({}), User.deleteMany({}), Zone.deleteMany({}),
  ])
})

let seq = 0
async function seed() {
  seq++
  const owner = await User.create({ email: `fz${seq}@test.vn`, password_hash: 'password123', full_name: 'Owner', role: 'FARM_OWNER' })
  const farm = await Farm.create({ name: 'Farm', address: 'HCMC', owner_id: owner._id })
  const house = await House.create({ farm_id: farm._id, name: 'House' })
  const zone = await Zone.create({ house_id: house._id, name: 'Zone' })
  const node = await SensorNode.create({ device_id: `ESP32-FZ-${seq}`, zone_id: zone._id, status: 'ONLINE' })
  const token = jwt.sign({ sub: String(owner._id), role: 'FARM_OWNER' }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
  return { farm, house, zone, node, token }
}

describe('ingestTelemetry — lưu đầu ra bộ điều khiển mờ', () => {
  it('persists control_output and the misting/ventilation relay states', async () => {
    const { node } = await seed()

    await ingestTelemetry({
      deviceId: node.device_id, timestamp: Date.now(), temperature: 30, humidity: 76, light_lux: 0.1, nh3_ppm: 5, co2_ppm: 800, sound_db: 40,
      relay_states: { misting: true, speaker: false, ventilation: false, heating: false }, control_mode: 'AUTO',
      control_output: { misting: 40, ventilation: 0 },
    })

    expect(await Telemetry.findOne().lean()).toMatchObject({ misting_pct: 40, ventilation_pct: 0, misting_on: true, ventilation_on: false })
  })
})

describe('PUT /farms/zones/:zoneId/fuzzy-tuning', () => {
  it('saves the tuning with history, pushes it to the zone devices and audits it', async () => {
    const { farm, house, zone, token } = await seed()

    const res = await request(app)
      .put(`/farms/zones/${zone._id}/fuzzy-tuning`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fuzzy_humidity_band: 12, fuzzy_window_sec: 180, unknown_key: 1 })

    expect(res.status).toBe(200)
    const saved = (await Zone.findById(zone._id))!.toObject()
    expect(saved.fuzzy_tuning).toEqual({ ...DEFAULT_FUZZY_TUNING, fuzzy_humidity_band: 12, fuzzy_window_sec: 180 })
    expect(saved.fuzzy_tuning_history).toHaveLength(1)
    expect(saved.fuzzy_tuning_history[0].new_values).toEqual({ fuzzy_humidity_band: 12, fuzzy_window_sec: 180 })
    expect(publishCommand).toHaveBeenCalledWith(String(farm._id), String(house._id), String(zone._id), 'config/update',
      { ...DEFAULT_FUZZY_TUNING, fuzzy_humidity_band: 12, fuzzy_window_sec: 180 })
    expect(await AuditLog.countDocuments({ action: 'FUZZY_TUNING_UPDATED' })).toBe(1)
  })

  it.each([
    ['a humidity band below 2', { fuzzy_humidity_band: 1 }],
    ['a fan level above 100', { fuzzy_fan_dry_level: 150 }],
    ['a window shorter than one minute', { fuzzy_window_sec: 30 }],
    ['a fractional window', { fuzzy_window_sec: 90.5 }],
    ['a non-numeric value', { fuzzy_temp_band: 'abc' }],
    ['a body without any tuning key', { foo: 1 }],
  ])('rejects %s', async (_label, body) => {
    const { zone, token } = await seed()

    const res = await request(app).put(`/farms/zones/${zone._id}/fuzzy-tuning`).set('Authorization', `Bearer ${token}`).send(body)

    expect(res.status).toBe(400)
    expect(publishCommand).not.toHaveBeenCalled()
  })
})

describe('GET /analytics/control/performance', () => {
  it('reports in-range share and relay switches per hour from fuzzy-era samples only', async () => {
    const { zone, node, token } = await seed()
    const t0 = Date.now() - 60 * 60_000
    // 7 mẫu cách 10 phút = đúng 1 giờ. Ngưỡng ẩm mặc định 75–95%.
    const humidity = [70, 76, 80, 90, 96, 85, 74]  // trong ngưỡng: 76, 80, 90, 85 → 4/7
    const mistingOn = [false, true, true, false, true, false, false] // 4 lần đổi trạng thái
    await Telemetry.insertMany([
      ...humidity.map((h, i) => ({
        node_id: node._id, zone_id: zone._id, timestamp: new Date(t0 + i * 10 * 60_000), humidity: h, temperature: 28,
        misting_pct: 50, ventilation_pct: 0, misting_on: mistingOn[i], ventilation_on: false,
      })),
      // Mẫu firmware cũ (không có misting_pct) — không được tính
      { node_id: node._id, zone_id: zone._id, timestamp: new Date(t0 + 5 * 60_000), humidity: 50, temperature: 40 },
    ])

    const res = await request(app)
      .get('/analytics/control/performance')
      .query({ zoneId: String(zone._id), range: '24h' })
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.data.stats).toEqual({
      sampleCount: 7,
      humidityInRangePct: 57.1,
      temperatureInRangePct: 100,
      mistingAvgPct: 50,
      ventilationAvgPct: 0,
      mistingSwitchesPerHour: 4,
      ventilationSwitchesPerHour: 0,
    })
    expect(res.body.data.fuzzy_tuning).toEqual(DEFAULT_FUZZY_TUNING)
    expect(res.body.data.series.length).toBeGreaterThan(0)
  })

  it('returns null stats when the zone has no fuzzy-era data yet', async () => {
    const { zone, token } = await seed()

    const res = await request(app)
      .get('/analytics/control/performance')
      .query({ zoneId: String(zone._id), range: '24h' })
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.data.stats).toBeNull()
    expect(res.body.data.series).toEqual([])
  })
})
