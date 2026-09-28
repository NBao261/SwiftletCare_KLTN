import type { TicketType, TicketStatus, TicketPriority } from '@/types'

/** Nhãn/tone hiển thị Ticket — dùng chung giữa TechnicianTicketsPage (list) và TechnicianTicketDetailPage */
export const TICKET_TYPE_LABEL: Record<TicketType, string> = {
  SENSOR_FAULT: 'Lỗi cảm biến', RS485_BUS_FAILURE: 'Lỗi bus RS485', ACTUATOR_FAILURE: 'Lỗi thiết bị chấp hành',
  NODE_OFFLINE: 'Thiết bị mất kết nối', EDGE_AI_DEGRADED: 'Camera AI suy giảm', POWER_OUTAGE: 'Mất điện',
  SPEAKER_FAILURE: 'Lỗi loa ru', PREDATOR_DETECTED: 'Phát hiện thiên địch',
  INSTALLATION: 'Yêu cầu lắp đặt mới', MAINTENANCE: 'Bảo trì định kỳ', OTHER: 'Khác',
}

export const STATUS_LABEL: Record<TicketStatus, string> = {
  NEW: 'Mới', IN_PROGRESS: 'Đang xử lý', AWAITING_FIELD_CONFIRMATION: 'Chờ xác nhận hiện trường', CLOSED: 'Đã đóng',
}

export const STATUS_TONE = { NEW: 'critical', IN_PROGRESS: 'warning', AWAITING_FIELD_CONFIRMATION: 'info', CLOSED: 'neutral' } as const

export const PRIORITY_TONE = { P1: 'critical', P2: 'warning', P3: 'neutral' } as const

/** Icon-box theo mức ưu tiên — 3/4 biến thể tông màu mục 2.7 (đỏ=CRITICAL, cam=vừa, xám=neutral). Dùng ở SlaCard + FarmRecentTickets (Admin) */
export const PRIORITY_ICON_CLASS: Record<TicketPriority, string> = {
  P1: 'bg-red-100 text-red-600',
  P2: 'bg-orange-100 text-orange-600',
  P3: 'bg-gray-100 text-graphite',
}
