import { apiClient } from '@/services/api/apiClient'
import { ENDPOINTS } from '@/constants/apiEndpoints'
import type { ApiResponse } from '@/types'

// Máy đang đăng nhập: FCM device token (không nhận token Expo — backend trả 422) và hệ điều hành (api-spec PushTokenInput)
export interface PushTokenPayload {
  token: string
  platform: 'android' | 'ios'
}

// API FCM device token (ALERT-FR-002). Token không bao giờ được ghi log ở app lẫn backend
export const pushTokenApi = {
  register: (payload: PushTokenPayload) =>
    apiClient.post<ApiResponse<{ registered: boolean }>>(ENDPOINTS.PUSH_TOKENS, payload),

  // Gỡ token của chính người gọi; token không có vẫn 200 nên gọi lại lúc đăng xuất an toàn
  remove: (token: string) =>
    apiClient.delete<ApiResponse<{ registered: boolean }>>(ENDPOINTS.PUSH_TOKENS, { data: { token } }),
}
