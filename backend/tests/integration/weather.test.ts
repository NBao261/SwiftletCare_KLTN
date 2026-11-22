import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { User } from '@/models/user.model'
import { WeatherObservation } from '@/models/weatherObservation.model'
import { getEnvSummary } from '@/services/analytics.service'
import { fetchAllFarmsWeather } from '@/services/weather.service'
import type { CurrentUser } from '@/types'

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
  await Promise.all([Farm, House, Zone, User, WeatherObservation].map(m => (m as typeof User).deleteMany({})))
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

describe('GET /analytics/env/summary — thời tiết ngoài trời cạnh số đo trong nhà (ANALYTICS-FR-013)', () => {
  const HOUR = 3600_000
  async function seedZone() {
    const farm = await seedFarm({ lat: 10.8, lng: 106.6 })
    const house = await House.create({ farm_id: farm._id, name: 'H' })
    const zone = await Zone.create({ house_id: house._id, name: 'Z' })
    const user: CurrentUser = { _id: String(farm.owner_id), email: 'o@t.vn', role: 'FARM_OWNER' }
    return { farm, zone, user }
  }

  it('24h: mỗi giờ một điểm đúng mốc giờ; giờ thiếu mưa là null, không phải 0; farm khác không lẫn vào', async () => {
    const { farm, zone, user } = await seedZone()
    const other = await seedFarm({ lat: 1, lng: 2 })
    const lastHour = Math.floor(Date.now() / HOUR) * HOUR - HOUR
    await WeatherObservation.create([
      { farm_id: farm._id, hour: new Date(lastHour - HOUR), temperature: 27, humidity: 85, precipitation_mm: 1.2 },
      { farm_id: farm._id, hour: new Date(lastHour), temperature: 28 },
      { farm_id: farm._id, hour: new Date(lastHour - 30 * HOUR), temperature: 20 }, // ngoài 24h
      { farm_id: other._id, hour: new Date(lastHour), temperature: 35 },
    ])

    const summary = await getEnvSummary(user, { zoneId: String(zone._id), range: '24h' })

    expect(summary.outdoor).toEqual([
      { timestamp: new Date(lastHour - HOUR), temperature: 27, humidity: 85, precipitation_mm: 1.2 },
      { timestamp: new Date(lastHour), temperature: 28, humidity: null, precipitation_mm: null },
    ])
  })

  it('1h: có giờ đã qua chứa `from` (bản ghi giờ H phủ [H, H+1h) và chỉ có khi giờ đó đã qua)', async () => {
    const { farm, zone, user } = await seedZone()
    const lastHour = Math.floor(Date.now() / HOUR) * HOUR - HOUR
    await WeatherObservation.create([
      { farm_id: farm._id, hour: new Date(lastHour), temperature: 29, humidity: 75, precipitation_mm: 0 },
      { farm_id: farm._id, hour: new Date(lastHour - HOUR), temperature: 20 }, // giờ trước nữa, ngoài khoảng
    ])

    const summary = await getEnvSummary(user, { zoneId: String(zone._id), range: '1h' })

    expect(summary.outdoor).toEqual([{ timestamp: new Date(lastHour), temperature: 29, humidity: 75, precipitation_mm: 0 }])
  })

  it('30d: các giờ gom theo đúng bucket của số đo trong nhà (≤ 120 điểm), nhiệt ẩm trung bình, mưa cộng dồn', async () => {
    const { farm, zone, user } = await seedZone()
    const summary0 = await getEnvSummary(user, { zoneId: String(zone._id), range: '30d' })
    expect(summary0.outdoor).toEqual([])
    const bucketMs = summary0.bucketMs
    const bucket = Math.floor((Date.now() - 2 * 86400_000) / bucketMs) * bucketMs
    await WeatherObservation.create([
      { farm_id: farm._id, hour: new Date(bucket), temperature: 26, humidity: 80, precipitation_mm: 0.5 },
      { farm_id: farm._id, hour: new Date(bucket + HOUR), temperature: 28, humidity: 90, precipitation_mm: 1.5 },
      { farm_id: farm._id, hour: new Date(bucket + 2 * HOUR), temperature: 30 },
    ])

    const summary = await getEnvSummary(user, { zoneId: String(zone._id), range: '30d' })

    expect(bucketMs).toBeGreaterThan(HOUR)
    expect(summary.outdoor).toEqual([{ timestamp: new Date(bucket), temperature: 28, humidity: 85, precipitation_mm: 2 }])
  })
})
