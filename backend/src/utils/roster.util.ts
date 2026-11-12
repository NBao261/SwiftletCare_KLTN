import { BadRequestError } from '@/utils/appError.util'

/** AUTH-FR-014 — một ca trực của nhà: giờ VN do Farm Owner nhập, `end` trước `start` là ca qua nửa đêm */
export interface RosterShift {
  technician_id: string
  role: 'PRIMARY' | 'BACKUP'
  /** 0 = Chủ nhật … 6 = thứ Bảy, theo ngày bắt đầu ca */
  weekdays: number[]
  start: string
  end: string
}

export const ROSTER_ROLES = ['PRIMARY', 'BACKUP'] as const
export const HHMM_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

const MINUTES_PER_DAY = 1440
const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY
/** Việt Nam không đổi giờ mùa hè: UTC+7 cố định */
const VN_OFFSET_MS = 7 * 3600_000

const toMinutes = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))

/** Các khoảng [từ, tới) tính bằng phút trong tuần của 1 ca; ca qua đêm thứ Bảy được tách sang đầu tuần */
function weeklyIntervals(shift: Pick<RosterShift, 'weekdays' | 'start' | 'end'>): Array<[number, number]> {
  const start = toMinutes(shift.start)
  const end = toMinutes(shift.end)
  const intervals: Array<[number, number]> = []
  for (const day of shift.weekdays) {
    const from = day * MINUTES_PER_DAY + start
    const to = (end > start ? day : day + 1) * MINUTES_PER_DAY + end
    if (to <= MINUTES_PER_WEEK) intervals.push([from, to])
    else intervals.push([from, MINUTES_PER_WEEK], [0, to - MINUTES_PER_WEEK])
  }
  return intervals
}

/**
 * AUTH-FR-014 — kiểm lịch trực trước khi lưu (định dạng đã qua validator của route): giờ bắt đầu khác giờ kết
 * thúc, ngày trong tuần không lặp, hai ca cùng vai không chồng giờ (một thời điểm chỉ có 1 thợ chính trực).
 */
export function assertValidRoster(shifts: RosterShift[]): void {
  for (const shift of shifts) {
    if (shift.start === shift.end) throw BadRequestError(`Ca ${shift.start}–${shift.end}: giờ bắt đầu phải khác giờ kết thúc`)
    if (new Set(shift.weekdays).size !== shift.weekdays.length) throw BadRequestError('Một ca không được lặp ngày trong tuần')
  }
  for (const role of ROSTER_ROLES) {
    const intervals = shifts.filter(s => s.role === role).flatMap(s => weeklyIntervals(s)).sort((a, b) => a[0] - b[0])
    for (let i = 1; i < intervals.length; i++) {
      if (intervals[i][0] < intervals[i - 1][1]) throw BadRequestError(`Hai ca ${role === 'PRIMARY' ? 'thợ chính' : 'thợ phụ'} chồng giờ nhau`)
    }
  }
}

/** Ca có phủ thời điểm `at` không (giờ VN) */
export function shiftCovers(shift: Pick<RosterShift, 'weekdays' | 'start' | 'end'>, at: Date): boolean {
  const vn = new Date(at.getTime() + VN_OFFSET_MS)
  const minute = vn.getUTCDay() * MINUTES_PER_DAY + vn.getUTCHours() * 60 + vn.getUTCMinutes()
  return weeklyIntervals(shift).some(([from, to]) => minute >= from && minute < to)
}

/**
 * AUTH-FR-014, ALERT-FR-017 — thợ đang trực của nhà lúc `at`: ca thợ chính, rồi ca thợ phụ; ngoài mọi ca
 * thì thợ chính của nhà; nhà chưa có thợ thì null (cảnh báo gửi Farm Owner, G-21).
 */
export function technicianOnDuty(
  house: {
    technicians?: Array<{ user_id: unknown; primary: boolean }>
    roster?: Array<{ technician_id: unknown; role: RosterShift['role']; weekdays: number[]; start: string; end: string }>
  },
  at: Date = new Date(),
): string | null {
  const roster = house.roster ?? []
  for (const role of ROSTER_ROLES) {
    const shift = roster.find(s => s.role === role && shiftCovers(s, at))
    if (shift) return String(shift.technician_id)
  }
  const primary = (house.technicians ?? []).find(t => t.primary)
  return primary ? String(primary.user_id) : null
}
