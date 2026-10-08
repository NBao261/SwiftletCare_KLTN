import type { TicketType } from '@/types'

/**
 * TICKET-FR-004b — loại tạo tay bắt buộc có ngày hẹn (backend cũng chặn). MAINTENANCE cũng cần
 * ngày hẹn nhưng chỉ sinh từ lịch bảo trì định kỳ, backend không cho tạo tay nên không có ở đây.
 */
export const SCHEDULED_TYPES: TicketType[] = ['INSTALLATION']

export interface NewTicketForm {
  farmId: string
  type: TicketType
  /** Giá trị "yyyy-MM-ddTHH:mm" — giờ máy người dùng */
  scheduledAt: string
}

export type NewTicketField = 'farmId' | 'scheduledAt'

/** Khung giờ hẹn hiện trường — khớp backend `utils/visitTime.util.ts` */
export const VISIT_START_HOUR = 7
export const VISIT_END_HOUR = 18
/** Việt Nam cố định UTC+7, không có giờ mùa hè */
const VN_OFFSET_MS = 7 * 3600_000

/** 07:00–18:00 giờ VN (tính cả 18:00), bất kể múi giờ của máy người dùng */
export function isWithinVisitHours(date: Date): boolean {
  const vn = new Date(date.getTime() + VN_OFFSET_MS)
  const minutes = vn.getUTCHours() * 60 + vn.getUTCMinutes()
  return minutes >= VISIT_START_HOUR * 60 && minutes <= VISIT_END_HOUR * 60
}

const PAST_SCHEDULE = 'Ngày hẹn đã qua — chọn thời điểm trong tương lai.'
const OUTSIDE_HOURS = `Giờ hẹn phải trong khung ${VISIT_START_HOUR}:00–${VISIT_END_HOUR}:00 (giờ Việt Nam).`

/** Lỗi của 1 mốc hẹn đã chọn (ở quá khứ / ngoài khung giờ) — cùng điều kiện backend `assertValidVisitTime` */
function visitTimeError(scheduledAt: string, now: number): string | undefined {
  const date = new Date(scheduledAt)
  if (date.getTime() <= now) return PAST_SCHEDULE
  if (!isWithinVisitHours(date)) return OUTSIDE_HOURS
  return undefined
}

/** Map lỗi theo field — rỗng nghĩa là hợp lệ. `now` truyền vào để test được. */
export function validateNewTicket(form: NewTicketForm, now = Date.now()): Partial<Record<NewTicketField, string>> {
  const errors: Partial<Record<NewTicketField, string>> = {}
  if (!form.farmId) errors.farmId = 'Chưa chọn trang trại — ticket luôn gắn với 1 farm.'
  if (SCHEDULED_TYPES.includes(form.type)) {
    const err = form.scheduledAt ? visitTimeError(form.scheduledAt, now) : 'Lắp đặt cần ngày giờ hẹn để phân lịch kỹ thuật viên.'
    if (err) errors.scheduledAt = err
  }
  return errors
}

/**
 * Đổi lịch hẹn (RescheduleModal, TICKET-FR-005b) — bắt buộc, ở tương lai và trong khung giờ VN.
 * Backend (adminOverrideTicket → assertValidVisitTime) cũng chặn; kiểm tra ở đây để báo lỗi
 * ngay dưới ô thay vì đợi toast 400 sau khi bấm Lưu.
 */
export function validateReschedule(scheduledAt: string, now = Date.now()): string | undefined {
  if (!scheduledAt) return 'Chưa chọn ngày giờ hẹn'
  return visitTimeError(scheduledAt, now)
}
