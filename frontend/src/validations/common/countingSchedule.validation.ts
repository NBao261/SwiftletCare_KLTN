import type { CountingSchedule, DayWindows } from '@/types/expert.types'

// Khớp backend `countingSchedule.util.ts` (Report 3 §4.5): giới hạn nhập chống gõ nhầm
export const MAX_SCHEDULE_PROFILES = 12
export const MAX_TEMPORARY_WINDOWS = 60
export const PROFILE_NAME_MAX_LENGTH = 50

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const MONTH_DAY_RE = /^(\d{2})-(\d{2})$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export type ScheduleError = 'time' | 'order' | 'morningAfterEvening' | 'name' | 'monthDay' | 'date' | 'dateOrder'

// 'MM-DD' có thật trong năm nhuận (02-29 hợp lệ)
function isMonthDay(value: string): boolean {
  const match = MONTH_DAY_RE.exec(value)
  if (!match) return false
  const at = new Date(Date.UTC(2024, Number(match[1]) - 1, Number(match[2])))
  return at.getUTCMonth() === Number(match[1]) - 1 && at.getUTCDate() === Number(match[2])
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

// Lỗi đầu tiên của từng dòng (null = dòng hợp lệ); chồng ngày giữa các dòng do backend kiểm và trả 400
export function validateCountingSchedule(schedule: CountingSchedule): {
  profiles: Array<ScheduleError | null>
  temporary: Array<ScheduleError | null>
} {
  return {
    profiles: schedule.profiles.map(profile => {
      const name = profile.name.trim()
      if (!name || name.length > PROFILE_NAME_MAX_LENGTH) return 'name'
      if (!isMonthDay(profile.from) || !isMonthDay(profile.to)) return 'monthDay'
      return windowsError(profile)
    }),
    temporary: schedule.temporary.map(window => {
      if (!isDate(window.from) || !isDate(window.to)) return 'date'
      if (window.from > window.to) return 'dateOrder'
      return windowsError(window)
    }),
  }
}
