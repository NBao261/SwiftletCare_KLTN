import { apiClient } from '@/services/api/apiClient'
import { ENDPOINTS } from '@/constants/apiEndpoints'
import type { Alert, ApiResponse } from '@/types'

// API cảnh báo (ALERT-FR-*)
export const alertApi = {
  list: (params?: Record<string, string>) => apiClient.get<ApiResponse<Alert[]>>(ENDPOINTS.ALERTS, { params }),

  getDetail: (alertId: string) => apiClient.get<ApiResponse<Alert>>(ENDPOINTS.ALERT_DETAIL(alertId)),

  acknowledge: (alertId: string, note?: string) => apiClient.put(ENDPOINTS.ALERT_ACKNOWLEDGE(alertId), { note }),
}
