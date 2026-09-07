import api from './client'
import { ENDPOINTS } from '@/constants/api'
import type { Alert, ApiResponse } from '@/types'

export const alertApi = {
  list:        (params?: Record<string, string>) =>
    api.get<ApiResponse<Alert[]>>(ENDPOINTS.ALERTS, { params }),
  getOne:      (id: string) =>
    api.get<ApiResponse<Alert>>(`${ENDPOINTS.ALERTS}/${id}`),
  acknowledge: (id: string, note?: string) =>
    api.put(ENDPOINTS.ALERT_ACK(id), { note }),
}
