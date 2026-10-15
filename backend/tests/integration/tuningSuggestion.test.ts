/**
 * ANALYTICS-FR-010 — gợi ý hệ số mờ: từ chối khi thiếu dữ liệu, đề xuất bộ hệ số
 * tốt hơn trên nhà yến giả lập, và không bao giờ tự ghi hệ số.
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import analyticsRoutes from '@/routes/analytics.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { SensorNode } from '@/models/device.model'
import { Telemetry } from '@/models/telemetry.model'
import { User } from '@/models/user.model'
import { mistingDemand } from '@/utils/fuzzyModel.util'
import { DEFAULT_FUZZY_TUNING } from '@/utils/fuzzyTuning.util'

jest.mock('@/mqtt/mqtt.client', () => ({ publishCommand: jest.fn() }))
jest.mock('@/socket', () => ({
  emitTelemetryUpdate: jest.fn(), emitRelayUpdate: jest.fn(), emitAlertNew: jest.fn(),
  emitDeviceStatusChange: jest.fn(), emitBirdCountUpdate: jest.fn(),
}))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'
const app = express()
app.use(express.json())
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
  await Promise.all([Farm, House, Zone, SensorNode, Telemetry, User].map(m => (m as typeof Zone).deleteMany({})))
})

async function seed() {
  const owner = await User.create({ email: 'c@test.vn', password_hash: 'password123', full_name: 'Owner', role: 'FARM_OWNER' })
  const farm = await Farm.create({ name: 'Farm', address: 'HCMC', owner_id: owner._id })
  const house = await House.create({ farm_id: farm._id, name: 'House' })
  const zone = await Zone.create({ house_id: house._id, name: 'Zone C' })
  const node = await SensorNode.create({ device_id: 'ESP32-C-1', zone_id: zone._id, status: 'ONLINE' })
  const token = jwt.sign({ sub: String(owner._id), role: 'FARM_OWNER' }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
  return { zone, node, token }
}

const STEP = 10 * 60_000
/**
 * Nhà yến giả khô nhanh (Δh = 0.05·phun − 0.02·quạt − 2.2 mỗi 10 phút) do bộ mờ
 * mặc định điều khiển, cộng 30% bước phun ngẫu nhiên để dữ liệu đủ đa dạng cho hồi quy.
 */
async function writeDryHouse(nodeId: unknown, zoneId: unknown, days: number) {
  const n = Math.round((days * 86400_000) / STEP)
  const start = Math.floor(Date.now() / STEP) * STEP - (n - 1) * STEP
  let h = 82
  let x = 42
  const rand = () => { x = (x * 16807) % 2147483647; return x / 2147483647 }
  const docs = []
  for (let i = 0; i < n; i++) {
    const temperature = 29 + 2 * Math.sin(i / 20)
    const misting = rand() < 0.3 ? Math.round(rand() * 100) : Math.round(100 * mistingDemand(h, temperature, 75, 95, 31))
    const ventilation = Math.round(rand() * 20)
    docs.push({
      node_id: nodeId, zone_id: zoneId, timestamp: new Date(start + i * STEP), humidity: Math.round(h * 10) / 10,
      temperature, misting_pct: misting, ventilation_pct: ventilation, nh3_ppm: 5, co2_ppm: 800,
    })
    h = Math.min(100, Math.max(40, h + 0.05 * misting - 0.02 * ventilation - 2.2 + (rand() - 0.5) * 0.2))
  }
  await Telemetry.insertMany(docs)
}

const get = (token: string, zoneId: unknown) =>
  request(app).get('/analytics/control/suggestion').query({ zoneId: String(zoneId) }).set('Authorization', `Bearer ${token}`)

describe('GET /analytics/control/suggestion', () => {
  it('refuses to suggest from less than 3 days of data', async () => {
    const { zone, node, token } = await seed()
    await writeDryHouse(node._id, zone._id, 1)

    const res = await get(token, zone._id)
    expect(res.status).toBe(200)
    expect(res.body.data.suggestion).toBeNull()
    expect(res.body.data.reason).toMatch(/3 ngày/)
  })

  it('suggests tuning that keeps a fast-drying house in range longer, without applying it', async () => {
    const { zone, node, token } = await seed()
    await writeDryHouse(node._id, zone._id, 4)

    const res = await get(token, zone._id)
    const { suggestion, predicted, model } = res.body.data
    expect(model.r2).toBeGreaterThan(0.3)
    expect(suggestion).not.toBeNull()
    expect(predicted.inRangeSuggested).toBeGreaterThan(predicted.inRangeNow)
    // chỉ đề xuất — hệ số của Zone không đổi
    expect((await Zone.findById(zone._id).lean())!.fuzzy_tuning).toEqual(DEFAULT_FUZZY_TUNING)
  })
})
