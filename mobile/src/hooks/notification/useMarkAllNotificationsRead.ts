import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateNotificationQueries } from '@/config/queryClient'
import { notificationApi } from '@/services/api/notification.api'
import {
  markReadInPages,
  NOTIFICATION_LIST_KEY,
  NOTIFICATION_UNREAD_KEY,
  type NotificationPages,
} from '@/utils/notification.utils'

// Đánh dấu mọi thông báo đã đọc (PUT /notifications/read-all): số trên chuông về 0 ngay, lỗi thì trả lại; xong tải lại số
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATION_UNREAD_KEY })
      const previousPages = queryClient.getQueryData<NotificationPages>(NOTIFICATION_LIST_KEY)
      const previousUnread = queryClient.getQueryData<number>(NOTIFICATION_UNREAD_KEY)
      queryClient.setQueryData(NOTIFICATION_LIST_KEY, markReadInPages(previousPages, null, new Date().toISOString()))
      queryClient.setQueryData<number>(NOTIFICATION_UNREAD_KEY, count => (count === undefined ? count : 0))
      return { previousPages, previousUnread }
    },
    onError: (_error, _variables, context) => {
      if (context?.previousPages) queryClient.setQueryData(NOTIFICATION_LIST_KEY, context.previousPages)
      if (context?.previousUnread !== undefined) queryClient.setQueryData(NOTIFICATION_UNREAD_KEY, context.previousUnread)
    },
    onSettled: () => {
      void invalidateNotificationQueries(queryClient)
    },
  })
}
