import type { CountingSchedule, DayWindows } from '@/types/expert.types'

// Khớp backend `countingSchedule.util.ts`: giới hạn nhập chống gõ nhầm
export const MAX_SCHEDULE_PROFILES = 12
export const MAX_TEMPORARY_WINDOWS = 60
export const PROFILE_NAME_MAX_LENGTH = 50

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const MONTH_DAY_RE = /^(\d{2})-(\d{2})$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export type ScheduleError = 'time' | 'order' | 'morningAfterEvening' | 'name' | 'monthDay' | 'date' | 'dateOrder' | 'overlap'

// 'MM-DD' có thật trong năm nhuận (02-29 hợp lệ)
function isMonthDay(value: string): boolean {
  const match = MONTH_DAY_RE.exec(value)
  if (!match) return false
  const at = new Date(Date.UTC(2024, Number(match[1]) - 1, Number(match[2])))
  return at.getUTCMonth() === Number(match[1]) - 1 && at.getUTCDate() === Number(match[2])
}

// Thứ tự của 'MM-DD' trong năm nhuận (0–365), như backend `countingSchedule.util.ts`
function dayOfYear(monthDay: string): number {
  const [month, day] = monthDay.split('-').map(Number)
  return Math.round((Date.UTC(2024, month - 1, day) - Date.UTC(2024, 0, 1)) / 86_400_000)
}

// Các ngày trong năm mà một hồ sơ phủ; from sau to là khoảng vắt qua năm mới
function profileDays(from: string, to: string): number[] {
  const days: number[] = []
  const last = dayOfYear(to)
  let day = dayOfYear(from)
  do {
    days.push(day)
    day = (day + 1) % 366
  } while (day !== (last + 1) % 366)
  return days
}

// Ngày có thật: 2026-02-30 bị trình duyệt đẩy sang tháng 3 hoặc thành Invalid Date, cả hai đều sai
function isDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false
  const at = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(at.getTime()) && at.toISOString().startsWith(value)
}

// Giờ đúng dạng, mỗi khung bắt đầu trước khi kết thúc, khung sáng kết thúc trước khi khung chiều bắt đầu
function windowsError(windows: DayWindows): ScheduleError | null {
  const times = [windows.morning.start, windows.morning.end, windows.evening.start, windows.evening.end]
  if (!times.every(time => TIME_RE.test(time))) return 'time'
  if (windows.morning.start >= windows.morning.end || windows.evening.start >= windows.evening.end) return 'order'
  if (windows.morning.end >= windows.evening.start) return 'morningAfterEvening'
  return null
}

// Dòng trùng ngày với dòng trên báo 'overlap', như backend
export function validateCountingSchedule(schedule: CountingSchedule): {
  profiles: Array<ScheduleError | null>
  temporary: Array<ScheduleError | null>
  defaults: ScheduleError | null
} {
  // Ngày trong năm đã có hồ sơ phía trên phủ: mỗi hồ sơ duyệt tối đa 366 ngày, nên O(số hồ sơ × 366)
  const coveredDays = new Set<number>()
  const profiles = schedule.profiles.map((profile): ScheduleError | null => {
    const name = profile.name.trim()
    if (!name || name.length > PROFILE_NAME_MAX_LENGTH) return 'name'
    if (!isMonthDay(profile.from) || !isMonthDay(profile.to)) return 'monthDay'
    const days = profileDays(profile.from, profile.to)
    const overlaps = days.some(day => coveredDays.has(day))
    days.forEach(day => coveredDays.add(day))
    return overlaps ? 'overlap' : windowsError(profile)
  })
  // Khoảng ngày của các khung tạm phía trên; 60 khung tối đa nên so từng cặp vẫn nhỏ
  const ranges: Array<{ from: string; to: string }> = []
  const temporary = schedule.temporary.map((window): ScheduleError | null => {
    if (!isDate(window.from) || !isDate(window.to)) return 'date'
    if (window.from > window.to) return 'dateOrder'
    const overlaps = ranges.some(range => window.from <= range.to && range.from <= window.to)
    ranges.push(window)
    return overlaps ? 'overlap' : windowsError(window)
  })
  const defaults = schedule.default_windows ? windowsError(schedule.default_windows) : null
  return { profiles, temporary, defaults }
}
