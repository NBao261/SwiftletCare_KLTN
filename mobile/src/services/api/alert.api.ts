import { apiClient } from '@/services/api/apiClient'
import { ENDPOINTS } from '@/constants/apiEndpoints'
import type { Alert, AlertVerdictResult, ApiResponse } from '@/types'

// API cảnh báo (ALERT-FR-*)
export const alertApi = {
  list: (params?: Record<string, string>) => apiClient.get<ApiResponse<Alert[]>>(ENDPOINTS.ALERTS, { params }),

  getDetail: (alertId: string) => apiClient.get<ApiResponse<Alert>>(ENDPOINTS.ALERT_DETAIL(alertId)),

  // Chỉ Farm Owner; cảnh báo không còn ACTIVE thì 409 (ALERT-FR-009)
  acknowledge: (alertId: string, note?: string) =>
    apiClient.put<ApiResponse<Alert>>(ENDPOINTS.ALERT_ACKNOWLEDGE(alertId), { note }),

  // Phán quyết cảnh báo suy luận, chỉ Domain Expert; ghi đè được (EXPERT-FR-003)
  setVerdict: (alertId: string, result: AlertVerdictResult, note?: string) =>
    apiClient.put<ApiResponse<Alert>>(ENDPOINTS.ALERT_VERDICT(alertId), { result, note }),
}
