import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { invalidateAlertQueries, invalidateNotificationQueries } from '@/config/queryClient'
import { onNotificationNew, onSocketReconnect, subscribeAlertNew } from '@/services/socket/socketClient'
import type { InAppNotification, SocketAlertNew } from '@/types'
import {
  affectsAlerts,
  affectsWorkOrders,
  ALERT_BADGE_KEY,
  createRecentIdSet,
  createTrailingRunner,
  findNotificationInPages,
  NOTIFICATION_LIST_KEY,
  NOTIFICATION_UNREAD_KEY,
  type NotificationPages,
  prependNotification,
} from '@/utils/notification.utils'

// Số id vừa nhận được nhớ để chống đếm trùng
const RECENT_ID_LIMIT = 50
// Gom các sự kiện đến dồn dập trong khoảng này thành một lần tải lại cảnh báo, Work Order
const ALERT_REFRESH_DELAY_MS = 400

// Realtime của chuông cho cả phiên đăng nhập:
// - thông báo mới (NOTIFICATION_NEW): ghi thẳng vào cache, +1 số chưa đọc, không gọi mạng; thông báo về quyết định của
//   chuyên gia thì tải lại cảnh báo vì chuyên gia bác bỏ là cảnh báo đổi sang DISMISSED mà backend không gửi sự kiện riêng
// - cảnh báo mới (ALERT_NEW): +1 số chưa xác nhận ngay, rồi gom lại để tải danh sách một lần
// - Work Order đổi phía server không có sự kiện riêng: thông báo Work Order/cảnh báo, ALERT_NEW và nối lại đều tải lại Work Order
//   (cảnh báo thiết bị mở Work Order tự động, job kiểm phục hồi chuyển chờ duyệt hoặc về "Đang làm")
// - socket nối lại: tải lại số và danh sách để bù tin lọt lúc mất mạng
export function useBellRealtime() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const recentNotificationIds = createRecentIdSet(RECENT_ID_LIMIT)
    const recentAlertIds = createRecentIdSet(RECENT_ID_LIMIT)
    const alertRefresh = createTrailingRunner(() => void invalidateAlertQueries(queryClient), ALERT_REFRESH_DELAY_MS)
    const workOrderRefresh = createTrailingRunner(
      () => void queryClient.invalidateQueries({ queryKey: ['work-orders'] }),
      ALERT_REFRESH_DELAY_MS,
    )

    const handleNotification = (notification: InAppNotification) => {
      if (recentNotificationIds.has(notification._id)) return
      recentNotificationIds.add(notification._id)
      const pages = queryClient.getQueryData<NotificationPages>(NOTIFICATION_LIST_KEY)
      if (!findNotificationInPages(pages, notification._id)) {
        // Cache chưa tải thì để nguyên: ghi vào cache trống sẽ chặn lần tải đầu
        queryClient.setQueryData<NotificationPages>(NOTIFICATION_LIST_KEY, current =>
          prependNotification(current, notification),
        )
        if (!notification.read_at) {
          queryClient.setQueryData<number>(NOTIFICATION_UNREAD_KEY, count => (count === undefined ? count : count + 1))
        }
        void invalidateNotificationQueries(queryClient, { keepUnreadCount: true })
      }
      if (affectsAlerts(notification)) alertRefresh.schedule()
      if (affectsWorkOrders(notification)) workOrderRefresh.schedule()
    }

    const handleAlert = (alert: SocketAlertNew) => {
      if (recentAlertIds.has(alert.alertId)) return
      recentAlertIds.add(alert.alertId)
      queryClient.setQueryData<number>(ALERT_BADGE_KEY, count => (count === undefined ? count : count + 1))
      alertRefresh.schedule()
      workOrderRefresh.schedule()
    }

    const handleReconnect = () => {
      recentNotificationIds.clear()
      recentAlertIds.clear()
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
      alertRefresh.schedule()
      workOrderRefresh.schedule()
    }

    const unsubscribes = [
      onNotificationNew(handleNotification),
      subscribeAlertNew(handleAlert),
      onSocketReconnect(handleReconnect),
    ]
    return () => {
      alertRefresh.cancel()
      workOrderRefresh.cancel()
      unsubscribes.forEach(unsubscribe => unsubscribe())
    }
  }, [queryClient])
}
