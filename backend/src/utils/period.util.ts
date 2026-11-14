import { BadRequestError } from '@/utils/appError.util'

const DAY_MS = 86_400_000
const VN_OFFSET_MS = 7 * 3_600_000

/** Report 3 §4.5 — khoảng dài nhất của bảng so sánh nhà và điện năng ước tính: 1 năm, như một mùa vụ dài nhất */
export const MAX_PERIOD_DAYS = 366

/** Đầu ngày giờ VN chứa `at` */
const vnDayStartOf = (at: Date) =>
  new Date(Math.floor((at.getTime() + VN_OFFSET_MS) / DAY_MS) * DAY_MS - VN_OFFSET_MS)

/**
 * Làm tròn [from, to) ra trọn ngày giờ VN (từ đầu ngày của `from` tới hết ngày của mili giây trước `to`), để mọi cột
 * (cảnh báo, MTTR, điện năng, trạng thái ngày, chim về) mô tả cùng một khoảng ngày. `from` không trước `to` → 400;
 * quá MAX_PERIOD_DAYS → 400.
 */
export function vnDayPeriod(from: Date, to: Date): { from: Date; to: Date; days: number } {
  if (from >= to) throw BadRequestError('`from` phải trước `to`')
  const start = vnDayStartOf(from)
  const end = new Date(vnDayStartOf(new Date(to.getTime() - 1)).getTime() + DAY_MS)
  const days = Math.round((end.getTime() - start.getTime()) / DAY_MS)
  if (days > MAX_PERIOD_DAYS) throw BadRequestError(`Khoảng tối đa ${MAX_PERIOD_DAYS} ngày`)
  return { from: start, to: end, days }
}
