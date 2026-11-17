import { House } from '@/models/houseZone.model'
import { WeatherObservation } from '@/models/weatherObservation.model'
import { scheduleOn, windowInterval, windowsOn } from '@/utils/countingSchedule.util'

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000

export interface Interval { start: number; end: number }
export const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end

/** Đầu ngày giờ VN của 'YYYY-MM-DD' */
const vnDayStart = (date: string) => new Date(`${date}T00:00:00+07:00`)

/**
 * VISION-FR-019 — khung 2 phiên đếm của nhà trong ngày bắt đầu lúc `start` (đầu ngày giờ VN), theo lịch đếm đang áp hôm
 * đó (khung tạm, hồ sơ theo mùa, rồi mặc định BR-13); ngày đã tính phiên có cùng khung vì lịch áp từ ngày hôm sau
 */
export async function sessionWindows(houseId: unknown, start: Date): Promise<Interval[]> {
  const date = new Date(start.getTime() + 7 * HOUR_MS).toISOString().slice(0, 10)
  const house = await House.findById(houseId).select('counting_schedule_history').lean()
  const { morning, evening } = windowsOn(scheduleOn(house?.counting_schedule_history, date), date)
  return [morning, evening].map(window => {
    const { start: from, end: to } = windowInterval(date, window)
    return { start: from.getTime(), end: to.getTime() }
  })
}

export interface SessionRain {
  /** Tổng mm của các giờ trùng khung phiên đếm */
  mm: number
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
  const inScope = measured.filter(r => windows.some(w => overlaps({ start: r.hour.getTime(), end: r.hour.getTime() + HOUR_MS }, w)))
  if (inScope.length === 0) return null
  return { mm: Math.round(inScope.reduce((sum, r) => sum + (r.precipitation_mm as number), 0) * 10) / 10 }
}
