import type { FarmKey } from '@/constants/farmStructure.i18n'
import type { RosterShift } from '@/types'

export type RosterError = Extract<FarmKey, 'roster.errTechnician' | 'roster.errDays' | 'roster.errTime' | 'roster.errSameTime' | 'roster.errOverlap'>

// Thứ tự hiển thị kiểu Việt Nam: thứ Hai trước, Chủ nhật cuối (0 = Chủ nhật như backend)
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

const HHMM_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
const MINUTES_PER_DAY = 1440
const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY

const toMinutes = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))

export const isOvernightShift = (shift: Pick<RosterShift, 'start' | 'end'>): boolean => toMinutes(shift.end) < toMinutes(shift.start)

// Các khoảng [từ, tới) theo phút trong tuần; ca qua đêm thứ Bảy tách sang đầu tuần — giống roster.util của backend
function weeklyIntervals(shift: Pick<RosterShift, 'weekdays' | 'start' | 'end'>): Array<[number, number]> {
  const start = toMinutes(shift.start)
  const end = toMinutes(shift.end)
  return shift.weekdays.flatMap((day): Array<[number, number]> => {
    const from = day * MINUTES_PER_DAY + start
    const to = (end > start ? day : day + 1) * MINUTES_PER_DAY + end
    return to <= MINUTES_PER_WEEK ? [[from, to]] : [[from, MINUTES_PER_WEEK], [0, to - MINUTES_PER_WEEK]]
  })
}

// Kiểm 1 ca trước khi gửi PUT …/roster (AUTH-FR-014), cùng luật backend: có thợ, ≥ 1 ngày, giờ HH:mm khác nhau,
// không chồng giờ với ca cùng vai trong `others` (các ca còn lại của nhà)
export function validateRosterShift(shift: RosterShift, others: RosterShift[]): RosterError | null {
  if (!shift.technician_id) return 'roster.errTechnician'
  if (shift.weekdays.length === 0) return 'roster.errDays'
  if (!HHMM_PATTERN.test(shift.start) || !HHMM_PATTERN.test(shift.end)) return 'roster.errTime'
  if (shift.start === shift.end) return 'roster.errSameTime'
  const taken = others.filter(other => other.role === shift.role).flatMap(weeklyIntervals)
  const overlaps = weeklyIntervals(shift).some(([from, to]) => taken.some(([takenFrom, takenTo]) => from < takenTo && takenFrom < to))
  return overlaps ? 'roster.errOverlap' : null
}
