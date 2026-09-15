import api from './client'
import type { ApiResponse, Alert } from '@/types'

// Backend controllers/alerts.ts hiện là stub (501) — xem backend/README.md.
// Client sẵn sàng theo đúng contract SRS để dùng ngay khi module ALERT được code.
export const alertApi = {
  list: (params?: Record<string, string>) => api.get<ApiResponse<Alert[]>>('/alerts', { params }),
  getOne: (id: string) => api.get<ApiResponse<Alert>>(`/alerts/${id}`),
  acknowledge: (id: string, note?: string) => api.put<ApiResponse<Alert>>(`/alerts/${id}/acknowledge`, { note }),
}
