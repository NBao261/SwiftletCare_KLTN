/**
 * ANALYTICS-FR-013 — thời tiết theo giờ từ Open-Meteo: chỉ gửi toạ độ, lưu đúng số dịch vụ trả, thiếu
 * thì để thiếu (không ghi 0), farm không toạ độ hoặc gọi lỗi thì không ghi gì.
 */
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Farm } from '@/models/farm.model'
import { User } from '@/models/user.model'
import { WeatherObservation } from '@/models/weatherObservation.model'
import { fetchAllFarmsWeather } from '@/services/weather.service'

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
