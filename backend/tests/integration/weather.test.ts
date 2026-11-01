/**
 * ANALYTICS-FR-013 — thời tiết theo giờ từ Open-Meteo: chỉ gửi toạ độ, lưu đúng số dịch vụ trả, thiếu
 * thì để thiếu (không ghi 0), farm không toạ độ hoặc gọi lỗi thì không ghi gì; đọc theo giờ để hiện cạnh
 * số đo trong nhà (GET /farms/{id}/weather).
 */
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import request from 'supertest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import farmRoutes from '@/routes/farms.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { Farm } from '@/models/farm.model'
import { User } from '@/models/user.model'
import { WeatherObservation } from '@/models/weatherObservation.model'
import { fetchAllFarmsWeather } from '@/services/weather.service'
import type { Role } from '@/types'

process.env.JWT_ACCESS_SECRET = 'test-access-secret'
const app = express()
app.use(express.json())
app.use('/farms', farmRoutes)
app.use(errorHandler)
const tokenFor = (id: unknown, role: Role) =>
  jwt.sign({ sub: String(id), role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })

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
  await Promise.all([Farm, User, WeatherObservation].map(m => (m as typeof User).deleteMany({})))
})

const NOW = new Date('2026-10-20T03:30:00Z')
const hourly = {
  time: ['2026-10-20T01:00', '2026-10-20T02:00', '2026-10-20T03:00', '2026-10-20T04:00'],
  temperature_2m: [26.1, 26.5, null, 28],
  relative_humidity_2m: [90, 88, null, 80],
  precipitation: [0, 2.4, null, 0],
}
const mockFetch = (body: unknown, ok = true) =>
  jest.spyOn(global, 'fetch').mockResolvedValue({ ok, status: ok ? 200 : 500, json: async () => body } as Response)

async function seedFarm(coordinates?: { lat: number; lng: number }) {
  const owner = await User.create({ email: `w${Math.random()}@t.vn`, password_hash: 'password123', full_name: 'W', role: 'FARM_OWNER' })
  return Farm.create({ name: 'F', address: 'x', owner_id: owner._id, members: [{ user_id: owner._id, is_primary: true }], coordinates })
}

describe('weather.service (ANALYTICS-FR-013)', () => {
  it('chỉ gửi toạ độ; lưu các giờ đã qua đúng số Open-Meteo trả; giờ toàn null không ghi', async () => {
    const farm = await seedFarm({ lat: 10.8, lng: 106.6 })
    const fetchSpy = mockFetch({ hourly })

    expect(await fetchAllFarmsWeather(NOW)).toBe(2)

    const url = new URL(String(fetchSpy.mock.calls[0][0]))
    expect(url.searchParams.get('latitude')).toBe('10.8')
    expect(url.searchParams.get('longitude')).toBe('106.6')
    expect([...url.searchParams.keys()].sort()).toEqual(['forecast_days', 'hourly', 'latitude', 'longitude', 'past_days', 'timezone'])

    const rows = await WeatherObservation.find({ farm_id: farm._id }).sort({ hour: 1 }).lean()
    // Mưa ở mốc T là tổng của giờ trước đó → bản ghi hour = T − 1 giờ
    expect(rows.map(r => r.hour.toISOString())).toEqual(['2026-10-20T00:00:00.000Z', '2026-10-20T01:00:00.000Z'])
    expect(rows[1]).toMatchObject({ temperature: 26.5, humidity: 88, precipitation_mm: 2.4 })
  })

  it('giá trị thiếu để thiếu, không ghi 0; chạy lại không tạo trùng', async () => {
    const farm = await seedFarm({ lat: 10.8, lng: 106.6 })
    mockFetch({ hourly: { time: ['2026-10-20T02:00'], temperature_2m: [27], relative_humidity_2m: [null], precipitation: [null] } })
    await fetchAllFarmsWeather(NOW)
    await fetchAllFarmsWeather(NOW)
    const rows = await WeatherObservation.find({ farm_id: farm._id }).lean()
    expect(rows).toHaveLength(1)
    expect(rows[0].temperature).toBe(27)
    expect(rows[0]).not.toHaveProperty('humidity')
    expect(rows[0]).not.toHaveProperty('precipitation_mm')
  })

  it('farm không có toạ độ không gọi dịch vụ; Open-Meteo lỗi thì không ghi gì và không throw', async () => {
    await seedFarm()
    const fetchSpy = mockFetch({ hourly })
    expect(await fetchAllFarmsWeather(NOW)).toBe(0)
    expect(fetchSpy).not.toHaveBeenCalled()

    await seedFarm({ lat: 1, lng: 2 })
    fetchSpy.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) } as Response)
    await expect(fetchAllFarmsWeather(NOW)).resolves.toBe(0)
    fetchSpy.mockRejectedValue(new Error('timeout'))
    await expect(fetchAllFarmsWeather(NOW)).resolves.toBe(0)
    expect(await WeatherObservation.countDocuments()).toBe(0)
  })
})

describe('GET /farms/{id}/weather (ANALYTICS-FR-013)', () => {
  const H = (iso: string) => new Date(iso)
  async function seeded(coordinates: { lat: number; lng: number } | undefined = { lat: 10.8, lng: 106.6 }) {
    const farm = await seedFarm(coordinates)
    await WeatherObservation.create([
      { farm_id: farm._id, hour: H('2026-10-20T00:00:00Z'), temperature: 26.1, humidity: 90, precipitation_mm: 0 },
      { farm_id: farm._id, hour: H('2026-10-20T01:00:00Z'), temperature: 26.5 },
      { farm_id: farm._id, hour: H('2026-10-19T00:00:00Z'), temperature: 25 },
    ])
    return { farm, token: tokenFor(farm.owner_id, 'FARM_OWNER') }
  }
  const get = (farmId: unknown, token: string, query = '') =>
    request(app).get(`/farms/${farmId}/weather${query}`).set('Authorization', `Bearer ${token}`)

  it('trả các giờ trong khoảng theo thứ tự; giá trị thiếu là null, không phải 0', async () => {
    const { farm, token } = await seeded()
    const res = await get(farm._id, token, '?from=2026-10-19T12:00:00Z&to=2026-10-20T12:00:00Z').expect(200)
    expect(res.body.data).toMatchObject({ farm_id: String(farm._id), has_coordinates: true })
    expect(res.body.data.hours).toEqual([
      { hour: '2026-10-20T00:00:00.000Z', temperature: 26.1, humidity: 90, precipitation_mm: 0 },
      { hour: '2026-10-20T01:00:00.000Z', temperature: 26.5, humidity: null, precipitation_mm: null },
    ])
  })

  it('khoảng quá 7 ngày hoặc from sau to → 400; ngày sai → 422', async () => {
    const { farm, token } = await seeded()
    await get(farm._id, token, '?from=2026-10-01T00:00:00Z&to=2026-10-20T00:00:00Z').expect(400)
    await get(farm._id, token, '?from=2026-10-20T00:00:00Z&to=2026-10-19T00:00:00Z').expect(400)
    await get(farm._id, token, '?from=hôm-qua').expect(422)
  })

  it('Technician, Administrator và người ngoài farm → 403', async () => {
    const { farm } = await seeded()
    const other = await seedFarm()
    for (const role of ['TECHNICIAN', 'ADMIN'] as const) {
      const user = await User.create({ email: `${role}${Math.random()}@t.vn`, password_hash: 'password123', full_name: role, role })
      await get(farm._id, tokenFor(user._id, role)).expect(403)
    }
    await get(farm._id, tokenFor(other.owner_id, 'FARM_OWNER')).expect(403)
  })

  it('farm chưa có toạ độ → has_coordinates false, không có giờ nào', async () => {
    const farm = await seedFarm()
    const res = await get(farm._id, tokenFor(farm.owner_id, 'FARM_OWNER')).expect(200)
    expect(res.body.data).toMatchObject({ has_coordinates: false, hours: [] })
  })
})
