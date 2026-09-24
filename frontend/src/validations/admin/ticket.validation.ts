import type { TicketType } from '@/types'

/** TICKET-FR-004b — 2 loại này bắt buộc có ngày hẹn (backend cũng chặn) */
export const SCHEDULED_TYPES: TicketType[] = ['INSTALLATION', 'MAINTENANCE']

export interface NewTicketForm {
  farmId: string
  type: TicketType
  /** Giá trị <input type="datetime-local"> — giờ máy người dùng */
  scheduledAt: string
}

export type NewTicketField = 'farmId' | 'scheduledAt'

/** Map lỗi theo field — rỗng nghĩa là hợp lệ. `now` truyền vào để test được. */
export function validateNewTicket(form: NewTicketForm, now = Date.now()): Partial<Record<NewTicketField, string>> {
  const errors: Partial<Record<NewTicketField, string>> = {}
  if (!form.farmId) errors.farmId = 'Chưa chọn trang trại — ticket luôn gắn với 1 farm.'
  if (SCHEDULED_TYPES.includes(form.type)) {
    if (!form.scheduledAt) errors.scheduledAt = 'Lắp đặt/bảo trì cần ngày giờ hẹn để phân lịch kỹ thuật viên.'
    else if (new Date(form.scheduledAt).getTime() < now) errors.scheduledAt = 'Ngày hẹn đã qua — chọn thời điểm trong tương lai.'
  }
  return errors
}
