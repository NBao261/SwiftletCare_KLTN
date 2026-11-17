import { BadRequestError } from '@/utils/appError.util'

/**
 * VISION-FR-019, BR-13, BR-21 — lịch đếm của nhà: hồ sơ theo mùa (khoảng ngày trong năm, mỗi hồ sơ một khung sáng và
 * một khung chiều) và khung tạm cho những ngày cụ thể (ví dụ đợt mưa bão), khung tạm thắng hồ sơ; ngày không thuộc hồ
 * sơ nào dùng khung mặc định. Giờ là giờ Việt Nam ('HH:mm'), khung nửa mở [start, end).
 */

export interface TimeWindow { start: string; end: string }
export interface DayWindows { morning: TimeWindow; evening: TimeWindow }
/** Khoảng ngày trong năm 'MM-DD', tính cả hai đầu; `from` sau `to` là khoảng vắt qua năm mới (VD 11-01 → 02-28) */
export interface SeasonalProfile extends DayWindows { name: string; from: string; to: string }
/** Khoảng ngày 'YYYY-MM-DD', tính cả hai đầu */
export interface TemporaryWindow extends DayWindows { from: string; to: string }
export interface CountingSchedule { profiles: SeasonalProfile[]; temporary: TemporaryWindow[] }
/** Một lần sửa lịch: áp từ `effective_from` (ngày hôm sau lần sửa), ngày đã tính giữ khung cũ */
export interface ScheduleVersion { schedule: CountingSchedule; effective_from: string }
export type WindowSource = 'TEMPORARY' | 'PROFILE' | 'DEFAULT'

/** BR-13 — khung mặc định khi không hồ sơ hay khung tạm nào phủ ngày đó */
export const DEFAULT_WINDOWS: DayWindows = {
  morning: { start: '05:30', end: '07:00' },
  evening: { start: '17:30', end: '19:00' },
}
/** BR-21 — kiểm tỷ lệ chim về 15 phút sau khi khung chiều của ngày kết thúc */
export const RETURN_RATE_CHECK_DELAY_MIN = 15
/** Report 3 §4.5 — giới hạn nhập chống gõ nhầm, không phải lời khuyên nuôi (A-4) */
export const MAX_SCHEDULE_PROFILES = 12
export const MAX_TEMPORARY_WINDOWS = 60
export const PROFILE_NAME_MAX_LENGTH = 50

const DAY_MS = 86_400_000
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const MONTH_DAY_RE = /^(\d{2})-(\d{2})$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
/** Năm nhuận để 02-29 có chỗ trong lịch theo mùa */
const LEAP_YEAR = 2024

export const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)

/** Thứ tự của 'MM-DD' trong năm nhuận (0–365); null khi không phải ngày có thật */
function dayOfYear(monthDay: string): number | null {
  const match = MONTH_DAY_RE.exec(monthDay)
  if (!match) return null
  const [month, day] = [Number(match[1]), Number(match[2])]
  const at = new Date(Date.UTC(LEAP_YEAR, month - 1, day))
  if (at.getUTCMonth() !== month - 1 || at.getUTCDate() !== day) return null
  return Math.round((at.getTime() - Date.UTC(LEAP_YEAR, 0, 1)) / DAY_MS)
}

const isDate = (value: unknown): value is string =>
  typeof value === 'string' && DATE_RE.test(value) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value)

/** Các ngày trong năm mà một hồ sơ phủ (vắt qua năm mới thì hai đoạn) */
function profileDays(profile: Pick<SeasonalProfile, 'from' | 'to'>): Set<number> {
  const from = dayOfYear(profile.from) as number
  const to = dayOfYear(profile.to) as number
  const days = new Set<number>()
  // do-while: hồ sơ cả năm (01-01 → 12-31) có điểm dừng trùng điểm bắt đầu
  let d = from
  do {
    days.add(d)
    d = (d + 1) % 366
  } while (d !== (to + 1) % 366)
  return days
}

function parseWindow(raw: unknown, label: string): TimeWindow {
  const window = raw as Partial<TimeWindow> | undefined
  if (typeof window?.start !== 'string' || typeof window.end !== 'string' || !TIME_RE.test(window.start) || !TIME_RE.test(window.end)) {
    throw BadRequestError(`${label}: giờ phải có dạng HH:mm`)
  }
  if (window.start >= window.end) throw BadRequestError(`${label}: giờ bắt đầu phải trước giờ kết thúc`)
  return { start: window.start, end: window.end }
}

function parseDayWindows(raw: Record<string, unknown>, label: string): DayWindows {
  const morning = parseWindow(raw.morning, `${label}, khung sáng`)
  const evening = parseWindow(raw.evening, `${label}, khung chiều`)
  if (morning.end >= evening.start) throw BadRequestError(`${label}: khung sáng phải kết thúc trước khi khung chiều bắt đầu`)
  return { morning, evening }
}

/** VISION-FR-019 — 400 khi khung sai giờ, khung sáng không xong trước khung chiều, hồ sơ chồng nhau hay khung tạm chồng nhau */
export function parseCountingSchedule(input: unknown): CountingSchedule {
  const body = (input ?? {}) as Record<string, unknown>
  const rawProfiles = body.profiles ?? []
  const rawTemporary = body.temporary ?? []
  if (!Array.isArray(rawProfiles) || !Array.isArray(rawTemporary)) throw BadRequestError('profiles và temporary phải là danh sách')
  if (rawProfiles.length > MAX_SCHEDULE_PROFILES) throw BadRequestError(`Tối đa ${MAX_SCHEDULE_PROFILES} hồ sơ theo mùa`)
  if (rawTemporary.length > MAX_TEMPORARY_WINDOWS) throw BadRequestError(`Tối đa ${MAX_TEMPORARY_WINDOWS} khung tạm`)

  const profiles = rawProfiles.map((raw: Record<string, unknown>, index): SeasonalProfile => {
    const label = `Hồ sơ ${index + 1}`
    const name = typeof raw?.name === 'string' ? raw.name.trim() : ''
    if (!name || name.length > PROFILE_NAME_MAX_LENGTH) throw BadRequestError(`${label}: tên từ 1 đến ${PROFILE_NAME_MAX_LENGTH} ký tự`)
    if (typeof raw.from !== 'string' || typeof raw.to !== 'string' || dayOfYear(raw.from) === null || dayOfYear(raw.to) === null) {
      throw BadRequestError(`${label}: ngày bắt đầu và kết thúc có dạng MM-DD`)
    }
    return { name, from: raw.from, to: raw.to, ...parseDayWindows(raw, label) }
  })
  const covered = new Map<number, string>()
  for (const profile of profiles) {
    for (const day of profileDays(profile)) {
      const other = covered.get(day)
      if (other) throw BadRequestError(`Hồ sơ "${profile.name}" chồng ngày với hồ sơ "${other}"`)
      covered.set(day, profile.name)
    }
  }

  const temporary = rawTemporary.map((raw: Record<string, unknown>, index): TemporaryWindow => {
    const label = `Khung tạm ${index + 1}`
    if (!isDate(raw?.from) || !isDate(raw.to)) throw BadRequestError(`${label}: ngày có dạng YYYY-MM-DD`)
    if (raw.from > raw.to) throw BadRequestError(`${label}: ngày bắt đầu không được sau ngày kết thúc`)
    return { from: raw.from, to: raw.to, ...parseDayWindows(raw, label) }
  }).sort((a, b) => a.from.localeCompare(b.from))
  for (let i = 1; i < temporary.length; i++) {
    if (temporary[i].from <= temporary[i - 1].to) throw BadRequestError(`Khung tạm từ ${temporary[i].from} chồng ngày với khung tạm trước`)
  }
  return { profiles, temporary }
}

/** Phiên bản lịch áp cho ngày `date`: lần sửa cuối có `effective_from` không sau ngày đó; chưa sửa lần nào thì không có */
export function scheduleOn(history: ScheduleVersion[] | undefined, date: string): CountingSchedule | undefined {
  let schedule: CountingSchedule | undefined
  for (const version of history ?? []) {
    if (version.effective_from <= date) schedule = version.schedule
  }
  return schedule
}

/** VISION-FR-019 — khung của ngày: khung tạm, rồi hồ sơ theo mùa, rồi mặc định (BR-13) */
export function windowsOn(schedule: CountingSchedule | undefined, date: string): DayWindows & { source: WindowSource } {
  const temporary = schedule?.temporary.find(t => t.from <= date && date <= t.to)
  if (temporary) return { morning: temporary.morning, evening: temporary.evening, source: 'TEMPORARY' }
  const day = dayOfYear(date.slice(5))
  const profile = day === null ? undefined : schedule?.profiles.find(p => profileDays(p).has(day))
  if (profile) return { morning: profile.morning, evening: profile.evening, source: 'PROFILE' }
  return { ...DEFAULT_WINDOWS, source: 'DEFAULT' }
}

/** Khung giờ VN của ngày `date` thành khoảng thời gian thật [start, end) */
export const windowInterval = (date: string, window: TimeWindow) => ({
  start: new Date(`${date}T${window.start}:00+07:00`),
  end: new Date(`${date}T${window.end}:00+07:00`),
})

/**
 * BR-21 — lúc kiểm tỷ lệ chim về của nhà: 15 phút sau khi khung chiều kết thúc. Khung chiều kết thúc sát nửa đêm thì
 * vẫn kiểm trong ngày (23:59), để ngày đó không bị bỏ qua khi sang ngày mới.
 */
export function returnRateCheckAt(date: string, windows: DayWindows): Date {
  const due = windowInterval(date, windows.evening).end.getTime() + RETURN_RATE_CHECK_DELAY_MIN * 60_000
  return new Date(Math.min(due, new Date(`${date}T23:59:00+07:00`).getTime()))
}
