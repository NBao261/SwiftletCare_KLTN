import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationApi } from '@/services/api/notification.api'

// Đánh dấu mọi thông báo của người dùng đã đọc (PUT /notifications/read-all); xong tải lại danh sách và badge chuông
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
}
