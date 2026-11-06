import { useQuery } from '@tanstack/react-query'
import { IS_MOCK_API_ENABLED } from '@/constants/mockApi'
import { notificationChannelApi } from '@/services/api/notificationChannel.api'

// Kênh nhận theo từng loại cảnh báo (ALERT-FR-005) — đang là dữ liệu mẫu
export function useNotificationChannels() {
  return useQuery({
    queryKey: ['notification-channels'],
    queryFn: () => notificationChannelApi.get().then(response => response.data.data),
    enabled: IS_MOCK_API_ENABLED,
  })
}
