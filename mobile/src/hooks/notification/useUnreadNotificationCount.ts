import { useQuery } from '@tanstack/react-query'
import { notificationApi } from '@/services/api/notification.api'
import { NOTIFICATION_UNREAD_KEY } from '@/utils/notification.utils'

// Số thông báo chưa đọc cho chuông — chỉ cần meta nên tải 1 dòng; socket và thao tác đọc cập nhật thẳng số này
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: NOTIFICATION_UNREAD_KEY,
    queryFn: () =>
      notificationApi.list({ limit: '1' }).then(response => response.data.meta?.unreadCount ?? 0),
  })
}
