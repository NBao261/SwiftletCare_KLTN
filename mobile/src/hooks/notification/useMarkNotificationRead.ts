import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateNotificationQueries } from '@/config/queryClient'
import { notificationApi } from '@/services/api/notification.api'
import {
  findNotificationInPages,
  markReadInPages,
  NOTIFICATION_LIST_KEY,
  NOTIFICATION_UNREAD_KEY,
  type NotificationPages,
} from '@/utils/notification.utils'

// Đánh dấu một thông báo đã đọc (PUT /notifications/{id}/read): chấm đỏ và số trên chuông giảm ngay, lỗi thì trả lại;
// xong tải lại số chưa đọc cho khớp server, danh sách đã đúng nên chỉ đánh dấu cũ
export function useMarkNotificationRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (notificationId: string) => notificationApi.markRead(notificationId),
    onMutate: async notificationId => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATION_UNREAD_KEY })
      const previousPages = queryClient.getQueryData<NotificationPages>(NOTIFICATION_LIST_KEY)
      const previousUnread = queryClient.getQueryData<number>(NOTIFICATION_UNREAD_KEY)
      const notification = findNotificationInPages(previousPages, notificationId)
      if (notification && !notification.read_at) {
        queryClient.setQueryData(NOTIFICATION_LIST_KEY, markReadInPages(previousPages, notificationId, new Date().toISOString()))
        queryClient.setQueryData<number>(NOTIFICATION_UNREAD_KEY, count =>
          count === undefined ? count : Math.max(0, count - 1),
        )
      }
      return { previousPages, previousUnread }
    },
    onError: (_error, _notificationId, context) => {
      if (context?.previousPages) queryClient.setQueryData(NOTIFICATION_LIST_KEY, context.previousPages)
      if (context?.previousUnread !== undefined) queryClient.setQueryData(NOTIFICATION_UNREAD_KEY, context.previousUnread)
    },
    onSettled: () => {
      void invalidateNotificationQueries(queryClient)
    },
  })
}
