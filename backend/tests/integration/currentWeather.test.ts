jest.mock('@/mqtt/mqtt.client', () => ({ publishDeviceCommand: jest.fn().mockReturnValue(true), publishDeviceConfig: jest.fn().mockReturnValue(true) }))
jest.mock('@/socket', () => ({ emitNotificationNew: jest.fn() }))

import express from 'express'
import jwt from 'jsonwebtoken'
import request from 'supertest'
import farmRoutes from '@/routes/farms.route'
import { errorHandler } from '@/middlewares/errorHandler.middleware'
import { Farm } from '@/models/farm.model'
import { House } from '@/models/houseZone.model'
import { User } from '@/models/user.model'
import { clearCurrentWeatherCache } from '@/services/weather.service'
import { seedOwnerFarm, useTestDb } from '../helpers/ownerFarm'

process.env.JWT_ACCESS_SECRET = 'test-access-secret'

const app = express()
app.use(express.json())
app.use('/farms', farmRoutes)
app.use(errorHandler)

useTestDb()
beforeEach(() => clearCurrentWeatherCache())

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })

// Số hiện tại như Open-Meteo trả (giờ GMT, không có Z)
const current = (override: Record<string, unknown> = {}) => ({
  current: {
    time: '2026-11-28T06:15', temperature_2m: 28.2, relative_humidity_2m: 86, precipitation: 0, cloud_cover: 10, weather_code: 0, is_day: 1,
    ...override,
  },
})
const mockFetch = (body: object, ok = true) =>
  jest.spyOn(global, 'fetch').mockResolvedValue({ ok, status: ok ? 200 : 500, json: async () => body } as Response)

async function seedWithCoordinates() {
  const s = await seedOwnerFarm()
  await Farm.updateOne({ _id: s.farm._id }, { coordinates: { lat: 10.02, lng: 106.0 } })
  const house = (await House.findOne({ farm_id: s.farm._id }))!
  return { ...s, path: `/farms/houses/${house._id}/weather/current` }
}

describe('GET /farms/houses/:houseId/weather/current', () => {
  it('trời quang ban ngày: nắng, không mưa', async () => {
    const { token, path } = await seedWithCoordinates()
    mockFetch(current())
    const res = await request(app).get(path).set(bearer(token)).expect(200)
    expect(res.body.data.weather).toEqual({
      observed_at: '2026-11-28T06:15:00.000Z', condition: 'CLEAR', is_raining: false, is_day: true,
      temperature_c: 28.2, humidity_pct: 86, precipitation_mm: 0, cloud_cover_pct: 10,
    })
  })

  it('mã dông thì đang mưa', async () => {
    const { token, path } = await seedWithCoordinates()
    mockFetch(current({ weather_code: 95, precipitation: 0.6, cloud_cover: 100 }))
    const { weather } = (await request(app).get(path).set(bearer(token)).expect(200)).body.data
    expect(weather).toMatchObject({ condition: 'THUNDERSTORM', is_raining: true, precipitation_mm: 0.6 })
  })

  it('ban đêm: is_day = false', async () => {
    const { token, path } = await seedWithCoordinates()
    mockFetch(current({ is_day: 0 }))
    const { weather } = (await request(app).get(path).set(bearer(token)).expect(200)).body.data
    expect(weather.is_day).toBe(false)
  })

  it('chỉ gửi toạ độ và các biến cần: không gửi tên farm, nhà hay người dùng', async () => {
    const { token, path } = await seedWithCoordinates()
    const fetchSpy = mockFetch(current())
    await request(app).get(path).set(bearer(token)).expect(200)
    const url = new URL(String(fetchSpy.mock.calls[0][0]))
    expect([...url.searchParams.keys()].sort()).toEqual(['current', 'latitude', 'longitude', 'timezone'])
    expect(url.searchParams.get('current')).toContain('weather_code')
  })

  it('gọi lại trong 10 phút thì dùng số đã nhớ', async () => {
    const { token, path } = await seedWithCoordinates()
    const fetchSpy = mockFetch(current())
    await request(app).get(path).set(bearer(token)).expect(200)
    await request(app).get(path).set(bearer(token)).expect(200)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('farm chưa có toạ độ: không có số, không gọi dịch vụ ngoài', async () => {
    const s = await seedOwnerFarm()
    const house = (await House.findOne({ farm_id: s.farm._id }))!
    const fetchSpy = mockFetch(current())
    const res = await request(app).get(`/farms/houses/${house._id}/weather/current`).set(bearer(s.token)).expect(200)
    expect(res.body.data).toMatchObject({ weather: null, reason: 'NO_COORDINATES' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('dịch vụ lỗi: không có số (không phải 0), nói là chưa lấy được', async () => {
    const { token, path } = await seedWithCoordinates()
    mockFetch({}, false)
    const res = await request(app).get(path).set(bearer(token)).expect(200)
    expect(res.body.data).toMatchObject({ weather: null, reason: 'UNAVAILABLE' })
  })

  it('trả thiếu số hiện tại: coi là chưa lấy được', async () => {
    const { token, path } = await seedWithCoordinates()
    mockFetch({ current: { weather_code: 0 } })
    const res = await request(app).get(path).set(bearer(token)).expect(200)
    expect(res.body.data.reason).toBe('UNAVAILABLE')
  })

  it('thiếu is_day: coi là chưa lấy được, không đoán ban ngày', async () => {
    const { token, path } = await seedWithCoordinates()
    mockFetch(current({ is_day: null }))
    const res = await request(app).get(path).set(bearer(token)).expect(200)
    expect(res.body.data).toMatchObject({ weather: null, reason: 'UNAVAILABLE' })
  })

  it('nhiều request cùng lúc cho một toạ độ chỉ gọi dịch vụ ngoài một lần', async () => {
    const { token, path } = await seedWithCoordinates()
    const spy = mockFetch(current())
    await Promise.all([1, 2, 3].map(() => request(app).get(path).set(bearer(token)).expect(200)))
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('Farm Technician: nhà được giao xem được (200), nhà không được giao 403', async () => {
    const { farm, path } = await seedWithCoordinates()
    mockFetch(current())
    const tech = await User.create({ email: 'tech@test.vn', password_hash: 'password123', full_name: 'T', role: 'FARM_TECHNICIAN' })
    await Farm.updateOne({ _id: farm._id }, { $push: { members: { user_id: tech._id, role: 'FARM_TECHNICIAN' } } })
    const techToken = jwt.sign({ sub: String(tech._id), role: 'FARM_TECHNICIAN' }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
    await request(app).get(path).set(bearer(techToken)).expect(403)
    await House.updateOne({ farm_id: farm._id }, { $set: { technicians: [{ user_id: tech._id, primary: true }] } })
    await request(app).get(path).set(bearer(techToken)).expect(200)
  })

  it('Administrator không xem được (403); id sai thì 422; người ngoài farm 403', async () => {
    const { path } = await seedWithCoordinates()
    mockFetch(current())
    const admin = await User.create({ email: 'ad@test.vn', password_hash: 'password123', full_name: 'A', role: 'ADMIN' })
    const adminToken = jwt.sign({ sub: String(admin._id), role: 'ADMIN' }, process.env.JWT_ACCESS_SECRET!, { expiresIn: '15m' })
    await request(app).get(path).set(bearer(adminToken)).expect(403)
    const other = await seedOwnerFarm()
    await request(app).get(path).set(bearer(other.token)).expect(403)
    await request(app).get('/farms/houses/abc/weather/current').set(bearer(other.token)).expect(422)
  })
})
