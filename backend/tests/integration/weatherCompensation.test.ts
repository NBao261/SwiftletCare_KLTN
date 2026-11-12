/**
 * ENV-FR-028, 030, BR-38 — bù phun sương theo dự báo: luật của nhà (Domain Expert, Farm Owner khi chưa có
 * chuyên gia), job mỗi giờ gửi offset có hạn trên topic `compensation` của mọi controller trong nhà.
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import farmRoutes from '@/routes/farms.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { AuditLog } from '@/models/auditLog.model'
import { SensorNode } from '@/models/device.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { User } from '@/models/user.model'
import { WeatherCompensation } from '@/models/weatherCompensation.model'
import { publishDeviceCompensation } from '@/mqtt/mqtt.client'
import { runWeatherCompensation } from '@/services/weatherCompensation.service'
import type { Role } from '@/types'

jest.mock('@/mqtt/mqtt.client', () => ({
  publishDeviceCommand: jest.fn().mockReturnValue(true),
  publishDeviceConfig: jest.fn().mockReturnValue(true),
  publishDeviceCompensation: jest.fn().mockReturnValue(true),
}))
jest.mock('@/socket', () => ({ emitNotificationNew: jest.fn() }))

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/farms', farmRoutes)
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
  jest.restoreAllMocks()
  jest.clearAllMocks()
  await Promise.all([AuditLog, Farm, House, Zone, SensorNode, User, WeatherCompensation].map(m => (m as typeof User).deleteMany({})))
})

const tokenFor = (id: unknown, role: Role) =>
  jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })

let seq = 0
async function seed({ withExpert = true } = {}) {
  seq++
  const owner = await User.create({ email: `o${seq}@test.vn`, password_hash: 'password123', full_name: 'O', role: 'FARM_OWNER' })
  const expert = await User.create({ email: `e${seq}@test.vn`, password_hash: 'password123', full_name: 'E', role: 'DOMAIN_EXPERT' })
  const tech = await User.create({ email: `t${seq}@test.vn`, password_hash: 'password123', full_name: 'T', role: 'FARM_TECHNICIAN' })
  const farm = await Farm.create({
    name: 'F', address: 'x', owner_id: owner._id, coordinates: { lat: 10.8, lng: 106.6 },
    members: [
      { user_id: owner._id, is_primary: true },
      { user_id: tech._id, role: 'FARM_TECHNICIAN' },
      ...(withExpert ? [{ user_id: expert._id, role: 'DOMAIN_EXPERT' }] : []),
    ],
  })
  const house = await House.create({ farm_id: farm._id, name: 'H', technicians: [{ user_id: tech._id, primary: true }] })
  const zones = await Zone.create([{ house_id: house._id, name: 'Z1' }, { house_id: house._id, name: 'Z2', floor: 2 }])
  await SensorNode.create([
    { device_id: `ESP-WC-${seq}-1`, zone_id: zones[0]._id, status: 'ONLINE' },
    { device_id: `ESP-WC-${seq}-2`, zone_id: zones[1]._id, status: 'ONLINE' },
  ])
  const put = (token: string, rules: object[]) =>
    request(app).put(`/farms/houses/${house._id}/weather-rules`).set('Authorization', `Bearer ${token}`).send({ rules })
  const get = (token: string) => request(app).get(`/farms/houses/${house._id}/weather-rules`).set('Authorization', `Bearer ${token}`)
  return {
    farm, house, put, get,
    t: { owner: tokenFor(owner._id, 'FARM_OWNER'), expert: tokenFor(expert._id, 'DOMAIN_EXPERT'), tech: tokenFor(tech._id, 'FARM_TECHNICIAN') },
  }
}

const HOT_RULE = { metric: 'temperature', min: 33, offset_pct: 5, duration_min: 120 }

/** Open-Meteo giả: mốc giờ tới có nhiệt độ `temp` (giờ GMT, như API thật) */
function mockForecast(temp: number, now: Date) {
  const hour = (h: number) => new Date(now.getTime() + h * 3600_000).toISOString().slice(0, 13) + ':00'
  return jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
    hourly: { time: [hour(1), hour(2)], temperature_2m: [temp - 1, temp], relative_humidity_2m: [70, 72], precipitation: [0, 0] },
  })))
}

describe('ENV-FR-028 — weatherCompensation job', () => {
  it('TC-F26-01: sends +5 % with an expiry of at most 2 h when the forecast reaches the rule, then 0 without an active rule', async () => {
    const { house, put, t } = await seed()
    expect((await put(t.expert, [HOT_RULE])).status).toBe(200)
    const now = new Date('2026-11-12T03:10:00Z')
    const fetchSpy = mockForecast(34, now)

    expect(await runWeatherCompensation(now)).toBe(1)

    const calls = jest.mocked(publishDeviceCompensation).mock.calls
    expect(calls).toHaveLength(2)
    for (const [deviceId, payload] of calls) {
      expect(payload).toMatchObject({ deviceId, offset_pct: 5 })
      const expiresAt = (payload as { expires_at: number }).expires_at
      expect(expiresAt).toBeGreaterThan(now.getTime())
      expect(expiresAt - now.getTime()).toBeLessThanOrEqual(2 * 3600_000)
    }
    // Chỉ gửi toạ độ farm
    expect(String(fetchSpy.mock.calls[0][0])).toContain('latitude=10.8')
    const log = await WeatherCompensation.findOne({ house_id: house._id }).lean()
    expect(log).toMatchObject({ offset_pct: 5, controllers: 2, forecast: { temperature_max: 34 } })

    // Tắt luật: lần chạy sau gửi 0 và không gọi Open-Meteo
    jest.mocked(publishDeviceCompensation).mockClear()
    fetchSpy.mockClear()
    expect((await put(t.expert, [{ ...HOT_RULE, active: false }])).status).toBe(200)
    expect(await runWeatherCompensation(now)).toBe(0)
    expect(jest.mocked(publishDeviceCompensation).mock.calls.map(([, p]) => (p as { offset_pct: number }).offset_pct)).toEqual([0, 0])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('sends 0 when the forecast stays below the rule or Open-Meteo fails', async () => {
    const { put, t } = await seed()
    await put(t.expert, [HOT_RULE])
    const now = new Date('2026-11-12T03:10:00Z')
    mockForecast(31, now)
    expect(await runWeatherCompensation(now)).toBe(0)

    jest.restoreAllMocks()
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'))
    jest.mocked(publishDeviceCompensation).mockClear()
    expect(await runWeatherCompensation(now)).toBe(0)
    expect(jest.mocked(publishDeviceCompensation).mock.calls.every(([, p]) => (p as { offset_pct: number }).offset_pct === 0)).toBe(true)
    expect(await WeatherCompensation.countDocuments()).toBe(0)
  })
})

describe('ENV-FR-030 — PUT /farms/houses/:houseId/weather-rules', () => {
  it('TC-F26-03: offset 12 % → 400, duration 3 h → 400, technician → 403 (farm with an expert)', async () => {
    const { put, t } = await seed()
    expect((await put(t.expert, [{ ...HOT_RULE, offset_pct: 12 }])).status).toBe(400)
    expect((await put(t.expert, [{ ...HOT_RULE, duration_min: 180 }])).status).toBe(400)
    expect((await put(t.tech, [HOT_RULE])).status).toBe(403)
  })

  it('stores the rules with history and audit; the Farm Owner of a farm with an expert gets 403', async () => {
    const { house, put, get, t } = await seed()
    expect((await put(t.owner, [HOT_RULE])).status).toBe(403)

    const res = await put(t.expert, [HOT_RULE])
    expect(res.status).toBe(200)
    const ruleId = res.body.data.rules[0]._id
    // Gửi lại kèm _id thì luật giữ id cũ (nhật ký bù vẫn trỏ đúng luật)
    const again = await put(t.expert, [{ ...HOT_RULE, _id: ruleId, offset_pct: 6 }])
    expect(again.body.data.rules[0]).toMatchObject({ _id: ruleId, offset_pct: 6, active: true })

    const saved = (await House.findById(house._id).lean())!
    expect(saved.weather_rules_history).toHaveLength(2)
    expect(await AuditLog.countDocuments({ action: 'WEATHER_RULES_UPDATED' })).toBe(2)

    // Chủ farm và thợ của nhà đều xem được
    expect((await get(t.owner)).body.data.rules).toHaveLength(1)
    expect((await get(t.tech)).status).toBe(200)
  })

  it('lets the Farm Owner set the rules on a farm without an expert (BR-22)', async () => {
    const { put, t } = await seed({ withExpert: false })
    expect((await put(t.owner, [HOT_RULE])).status).toBe(200)
  })
})
