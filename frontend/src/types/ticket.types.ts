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
  /** Chỉ dùng cho type=INSTALLATION/MAINTENANCE (TICKET-FR-004b) */
  scheduled_visit_at?: string
  sla_response_due_at?: string; sla_resolve_due_at?: string; is_sla_breached: boolean
  sat_checklist: TicketSatChecklist
  notes: Array<{ author_id?: string; content: string; created_at: string }>
  satisfaction_rating?: number
  created_at: string; closed_at?: string
}
