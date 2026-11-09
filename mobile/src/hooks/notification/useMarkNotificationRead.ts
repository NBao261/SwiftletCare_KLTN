import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationApi } from '@/services/api/notification.api'

// Đánh dấu một thông báo trong app đã đọc (PUT /notifications/{id}/read); xong thì tải lại badge và thẻ báo cáo mới
export function useMarkNotificationRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (notificationId: string) => notificationApi.markRead(notificationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
}
