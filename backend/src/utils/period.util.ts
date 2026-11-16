import { BadRequestError } from '@/utils/appError.util'

const DAY_MS = 86_400_000
const VN_OFFSET_MS = 7 * 3_600_000

/** Report 3 §4.5 — khoảng dài nhất của bảng so sánh nhà và điện năng ước tính: 1 năm, như một mùa vụ dài nhất */
export const MAX_PERIOD_DAYS = 366

/**
 * Tham số `from`/`to` của khoảng: chỉ có ngày ('YYYY-MM-DD') là đầu ngày giờ VN (không phải 00:00 UTC = 07:00 VN, vốn
 * làm khoảng lệch một ngày); có giờ thì đọc như ISO 8601.
 */
export function parsePeriodParam(value: unknown): Date | undefined {
  if (typeof value !== 'string' || value === '') return undefined
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00+07:00`) : new Date(value)
}

/** Đầu ngày giờ VN chứa `at` */
const vnDayStartOf = (at: Date) =>
  new Date(Math.floor((at.getTime() + VN_OFFSET_MS) / DAY_MS) * DAY_MS - VN_OFFSET_MS)

/**
 * Đưa [from, to) về trọn ngày giờ VN mà giữ đúng số ngày yêu cầu (`to` − `from`, làm tròn lên): khoảng kết thúc ở hết
 * ngày VN chứa mili giây trước `to` và lùi đúng chừng ấy ngày, để mọi cột (cảnh báo, MTTR, điện năng, trạng thái ngày,
 * chim về) mô tả cùng một khoảng và "30 ngày" là 30 ngày, không 31. `from` không trước `to` → 400; quá MAX_PERIOD_DAYS → 400.
 */
export function vnDayPeriod(from: Date, to: Date): { from: Date; to: Date; days: number } {
  if (from >= to) throw BadRequestError('`from` phải trước `to`')
  const days = Math.ceil((to.getTime() - from.getTime()) / DAY_MS)
  if (days > MAX_PERIOD_DAYS) throw BadRequestError(`Khoảng tối đa ${MAX_PERIOD_DAYS} ngày`)
  const end = new Date(vnDayStartOf(new Date(to.getTime() - 1)).getTime() + DAY_MS)
  return { from: new Date(end.getTime() - days * DAY_MS), to: end, days }
}
