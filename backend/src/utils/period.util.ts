import { BadRequestError } from '@/utils/appError.util'

const DAY_MS = 86_400_000
const VN_OFFSET_MS = 7 * 3_600_000

/** Report 3 §4.5 */
export const MAX_PERIOD_DAYS = 366

/** Chỉ có ngày thì là đầu ngày giờ VN (00:00 UTC làm lệch một ngày) */
export function parsePeriodParam(value: unknown): Date | undefined {
  if (typeof value !== 'string' || value === '') return undefined
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00+07:00`) : new Date(value)
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const DATE_TIME_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/

/** Không nhận '2026', '2026-11' (lệch một ngày) hay giờ không múi giờ (phụ thuộc máy chủ) */
export function isPeriodParam(value: unknown): boolean {
  if (typeof value !== 'string' || !(DATE_ONLY.test(value) || DATE_TIME_WITH_OFFSET.test(value))) return false
  return !Number.isNaN(parsePeriodParam(value)!.getTime())
}

const vnDayStartOf = (at: Date) =>
  new Date(Math.floor((at.getTime() + VN_OFFSET_MS) / DAY_MS) * DAY_MS - VN_OFFSET_MS)

/** Về trọn ngày giờ VN, giữ đúng số ngày: "30 ngày" là 30, không 31 */
export function vnDayPeriod(from: Date, to: Date): { from: Date; to: Date; days: number } {
  if (from >= to) throw BadRequestError('`from` phải trước `to`')
  const days = Math.ceil((to.getTime() - from.getTime()) / DAY_MS)
  if (days > MAX_PERIOD_DAYS) throw BadRequestError(`Khoảng tối đa ${MAX_PERIOD_DAYS} ngày`)
  const end = new Date(vnDayStartOf(new Date(to.getTime() - 1)).getTime() + DAY_MS)
  return { from: new Date(end.getTime() - days * DAY_MS), to: end, days }
}
