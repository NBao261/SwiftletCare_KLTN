import type {
  CountingDayWindows,
  CountingSchedule,
  CountingTimeWindow,
  SeasonalCountingProfile,
  TemporaryCountingWindow,
} from '@/types'
import { t } from '@/utils/i18n.utils'

// Giới hạn của lịch đếm (backend countingSchedule.util, Report 3 §4.5)
export const MAX_SCHEDULE_PROFILES = 12
export const MAX_TEMPORARY_WINDOWS = 60
export const PROFILE_NAME_MAX_LENGTH = 50

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
// Số ngày của mỗi tháng trong năm nhuận: 29/02 là ngày hợp lệ của hồ sơ theo mùa
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

// Giờ 'HH:mm' 24 giờ
export function isValidTime(text: string): boolean {
  return TIME_PATTERN.test(text)
}

// Ngày trong năm 'MM-DD' thành thứ tự 0…365 (theo năm nhuận); sai dạng thì null
export function dayOfYear(monthDay: string): number | null {
  const match = /^(\d{2})-(\d{2})$/.exec(monthDay)
  if (!match) return null
  const month = Number(match[1])
  const day = Number(match[2])
  if (month < 1 || month > 12 || day < 1 || day > DAYS_IN_MONTH[month - 1]) return null
  let total = day - 1
  for (let index = 0; index < month - 1; index += 1) total += DAYS_IN_MONTH[index]
  return total
}

// Ngày 'YYYY-MM-DD' có thật
export function isValidDate(text: string): boolean {
  if (!DATE_PATTERN.test(text)) return false
  const time = Date.parse(`${text}T00:00:00Z`)
  return !Number.isNaN(time) && new Date(time).toISOString().startsWith(text)
}

// Lỗi của một khung giờ; hợp lệ thì null
function validateWindow(window: CountingTimeWindow): string | null {
  if (!isValidTime(window.start) || !isValidTime(window.end)) return t('Giờ có dạng HH:mm, ví dụ 05:30')
  if (window.start >= window.end) return t('Giờ bắt đầu phải trước giờ kết thúc')
  return null
}

// Lỗi của khung sáng và khung chiều của một ngày: mỗi khung đúng giờ, khung sáng xong trước khi khung chiều bắt đầu
export function validateDayWindows(windows: CountingDayWindows): string | null {
  const morningError = validateWindow(windows.morning)
  if (morningError) return t('Khung sáng: {error}', { error: morningError })
  const eveningError = validateWindow(windows.evening)
  if (eveningError) return t('Khung chiều: {error}', { error: eveningError })
  if (windows.morning.end >= windows.evening.start) return t('Khung sáng phải kết thúc trước khi khung chiều bắt đầu')
  return null
}

// Lỗi của một hồ sơ theo mùa đang nhập
export function validateProfile(profile: SeasonalCountingProfile): string | null {
  const name = profile.name.trim()
  if (!name || name.length > PROFILE_NAME_MAX_LENGTH) return t('Tên hồ sơ từ 1 đến {max} ký tự', { max: PROFILE_NAME_MAX_LENGTH })
  if (dayOfYear(profile.from) === null || dayOfYear(profile.to) === null) return t('Ngày có dạng MM-DD, ví dụ 03-15')
  return validateDayWindows(profile)
}

// Lỗi của một khung tạm đang nhập
export function validateTemporaryWindow(window: TemporaryCountingWindow): string | null {
  if (!isValidDate(window.from) || !isValidDate(window.to)) return t('Ngày có dạng YYYY-MM-DD')
  if (window.from > window.to) return t('Ngày bắt đầu không được sau ngày kết thúc')
  return validateDayWindows(window)
}

// Các ngày trong năm mà hồ sơ phủ (vắt qua năm mới thì hai đoạn), như backend
function profileDays(profile: Pick<SeasonalCountingProfile, 'from' | 'to'>): Set<number> {
  const from = dayOfYear(profile.from) as number
  const to = dayOfYear(profile.to) as number
  const days = new Set<number>()
  let day = from
  do {
    days.add(day)
    day = (day + 1) % 366
  } while (day !== (to + 1) % 366)
  return days
}

// Lỗi của cả lịch trước khi lưu: số hồ sơ, số khung tạm, hồ sơ chồng ngày, khung tạm chồng ngày (backend trả 400 cho các lỗi này)
export function validateCountingSchedule(schedule: CountingSchedule): string | null {
  if (schedule.profiles.length > MAX_SCHEDULE_PROFILES) return t('Tối đa {max} hồ sơ theo mùa', { max: MAX_SCHEDULE_PROFILES })
  if (schedule.temporary.length > MAX_TEMPORARY_WINDOWS) return t('Tối đa {max} khung tạm', { max: MAX_TEMPORARY_WINDOWS })
  const ownerByDay = new Map<number, string>()
  for (const profile of schedule.profiles) {
    for (const day of profileDays(profile)) {
      const owner = ownerByDay.get(day)
      if (owner !== undefined) return t('Hồ sơ "{first}" và "{second}" chồng ngày nhau', { first: owner, second: profile.name })
      ownerByDay.set(day, profile.name)
    }
  }
  const sorted = [...schedule.temporary].sort((left, right) => left.from.localeCompare(right.from))
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].from <= sorted[index - 1].to) {
      return t('Khung tạm từ {date} chồng ngày với khung tạm trước', { date: sorted[index].from })
    }
  }
  return null
}

// Dấu nối không ngắt dòng: chữ không bị xuống hàng ngay ở dấu "–" giữa hai mốc
const NO_BREAK_DASH = '\u2060–\u2060'

// Một khung giờ: "05:30–07:00", không ngắt dòng giữa hai mốc
export function formatTimeWindow(window: CountingTimeWindow): string {
  return `${window.start}${NO_BREAK_DASH}${window.end}`
}

// Hai khung của một ngày, mỗi khung một dòng: "Sáng 05:30–07:00" rồi "Chiều 17:30–19:00"
export function formatDayWindows(windows: CountingDayWindows): string {
  return [
    t('Sáng {window}', { window: formatTimeWindow(windows.morning) }),
    t('Chiều {window}', { window: formatTimeWindow(windows.evening) }),
  ].join('\n')
}

// Ngày trong năm 'MM-DD' thành 'dd/MM'
export function formatMonthDay(monthDay: string): string {
  const [month, day] = monthDay.split('-')
  return `${day}/${month}`
}

// Khoảng ngày trong năm của hồ sơ: "01/12–28/02", không ngắt dòng giữa hai mốc
export function formatMonthDayRange(from: string, to: string): string {
  return `${formatMonthDay(from)}${NO_BREAK_DASH}${formatMonthDay(to)}`
}

// Khoảng ngày của khung tạm, mỗi mốc một dòng (ngày đủ năm dài, ghép một dòng thì bị ngắt giữa số)
export function formatDateRange(from: string, to: string): string {
  const format = (date: string) => date.split('-').reverse().join('/')
  return [format(from), t('đến {date}', { date: format(to) })].join('\n')
}
