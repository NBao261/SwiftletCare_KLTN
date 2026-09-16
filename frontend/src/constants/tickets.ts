import type { TicketType, TicketStatus } from '@/types'

/** Nhãn/tone hiển thị Ticket — dùng chung giữa TicketsPage (list) và TicketDetailPage */
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
