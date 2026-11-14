import api from '@/lib/axios'
import type { ApiResponse, Alert, SiteCause } from '@/types'

export const alertApi = {
  list: (params?: Record<string, string>) => api.get<ApiResponse<Alert[]>>('/alerts', { params }),
  getOne: (id: string) => api.get<ApiResponse<Alert>>(`/alerts/${id}`),
  // ALERT-FR-009, 018 — ghi chú và nguyên nhân tại chỗ đều tuỳ chọn
  acknowledge: (id: string, note?: string, cause?: SiteCause) =>
    api.put<ApiResponse<Alert>>(`/alerts/${id}/acknowledge`, { note, cause }),
}
