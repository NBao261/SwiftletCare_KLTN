import { BadRequestError } from '@/utils/appError.util'

/**
 * Khung giờ hẹn đến hiện trường (TICKET-FR-004b): 7:00–18:00 giờ Việt Nam, áp cho
 * mọi đường đặt `scheduled_visit_at` — Farm Owner tạo yêu cầu lắp đặt, Technician
 * hẹn/dời lịch, Admin can thiệp, lịch bảo trì định kỳ.
 */
export const VISIT_START_HOUR = 7
export const VISIT_END_HOUR = 18
/** Việt Nam cố định UTC+7, không có giờ mùa hè — không cần thư viện timezone */
const VN_OFFSET_MS = 7 * 3600_000
const HOUR_MS = 3600_000

/** Số phút tính từ 00:00 giờ VN của mốc này */
function vnMinutesOfDay(date: Date): number {
  const vn = new Date(date.getTime() + VN_OFFSET_MS)
  return vn.getUTCHours() * 60 + vn.getUTCMinutes()
}

export function isWithinVisitHours(date: Date): boolean {
  const minutes = vnMinutesOfDay(date)
  return minutes >= VISIT_START_HOUR * 60 && minutes <= VISIT_END_HOUR * 60
}

/** Parse + kiểm tra giờ hẹn: hợp lệ, ở tương lai, trong khung 7:00–18:00 giờ VN */
export function assertValidVisitTime(value: string | Date, now = Date.now()): Date {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw BadRequestError('Giờ hẹn không hợp lệ')
  if (date.getTime() <= now) throw BadRequestError('Giờ hẹn phải ở tương lai')
  if (!isWithinVisitHours(date)) {
    throw BadRequestError(`Giờ hẹn phải trong khung ${VISIT_START_HOUR}:00–${VISIT_END_HOUR}:00 (giờ Việt Nam)`)
  }
  return date
}

/** Giờ hẹn để hiển thị trong ghi chú/thông báo — luôn theo giờ VN, không theo múi giờ của server */
export function formatVisitTime(date: Date): string {
  return date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' })
}

/** Mốc nằm ngoài khung giờ → dời lên 07:00 giờ VN kế tiếp; trong khung thì giữ nguyên */
export function nextVisitSlot(date: Date): Date {
  if (isWithinVisitHours(date)) return date
  const vn = new Date(date.getTime() + VN_OFFSET_MS)
  const startOfVnDay = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()) - VN_OFFSET_MS
  const todayStart = startOfVnDay + VISIT_START_HOUR * HOUR_MS
  return new Date(date.getTime() < todayStart ? todayStart : todayStart + 24 * HOUR_MS)
}
