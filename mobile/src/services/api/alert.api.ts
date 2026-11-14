import { apiClient } from '@/services/api/apiClient'
import { ENDPOINTS } from '@/constants/apiEndpoints'
import type { Alert, AlertEvidence, AlertVerdictResult, ApiResponse, OnsiteCheckAnswerInput, SiteCause } from '@/types'
import { buildPhotoPart } from '@/utils/workOrder.utils'

// API cảnh báo (ALERT-FR-*)
export const alertApi = {
  list: (params?: Record<string, string>) => apiClient.get<ApiResponse<Alert[]>>(ENDPOINTS.ALERTS, { params }),

  getDetail: (alertId: string) => apiClient.get<ApiResponse<Alert>>(ENDPOINTS.ALERT_DETAIL(alertId)),

  // Bằng chứng của cảnh báo suy luận (ALERT-FR-014); loại khác thì 400
  getEvidence: (alertId: string) => apiClient.get<ApiResponse<AlertEvidence>>(ENDPOINTS.ALERT_EVIDENCE(alertId)),

  // Farm Owner và Farm Technician ở nhà được giao; cảnh báo không còn ACTIVE thì 409 (ALERT-FR-009). cause: nguyên nhân tìm
  // thấy tại chỗ của cảnh báo thiết bị, không bắt buộc (ALERT-FR-018)
  acknowledge: (alertId: string, note?: string, cause?: SiteCause) =>
    apiClient.put<ApiResponse<Alert>>(ENDPOINTS.ALERT_ACKNOWLEDGE(alertId), { note, cause }),

  // Thợ của nhà trả lời yêu cầu kiểm tra tại chỗ (EXPERT-FR-021): có ảnh thì gửi multipart (field photo), không thì JSON;
  // không có yêu cầu hoặc đã trả lời thì 409
  answerOnsiteCheck: (alertId: string, { observation, note, photo }: OnsiteCheckAnswerInput) => {
    if (!photo) return apiClient.post<ApiResponse<Alert>>(ENDPOINTS.ALERT_ONSITE_CHECK(alertId), { observation, note })
    const form = new FormData()
    form.append('observation', observation)
    if (note) form.append('note', note)
    form.append('photo', buildPhotoPart(photo, 'onsite-check'))
    return apiClient.post<ApiResponse<Alert>>(ENDPOINTS.ALERT_ONSITE_CHECK(alertId), form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  // Phán quyết cảnh báo suy luận, chỉ Domain Expert; ghi đè được (EXPERT-FR-003)
  setVerdict: (alertId: string, result: AlertVerdictResult, note?: string) =>
    apiClient.put<ApiResponse<Alert>>(ENDPOINTS.ALERT_VERDICT(alertId), { result, note }),
}
