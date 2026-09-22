import api from '@/lib/axios'
import type { ApiResponse, Alert } from '@/types'

export const alertApi = {
  list: (params?: Record<string, string>) => api.get<ApiResponse<Alert[]>>('/alerts', { params }),
  getOne: (id: string) => api.get<ApiResponse<Alert>>(`/alerts/${id}`),
  acknowledge: (id: string, note?: string) => api.put<ApiResponse<Alert>>(`/alerts/${id}/acknowledge`, { note }),
}
