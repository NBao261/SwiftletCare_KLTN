import { useQuery } from '@tanstack/react-query'
import { notificationApi } from '@/services/api/notification.api'

// Số thông báo chưa đọc cho badge chuông ở đầu Trang chủ — chỉ cần meta nên tải 1 dòng
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () =>
      notificationApi.list({ limit: '1' }).then(response => response.data.meta?.unreadCount ?? 0),
  })
}
