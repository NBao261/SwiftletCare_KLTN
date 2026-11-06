import { Farm } from '@/models/farm.model'
import { WeatherObservation } from '@/models/weatherObservation.model'
import logger from '@/utils/logger.util'

/**
 * ANALYTICS-FR-013, DF-11 — thời tiết ngoài trời theo giờ của mỗi farm có toạ độ, lấy từ Open-Meteo.
 * Chỉ toạ độ rời hệ thống (Report 4 §10). Farm không có toạ độ hoặc lần gọi lỗi thì không ghi gì —
 * giá trị thiếu hiện là thiếu, không bao giờ là 0. Chỉ dùng để hiển thị và cho luật mưa BR-30 (C-6).
 */
const OPEN_METEO_URL = () => process.env.OPEN_METEO_URL || 'https://api.open-meteo.com/v1/forecast'
/** ponytail: Open-Meteo treo thì bỏ sau 10 giây, giờ sau gọi lại (hằng số kỹ thuật, Report 3 §4.5) */
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

/**
 * Lấy hôm qua và hôm nay của 1 farm rồi upsert các giờ đã qua (giờ sau ghi đè giờ trước — mất mạng
 * dưới 1 ngày vẫn bù được). Lượng mưa của Open-Meteo ở mốc T là tổng của giờ trước đó, nên bản ghi
 * `hour` = T − 1 giờ; nhiệt độ, độ ẩm là giá trị lúc cuối giờ đó. Trả số giờ đã ghi.
 */
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

/** Gọi mỗi giờ từ jobs/weather.job.ts. Lỗi ở một farm không làm bỏ qua các farm sau */
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
