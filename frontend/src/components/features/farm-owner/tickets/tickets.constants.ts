import type { AlertType, TicketStatus, TicketType } from '@/types'

// Loại cảnh báo sang loại ticket, khớp backend
export const ALERT_TO_TICKET_TYPE: Partial<Record<AlertType, TicketType>> = {
  NODE_OFFLINE: 'NODE_OFFLINE',
  SENSOR_FAULT: 'SENSOR_FAULT',
  RS485_BUS_FAILURE: 'RS485_BUS_FAILURE',
  SPEAKER_FAILURE: 'SPEAKER_FAILURE',
  POWER_OUTAGE: 'POWER_OUTAGE',
  EDGE_AI_DEGRADED: 'EDGE_AI_DEGRADED',
  PUMP_DRY: 'OTHER',
}

// Loại báo sự cố Farm Owner tạo tay được
export const FAULT_TYPES: TicketType[] = [
  'SENSOR_FAULT', 'NODE_OFFLINE', 'RS485_BUS_FAILURE', 'ACTUATOR_FAILURE',
  'SPEAKER_FAILURE', 'POWER_OUTAGE', 'EDGE_AI_DEGRADED', 'OTHER',
]

export const DESCRIPTION_MAX = 1000

// Nhóm yêu cầu Farm Owner tạo được
export type SupportKind = 'fault' | 'install'

export const SUPPORT_PATH = '/support'
// Đường dẫn trang chi tiết yêu cầu
export const SUPPORT_DETAIL_PATH = '/support/chi-tiet'

// openChat: mở sẵn khung trao đổi khi vào trang (chọn "Trao đổi" trong menu thao tác của bảng)
export interface SupportDetailState { ticketId: string; openChat?: boolean }

// State mở trang yêu cầu với form tạo chọn sẵn
export interface SupportListState {
  create: { kind: SupportKind; farmId?: string; zoneId?: string }
}

export function supportCreateState(kind: SupportKind, target?: { farmId?: string; zoneId?: string }): SupportListState {
  return { create: { kind, farmId: target?.farmId, zoneId: target?.zoneId } }
}

// Ticket đã kết thúc (đóng hoặc huỷ — huỷ cũng chuyển trạng thái CLOSED) thì badge ưu tiên về xám
export function isTicketFinished(ticket: { status: TicketStatus }): boolean {
  return ticket.status === 'CLOSED'
}

// Ghi chú do backend tự sinh: đổi mốc ISO sang ngày giờ dễ đọc, bỏ mã yêu cầu SRS (VD "(TICKET-FR-002)")
export function readableNoteText(text: string, formatTimestamps: (value: string) => string): string {
  return formatTimestamps(text).replace(/\s*\((?:[A-Z]+-)+FR-\d+[a-z]?\)/g, '')
}

type TicketNote = { author_id?: string; content: string }
type TicketForNotes = { created_by?: string; assigned_to?: string | { _id: string }; notes: TicketNote[] }

// Mô tả người tạo nhập lúc tạo ticket: ghi chú đầu tiên do chính người tạo viết; ticket hệ thống tự sinh không có
export function ticketDescription(ticket: TicketForNotes): string | undefined {
  const firstNote = ticket.notes[0]
  if (!firstNote || !ticket.created_by || firstNote.author_id !== ticket.created_by) return undefined
  return firstNote.content
}

export type NoteAuthor = 'system' | 'you' | 'technician' | 'other'

// Ai viết ghi chú: không có author_id là hệ thống tự ghi (job SLA, gỡ thiết bị…)
export function noteAuthor(note: TicketNote, ticket: TicketForNotes, currentUserId?: string): NoteAuthor {
  if (!note.author_id) return 'system'
  if (note.author_id === currentUserId) return 'you'
  const technicianId = typeof ticket.assigned_to === 'object' ? ticket.assigned_to._id : ticket.assigned_to
  if (note.author_id === technicianId) return 'technician'
  return 'other'
}

// Câu mô tả tiến độ: ticket mới phân biệt chưa có kỹ thuật viên / hệ thống tự tạo / người dùng gửi
export function progressHintKey(ticket: {
  status: TicketStatus
  assigned_to?: unknown
  created_by?: string
  type: TicketType
  alert_id?: string
}): 'hint.NEW' | 'hint.NEW_SYSTEM' | 'hint.NEW_UNASSIGNED' | 'hint.IN_PROGRESS' | 'hint.AWAITING_FIELD_CONFIRMATION' | 'hint.CLOSED' {
  if (ticket.status !== 'NEW') return `hint.${ticket.status}`
  if (!ticket.assigned_to) return 'hint.NEW_UNASSIGNED'
  if (ticketOrigin(ticket) !== 'manual') return 'hint.NEW_SYSTEM'
  return 'hint.NEW'
}

export type TicketOrigin = 'schedule' | 'alert' | 'manual'

// Nguồn tạo ticket (dòng xám dưới tên loại): lịch bảo trì, hệ thống tự tạo từ cảnh báo, hoặc người dùng tạo tay
export function ticketOrigin(ticket: { type: TicketType; created_by?: string; alert_id?: string }): TicketOrigin {
  if (ticket.type === 'MAINTENANCE') return 'schedule'
  if (!ticket.created_by && ticket.alert_id) return 'alert'
  return 'manual'
}

export const PAGE_SIZE = 10
