import api from '@/lib/axios'
import type { ApiResponse, Ticket, TicketType, TicketStatus, TicketPriority, TicketSatChecklist } from '@/types'

export interface CreateTicketInput {
  farm_id: string
  zone_id?: string
  type: TicketType
  description?: string
  /** Bắt buộc khi type=INSTALLATION/MAINTENANCE (TICKET-FR-004b) */
  scheduled_visit_at?: string
  alert_id?: string
}

/**
 * TICKET-FR-005b — PUT /tickets/:id/admin-override. `reason` bắt buộc (được ghi
 * thành note "Admin can thiệp: ..." + audit log TICKET_ADMIN_OVERRIDE); các
 * trường còn lại tuỳ chọn, gửi trường nào sửa trường đó.
 */
export interface AdminOverrideInput {
  reason: string
  assigned_to?: string
  priority?: TicketPriority
  status?: TicketStatus
  /** ISO8601 */
  scheduled_visit_at?: string
  /**
   * Gán Technician không phụ trách khu vực của farm → backend 400 kèm gợi ý
   * "Gửi kèm force=true nếu vẫn muốn gán" — chỉ gửi true sau khi Admin xác nhận.
   */
  force?: boolean
}

export interface ListTicketsQuery {
  farmId?: string; status?: TicketStatus; priority?: 'P1' | 'P2' | 'P3'; assignedToMe?: boolean
  page?: number; limit?: number
}

/**
 * Module TICKET (§5.9). Bao gồm cả các hàm chỉ Technician/Admin dùng
 * (updateStatus/escalate/updateSatChecklist/kpi) để UI vai trò khác tái dùng
 * thẳng file này sau, không phải viết lại lớp gọi API.
 */
export const ticketApi = {
  create: (input: CreateTicketInput) => api.post<ApiResponse<Ticket>>('/tickets', input),
  list:   (query?: ListTicketsQuery) => api.get<ApiResponse<Ticket[]>>('/tickets', { params: query }),
  getOne: (id: string) => api.get<ApiResponse<Ticket>>(`/tickets/${id}`),

  // Farm Owner
  cancel:  (id: string, reason: string) => api.put<ApiResponse<Ticket>>(`/tickets/${id}/cancel`, { reason }),
  addNote: (id: string, content: string) => api.post<ApiResponse<Ticket>>(`/tickets/${id}/notes`, { content }),
  rate:    (id: string, satisfaction_rating: number) => api.post<ApiResponse<Ticket>>(`/tickets/${id}/rating`, { satisfaction_rating }),

  // Technician/Admin — để sẵn cho UI vai trò khác
  updateStatus:       (id: string, status: TicketStatus, note?: string) => api.put<ApiResponse<Ticket>>(`/tickets/${id}/status`, { status, note }),
  updateSatChecklist: (id: string, updates: Partial<TicketSatChecklist>) => api.put<ApiResponse<Ticket>>(`/tickets/${id}/sat-checklist`, updates),
  escalate:           (id: string, reason?: string) => api.post<ApiResponse<Ticket>>(`/tickets/${id}/escalate`, { reason }),
  /** Admin — quyền can thiệp thường trực, bất kể trạng thái/SLA (TICKET-FR-005b) */
  adminOverride:      (id: string, input: AdminOverrideInput) => api.put<ApiResponse<Ticket>>(`/tickets/${id}/admin-override`, input),
  kpi: () => api.get<ApiResponse<{
    byStatus: Array<{ _id: TicketStatus; count: number }>
    byTechnician: Array<{ _id: string; total: number; closed: number }>
    avgResolveHours: number | null
    slaComplianceRate: number | null
  }>>('/tickets/kpi'),

  // ── Technician endpoints (đón đầu PR #35) ──
  /** TICKET-FR-004b — đổi lịch hẹn. PR #35 yêu cầu reason bắt buộc. */
  updateScheduledDate: (id: string, scheduledVisitAt: string, reason: string) =>
    api.put<ApiResponse<Ticket>>(`/tickets/${id}/scheduled-date`, { scheduled_visit_at: scheduledVisitAt, reason }),

  /** Chat — GET /tickets/:id/messages, POST /tickets/:id/messages */
  listMessages: (id: string, page = 1) =>
    api.get<ApiResponse<Array<{ _id: string; author_id: string; author_name: string; role: string; content: string; is_system: boolean; created_at: string }>>>(`/tickets/${id}/messages`, { params: { page } }),
  sendMessage: (id: string, content: string, clientMessageId?: string) =>
    api.post<ApiResponse<{ _id: string }>>(`/tickets/${id}/messages`, { content, client_message_id: clientMessageId }),
}
