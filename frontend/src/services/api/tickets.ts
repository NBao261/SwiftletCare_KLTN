import api from './client'
import type { ApiResponse, Ticket, TicketType, TicketStatus, TicketSatChecklist } from '@/types'

export interface CreateTicketInput {
  farm_id: string
  zone_id?: string
  type: TicketType
  description?: string
  /** Bắt buộc khi type=INSTALLATION/MAINTENANCE (TICKET-FR-004b) */
  scheduled_visit_at?: string
  alert_id?: string
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
  kpi: () => api.get<ApiResponse<{
    byStatus: Array<{ _id: TicketStatus; count: number }>
    byTechnician: Array<{ _id: string; total: number; closed: number }>
    avgResolveHours: number | null
    slaComplianceRate: number | null
  }>>('/tickets/kpi'),
}
