import { apiClient } from '@/services/api/apiClient'
import { ENDPOINTS } from '@/constants/apiEndpoints'
import type { ApiResponse, InAppNotification } from '@/types'

// API thông báo trong ứng dụng (EXPERT-FR-006/007)
export const notificationApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<ApiResponse<InAppNotification[]>>(ENDPOINTS.NOTIFICATIONS, { params }),

  markRead: (notificationId: string) =>
    apiClient.put<ApiResponse<InAppNotification>>(ENDPOINTS.NOTIFICATION_READ(notificationId)),
}
