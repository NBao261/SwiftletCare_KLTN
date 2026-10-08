// Module TICKET (§5.9) — phiếu yêu cầu kỹ thuật và checklist nghiệm thu.

// Module TICKET (§5.9)
export type TicketType =
  | 'SENSOR_FAULT' | 'RS485_BUS_FAILURE' | 'ACTUATOR_FAILURE' | 'NODE_OFFLINE'
  | 'EDGE_AI_DEGRADED' | 'POWER_OUTAGE' | 'SPEAKER_FAILURE' | 'PREDATOR_DETECTED'
  | 'INSTALLATION' | 'MAINTENANCE' | 'OTHER'
export type TicketPriority = 'P1' | 'P2' | 'P3'
export type TicketStatus = 'NEW' | 'IN_PROGRESS' | 'AWAITING_FIELD_CONFIRMATION' | 'CLOSED'

// Module TICKET (§5.9, §8.2)
export interface TicketSatChecklist {
  modbus_addresses_ok: boolean
  camera_rtsp_ok: boolean
  lte_connection_ok: boolean
  relay_test_ok: boolean
}

export interface Ticket {
  _id: string; farm_id: string; zone_id?: string; alert_id?: string; created_by?: string
  type: TicketType; priority: TicketPriority; status: TicketStatus
  assigned_to?: string | { _id: string; full_name: string; email: string }
  /**
   * Lắp đặt/bảo trì có sẵn từ lúc tạo (TICKET-FR-004b); ticket sự cố có khi
   * Technician hẹn xuống hiện trường sau chẩn đoán từ xa (Flow 9 bước 6b)
   */
  scheduled_visit_at?: string
  sla_response_due_at?: string; sla_resolve_due_at?: string; is_sla_breached: boolean
  /** Vượt hạn tiếp nhận (SLA phản hồi) — tách khỏi is_sla_breached (hạn xử lý) */
  is_sla_response_breached?: boolean
  /** Lúc Technician tiếp nhận lần đầu */
  responded_at?: string
  /** Lúc giao cho Technician hiện tại */
  assigned_at?: string
  /** TICKET-FR-009 — Technician xin Admin can thiệp; KHÔNG đồng nghĩa vi phạm SLA */
  escalated_at?: string; escalation_reason?: string
  /** TICKET-FR-017 — Technician từng phụ trách (chuyển đi tại `until`) */
  previous_assignees?: Array<{ user_id: string; until: string }>
  last_message_at?: string
  sat_checklist: TicketSatChecklist
  notes: Array<{ author_id?: string; content: string; created_at: string }>
  satisfaction_rating?: number
  created_at: string; closed_at?: string
  /** Có khi ticket bị huỷ — status cũng là CLOSED và closed_at cũng được set */
  cancelled_at?: string
}

/**
 * Tin nhắn chat trong ticket — shape `TicketMessageDto` của BE (ticketChat.service.ts), dùng chung cho
 * REST (GET/POST /tickets/:id/messages) và socket (TICKET_MESSAGE_NEW). Tin hệ thống (VD: bàn giao
 * Technician) có `is_system=true`, `author_id`/`author_name` = null, `role`='SYSTEM'.
 */
export interface TicketChatMessage {
  _id: string
  ticket_id: string
  content: string
  author_id: string | null
  author_name: string | null
  role: 'ADMIN' | 'FARM_OWNER' | 'TECHNICIAN' | 'SALES_STAFF' | 'SYSTEM'
  is_system: boolean
  client_message_id: string | null
  created_at: string
}
