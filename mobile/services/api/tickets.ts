import api from './client'
import { ENDPOINTS } from '@/constants/api'
import type { Ticket, ApiResponse } from '@/types'

export const ticketApi = {
  list:   (params?: Record<string, string>) =>
    api.get<ApiResponse<Ticket[]>>(ENDPOINTS.TICKETS, { params }),
  getOne: (id: string) =>
    api.get<ApiResponse<Ticket>>(`${ENDPOINTS.TICKETS}/${id}`),
  addNote: (id: string, content: string) =>
    api.post(`${ENDPOINTS.TICKETS}/${id}/notes`, { content }),
  rate:   (id: string, satisfaction_rating: number) =>
    api.post(`${ENDPOINTS.TICKETS}/${id}/rating`, { satisfaction_rating }),
}
