import { mockNotificationChannels, mockResponse } from '@/services/mock/account.mock'
import type { AlertType, NotificationChannelPreferences, NotificationChannelSetting } from '@/types'

// Kênh nhận theo từng loại sự kiện (ALERT-FR-005).
// TODO(ALERT-FR-005): backend chỉ có kênh chung (PUT /auth/notification-preferences), chưa có theo loại — khi có trong
// api-spec, thêm vào ENDPOINTS và thay thân hai hàm bằng apiClient.get / apiClient.put
export const notificationChannelApi = {
  get: () => mockResponse<NotificationChannelPreferences>({ ...mockNotificationChannels }),

  update: (type: AlertType, setting: NotificationChannelSetting) => {
    mockNotificationChannels[type] = setting
    return mockResponse<NotificationChannelPreferences>({ ...mockNotificationChannels })
  },
}
