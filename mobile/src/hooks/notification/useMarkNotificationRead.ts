import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationApi } from '@/services/api/notification.api'

// Đánh dấu một thông báo đã đọc, xong thì tải lại các danh sách thông báo (số chưa đọc, báo cáo mới)
export function useMarkNotificationRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (notificationId: string) => notificationApi.markRead(notificationId).then(() => undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
}
