import { BirdCountBucket } from '@/models/birdCountBucket.model'
import { WeatherObservation } from '@/models/weatherObservation.model'

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000
const BUCKET_MS = 5 * 60_000

export interface Interval { start: number; end: number }
export const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end

/** Đầu ngày giờ VN của 'YYYY-MM-DD' */
const vnDayStart = (date: string) => new Date(`${date}T00:00:00+07:00`)

/**
 * Khung 2 phiên đếm của ngày lấy từ khoảng 5 phút có số đếm (sáng trước 12:00, chiều sau 12:00 giờ VN). Gần đúng: bucket
 * còn được ghi ngoài 2 phiên đếm, nên khung có thể rộng hơn phiên thật. G-12 thay bằng `window_start`/`window_end` của phiên.
 */
export async function sessionWindows(houseId: unknown, start: Date): Promise<Interval[]> {
  const noon = start.getTime() + 12 * HOUR_MS
  const buckets = await BirdCountBucket.find({ house_id: houseId, bucket_start: { $gte: start, $lt: new Date(start.getTime() + DAY_MS) } })
    .select('bucket_start').lean()
  const windows: Interval[] = []
  for (const [lo, hi] of [[start.getTime(), noon], [noon, start.getTime() + DAY_MS]]) {
    const times = buckets.map(b => b.bucket_start.getTime()).filter(t => t >= lo && t < hi)
    if (times.length) windows.push({ start: Math.min(...times), end: Math.max(...times) + BUCKET_MS })
  }
  return windows
}

export interface SessionRain {
  mm: number
  /** SESSIONS: các giờ trùng khung phiên đếm; DAY: chưa biết khung phiên (chưa có số đếm 5 phút) nên lấy cả ngày */
  scope: 'SESSIONS' | 'DAY'
}

/**
 * VISION-FR-011 — lượng mưa (mm) của các giờ (theo giờ, nên cả giờ được tính dù chỉ trùng một phần) trùng khung 2 phiên
 * đếm trong ngày (giờ VN) của nhà, từ thời tiết theo giờ của farm (ANALYTICS-FR-013). null = không có số đo mưa nào
 * trong khung phiên (kể cả khi có số của giờ khác): không được ghi "0 mm" cho một khung không có dữ liệu.
 */
export async function sessionRainfall(houseId: unknown, farmId: unknown, date: string): Promise<SessionRain | null> {
  const start = vnDayStart(date)
  const rows = await WeatherObservation.find({ farm_id: farmId, hour: { $gte: start, $lt: new Date(start.getTime() + DAY_MS) } })
    .select('hour precipitation_mm').lean()
  const measured = rows.filter(r => typeof r.precipitation_mm === 'number')
  if (measured.length === 0) return null
  const windows = await sessionWindows(houseId, start)
  const inScope = windows.length
    ? measured.filter(r => windows.some(w => overlaps({ start: r.hour.getTime(), end: r.hour.getTime() + HOUR_MS }, w)))
    : measured
  if (inScope.length === 0) return null
  return {
    mm: Math.round(inScope.reduce((sum, r) => sum + (r.precipitation_mm as number), 0) * 10) / 10,
    scope: windows.length ? 'SESSIONS' : 'DAY',
  }
}
