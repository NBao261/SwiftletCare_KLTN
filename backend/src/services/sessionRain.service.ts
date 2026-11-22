import { House } from '@/models/houseZone.model'
import { WeatherObservation } from '@/models/weatherObservation.model'
import { scheduleOn, windowInterval, windowsOn } from '@/utils/countingSchedule.util'

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000

export interface Interval { start: number; end: number }
export const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end

const vnDayStart = (date: string) => new Date(`${date}T00:00:00+07:00`)

// Ngày đã tính có cùng khung vì lịch áp từ ngày hôm sau
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
  mm: number
}

// Cả giờ được tính dù chỉ trùng một phần. null thì không được ghi "0 mm"
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
