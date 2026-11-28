import { Farm } from '@/models/farm.model'
import { WeatherObservation } from '@/models/weatherObservation.model'
import { assertHouseAccess } from '@/utils/farmAccess.util'
import type { CurrentUser } from '@/types'
import { conditionOfWeatherCode, isRainy, type WeatherCondition } from '@/utils/weatherCondition.util'
import logger from '@/utils/logger.util'

// Chỉ toạ độ rời hệ thống. Thiếu thì để trống, không bao giờ 0
// Một biến cho cả hai luồng
export const OPEN_METEO_URL = () => process.env.OPEN_METEO_URL || 'https://api.open-meteo.com/v1/forecast'
// Bỏ sau 10 s, giờ sau gọi lại
export const WEATHER_FETCH_TIMEOUT_MS = 10_000
const HOUR_MS = 3600_000

interface OpenMeteoHourly {
  time?: string[]
  temperature_2m?: (number | null)[]
  relative_humidity_2m?: (number | null)[]
  precipitation?: (number | null)[]
}

const valueAt = (arr: (number | null)[] | undefined, i: number) => {
  const v = arr?.[i]
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

// Mưa ở mốc T là tổng giờ trước nên bản ghi hour = T − 1 giờ
export async function fetchFarmWeather(farm: { _id: unknown; coordinates?: { lat: number; lng: number } }, now = new Date()): Promise<number> {
  if (!farm.coordinates) return 0
  const url = new URL(OPEN_METEO_URL())
  url.searchParams.set('latitude', String(farm.coordinates.lat))
  url.searchParams.set('longitude', String(farm.coordinates.lng))
  url.searchParams.set('hourly', 'temperature_2m,relative_humidity_2m,precipitation')
  url.searchParams.set('timezone', 'GMT')
  url.searchParams.set('past_days', '1')
  url.searchParams.set('forecast_days', '1')

  const res = await fetch(url, { signal: AbortSignal.timeout(WEATHER_FETCH_TIMEOUT_MS) })
  if (!res.ok) throw new Error(`Open-Meteo trả ${res.status}`)
  const hourly = ((await res.json()) as { hourly?: OpenMeteoHourly }).hourly
  const times = hourly?.time ?? []

  const ops = []
  for (let i = 0; i < times.length; i++) {
    const end = Date.parse(`${times[i]}Z`)
    if (!Number.isFinite(end) || end > now.getTime()) continue
    const fields = {
      temperature: valueAt(hourly?.temperature_2m, i),
      humidity: valueAt(hourly?.relative_humidity_2m, i),
      precipitation_mm: valueAt(hourly?.precipitation, i),
    }
    const set = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined))
    if (Object.keys(set).length === 0) continue
    ops.push({
      updateOne: {
        filter: { farm_id: farm._id, hour: new Date(end - HOUR_MS) },
        update: { $set: set },
        upsert: true,
      },
    })
  }
  if (ops.length) await WeatherObservation.bulkWrite(ops, { ordered: false })
  return ops.length
}

// Lỗi ở một farm không bỏ qua farm sau
export async function fetchAllFarmsWeather(now = new Date()): Promise<number> {
  const farms = await Farm.find({ 'coordinates.lat': { $exists: true } }).select('coordinates').lean()
  let written = 0
  for (const farm of farms) {
    try {
      written += await fetchFarmWeather(farm, now)
    } catch (err) {
      logger.warn('Lấy thời tiết thất bại', { farmId: String(farm._id), err: (err as Error).message })
    }
  }
  return written
}

// Open-Meteo làm mới số hiện tại mỗi 15 phút: giữ 10 phút để màn nào cũng mở được mà không gọi dịch vụ ngoài mỗi lần
export const CURRENT_WEATHER_TTL_MS = 10 * 60_000

export interface CurrentWeather {
  observed_at: string
  condition: WeatherCondition
  // Đang mưa phùn, mưa hoặc dông
  is_raining: boolean
  is_day: boolean
  temperature_c: number | null
  humidity_pct: number | null
  precipitation_mm: number | null
  cloud_cover_pct: number | null
}

interface OpenMeteoCurrent {
  time?: string
  temperature_2m?: number | null
  relative_humidity_2m?: number | null
  precipitation?: number | null
  cloud_cover?: number | null
  weather_code?: number | null
  is_day?: number | null
}

const currentCache = new Map<string, { at: number; value: CurrentWeather }>()
// Lần gọi đang chạy theo toạ độ: nhiều request cùng lúc chỉ gọi ra ngoài một lần
const currentInFlight = new Map<string, Promise<CurrentWeather>>()

const numberOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

// Tình trạng trời ở toạ độ của farm. Lỗi mạng hay dịch vụ trả lỗi thì ném, nơi gọi coi là không có số (không bao giờ là 0)
export async function fetchCurrentWeather(coordinates: { lat: number; lng: number }, now = new Date()): Promise<CurrentWeather> {
  // Làm tròn 2 chữ số (~1 km): nhiều nhà gần nhau dùng chung một lần gọi
  const key = `${coordinates.lat.toFixed(2)},${coordinates.lng.toFixed(2)}`
  const cached = currentCache.get(key)
  if (cached && now.getTime() - cached.at < CURRENT_WEATHER_TTL_MS) return cached.value
  const running = currentInFlight.get(key)
  if (running) return running
  const request = requestCurrentWeather(coordinates, key, now).finally(() => currentInFlight.delete(key))
  currentInFlight.set(key, request)
  return request
}

async function requestCurrentWeather(coordinates: { lat: number; lng: number }, key: string, now: Date): Promise<CurrentWeather> {
  const url = new URL(OPEN_METEO_URL())
  url.searchParams.set('latitude', String(coordinates.lat))
  url.searchParams.set('longitude', String(coordinates.lng))
  url.searchParams.set('current', 'temperature_2m,relative_humidity_2m,precipitation,cloud_cover,weather_code,is_day')
  url.searchParams.set('timezone', 'GMT')
  const res = await fetch(url, { signal: AbortSignal.timeout(WEATHER_FETCH_TIMEOUT_MS) })
  if (!res.ok) throw new Error(`Open-Meteo trả ${res.status}`)
  const current = ((await res.json()) as { current?: OpenMeteoCurrent }).current
  const observedAt = typeof current?.time === 'string' ? Date.parse(`${current.time}Z`) : Number.NaN
  // Thiếu giờ quan trắc hoặc is_day thì không đoán: ban đêm trời quang sẽ thành "nắng"
  if (!current || !Number.isFinite(observedAt) || (current.is_day !== 0 && current.is_day !== 1)) throw new Error('Open-Meteo không trả số hiện tại')

  const condition = conditionOfWeatherCode(current.weather_code)
  const value: CurrentWeather = {
    observed_at: new Date(observedAt).toISOString(),
    condition,
    is_raining: isRainy(condition),
    is_day: current.is_day === 1,
    temperature_c: numberOrNull(current.temperature_2m),
    humidity_pct: numberOrNull(current.relative_humidity_2m),
    precipitation_mm: numberOrNull(current.precipitation),
    cloud_cover_pct: numberOrNull(current.cloud_cover),
  }
  currentCache.set(key, { at: now.getTime(), value })
  return value
}

// Chỉ dùng trong test: bỏ số đã nhớ
export const clearCurrentWeatherCache = (): void => currentCache.clear()

// Trời ở ngoài nhà yến: theo toạ độ của farm chứa nhà. Farm chưa có toạ độ hoặc dịch vụ lỗi thì không có số, nói rõ lý do
export async function getCurrentWeatherOfHouse(houseId: string, user: CurrentUser, now = new Date()) {
  const { house, farm } = await assertHouseAccess(houseId, user)
  const base = { house_id: String(house._id) }
  if (farm.coordinates?.lat === undefined || farm.coordinates?.lng === undefined) {
    return { ...base, weather: null, reason: 'NO_COORDINATES' as const }
  }
  try {
    return { ...base, weather: await fetchCurrentWeather(farm.coordinates, now) }
  } catch (err) {
    logger.warn('Lấy thời tiết hiện tại thất bại', { houseId, err: (err as Error).message })
    return { ...base, weather: null, reason: 'UNAVAILABLE' as const }
  }
}
