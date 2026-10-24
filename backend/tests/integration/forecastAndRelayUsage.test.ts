/**
 * Đợt B (SRS v1.24.0): dự báo 60 phút + cảnh báo sớm FORECAST_BREACH (ANALYTICS-FR-009,
 * ALERT-FR-011) và bảo trì theo thời gian chạy thật (ALERT-FR-016, MAINTENANCE_DUE).
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import alertRoutes from '@/routes/alerts.route'
import analyticsRoutes from '@/routes/analytics.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { Alert } from '@/models/alert.model'
import { SensorNode } from '@/models/device.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { Telemetry } from '@/models/telemetry.model'
import { User } from '@/models/user.model'
import { scanForecastBreaches } from '@/services/forecast.service'
import { accumulateRelayUsage, tallyRelayUsage } from '@/services/relayUsage.service'

jest.mock('@/mqtt/mqtt.client', () => ({ publishCommand: jest.fn() }))
jest.mock('@/socket', () => ({
  emitTelemetryUpdate: jest.fn(), emitRelayUpdate: jest.fn(), emitAlertNew: jest.fn(),
  emitDeviceStatusChange: jest.fn(), emitBirdCountUpdate: jest.fn(),
}))
jest.mock('@/services/notification.service', () => ({
  dispatchAlertNotification: jest.fn().mockResolvedValue(undefined), notifyUser: jest.fn().mockResolvedValue(undefined),
  notifyAdmins: jest.fn().mockResolvedValue(undefined),
}))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'
const app = express()
app.use(express.json())
app.use('/analytics', analyticsRoutes)
app.use('/alerts', alertRoutes)
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
  await Promise.all([Alert, SensorNode, Farm, House, Zone, Telemetry, User].map(m => (m as typeof Alert).deleteMany({})))
})

async function seed() {
  const owner = await User.create({ email: 'b@test.vn', password_hash: 'password123', full_name: 'Owner', role: 'FARM_OWNER' })
  const farm = await Farm.create({ name: 'Farm', address: 'HCMC', owner_id: owner._id })
  const house = await House.create({ farm_id: farm._id, name: 'House' })
  const zone = await Zone.create({ house_id: house._id, name: 'Zone B' })
  const node = await SensorNode.create({ device_id: 'ESP32-B-1', zone_id: zone._id, status: 'ONLINE' })
  const token = jwt.sign({ sub: String(owner._id), role: 'FARM_OWNER' }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
  return { zone, node, token }
}

/** 3 giờ, 1 mẫu/phút, kết thúc ở `endAgoMin` phút trước; độ ẩm theo hàm số phút tính từ đầu */
async function writeHumidity(nodeId: unknown, zoneId: unknown, humidity: (min: number) => number, endAgoMin = 0) {
  const end = Date.now() - endAgoMin * 60_000
  await Telemetry.insertMany(Array.from({ length: 180 }, (_, i) => ({
    node_id: nodeId, zone_id: zoneId, timestamp: new Date(end - (179 - i) * 60_000), humidity: humidity(i), temperature: 28,
  })))
}
// 2 giờ ổn định 90%, giờ cuối giảm 1%/5 phút → còn 78% (trong ngưỡng 75–95) nhưng đang lao xuống
const falling = (min: number) => (min < 120 ? 90 : 90 - (min - 120) / 5)

describe('forecast (ANALYTICS-FR-009)', () => {
  it('forecasts 60 minutes ahead with a backtested error and predicts the coming breach', async () => {
    const { zone, node, token } = await seed()
    await writeHumidity(node._id, zone._id, falling)

    const res = await request(app).get('/analytics/forecast').query({ zoneId: String(zone._id) }).set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    const { humidity, predicted } = res.body.data
    expect(humidity.forecast).toHaveLength(12)
    expect(typeof humidity.mae60).toBe('number')
    expect(predicted).toMatchObject({ metric: 'humidity', direction: 'below', limit: 75 })
    expect(predicted.minutesAhead).toBeLessThanOrEqual(60)
  })

  it('does not forecast from stale data', async () => {
    const { zone, node, token } = await seed()
    await writeHumidity(node._id, zone._id, falling, 30)

    const res = await request(app).get('/analytics/forecast').query({ zoneId: String(zone._id) }).set('Authorization', `Bearer ${token}`)
    expect(res.body.data.humidity).toBeNull()
    expect(res.body.data.predicted).toBeNull()
  })

  it('raises a LOW FORECAST_BREACH early warning and resolves it when the trend is gone', async () => {
    const { zone, node } = await seed()
    await writeHumidity(node._id, zone._id, falling)

    expect(await scanForecastBreaches()).toEqual({ raised: 1, resolved: 0 })
    const alert = (await Alert.findOne({ type: 'FORECAST_BREACH' }).lean())!
    expect(alert.severity).toBe('LOW')
    expect(alert.message).toMatch(/phút nữa/)

    await Telemetry.deleteMany({})
    await writeHumidity(node._id, zone._id, () => 85)
    expect(await scanForecastBreaches()).toEqual({ raised: 0, resolved: 1 })
  })
})

describe('relay usage (ALERT-FR-016)', () => {
  const at = (s: number) => new Date(Date.UTC(2026, 8, 30, 0, 0, s))

  it('tallies on-time and switches, ignoring gaps longer than 30 s', () => {
    const r = tallyRelayUsage({}, [
      { timestamp: at(0), misting_on: true, ventilation_on: false },
      { timestamp: at(10), misting_on: true, ventilation_on: false },  // +10s
      { timestamp: at(20), misting_on: false, ventilation_on: false }, // +10s, đổi 1
      { timestamp: at(30), misting_on: true, ventilation_on: false },  // đổi 2
      { timestamp: at(90), misting_on: false, ventilation_on: false }, // mất kết nối 60s → bỏ qua
    ])
    expect(r.onHours.misting * 3600).toBeCloseTo(20)
    expect(r.switches).toEqual({ misting: 2, ventilation: 0 })
  })

  it('raises one LOW MAINTENANCE_DUE when the pump passes its runtime limit; acknowledging it restarts the count', async () => {
    const { zone, node, token } = await seed()
    await SensorNode.updateOne({ _id: node._id }, { 'relay_usage.misting.since_service_hours': 499.9 })
    const now = Date.now()
    const writeOn = (from: number) => Telemetry.insertMany(Array.from({ length: 60 }, (_, i) => ({
      node_id: node._id, zone_id: zone._id, timestamp: new Date(from - (59 - i) * 10_000), misting_on: true, ventilation_on: false, misting_pct: 100,
    })))
    await writeOn(now)

    expect(await accumulateRelayUsage(new Date(now))).toMatchObject({ alerts: 1 })
    const alert = (await Alert.findOne({ type: 'MAINTENANCE_DUE' }).lean())!
    expect(alert.severity).toBe('LOW')
    expect(alert.message).toContain('ESP32-B-1')
    expect(alert.message).toContain('bơm phun sương')
    expect(alert.metadata).toMatchObject({ loads: [{ relay: 'misting', hours: 500 }] })
    let saved = (await SensorNode.findById(node._id).lean())!
    expect(saved.relay_usage.misting.since_service_hours).toBeGreaterThan(500) // không reset lúc báo
    expect(saved.relay_usage.misting.on_hours * 3600).toBeCloseTo(590) // 59 khoảng × 10s

    expect(await accumulateRelayUsage(new Date(now))).toMatchObject({ alerts: 0 }) // không có mẫu mới
    await writeOn(now + 3600_000)
    expect(await accumulateRelayUsage(new Date(now + 3600_000))).toMatchObject({ alerts: 0 }) // còn mở → gộp
    expect(await Alert.countDocuments({ type: 'MAINTENANCE_DUE' })).toBe(1)

    await request(app).put(`/alerts/${alert._id}/acknowledge`).set('Authorization', `Bearer ${token}`).send({ note: 'Đã thay màng bơm' }).expect(200)
    expect((await Alert.findById(alert._id).lean())!.status).toBe('RESOLVED')
    saved = (await SensorNode.findById(node._id).lean())!
    expect(saved.relay_usage.misting.since_service_hours).toBe(0)
    expect(saved.relay_usage.misting.since_service_switches).toBe(0)
    expect(saved.relay_usage.misting.on_hours).toBeGreaterThan(0) // tổng giờ chạy giữ nguyên
  })

  it('raises nothing below the limit', async () => {
    const { zone, node } = await seed()
    const now = Date.now()
    await Telemetry.insertMany(Array.from({ length: 60 }, (_, i) => ({
      node_id: node._id, zone_id: zone._id, timestamp: new Date(now - (59 - i) * 10_000), misting_on: true, ventilation_on: false,
    })))
    expect(await accumulateRelayUsage(new Date(now))).toMatchObject({ nodes: 1, alerts: 0 })
    expect(await Alert.countDocuments()).toBe(0)
  })
})
