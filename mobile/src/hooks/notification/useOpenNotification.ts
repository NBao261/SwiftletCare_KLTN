import { useCallback } from 'react'
import { router } from 'expo-router'
import { useMarkNotificationRead } from '@/hooks/notification/useMarkNotificationRead'
import type { InAppNotification } from '@/types'
import { RETURN_TO_NOTIFICATIONS } from '@/utils/navigation.utils'
import { getNotificationTarget } from '@/utils/notification.utils'

// Mở cảnh báo đúng cảnh báo đó ở tab Cảnh báo (sheet chi tiết mở sẵn), nút ‹ quay về chuông
export function openAlertFromBell(alertId: string) {
  router.navigate({ pathname: '/(tabs)/alerts', params: { alertId, returnTo: RETURN_TO_NOTIFICATIONS } })
}

// Bấm một thông báo: đánh dấu đã đọc (số giảm ngay) rồi mở đúng chỗ — cảnh báo ở tab Cảnh báo, báo cáo ở tab Phân tích, Work
// Order ở trang chi tiết Work Order, còn lại (quyết định của chuyên gia, lệnh từ xa trên thiết bị…) ở trang chi tiết thông báo
export function useOpenNotification() {
  const markRead = useMarkNotificationRead()
  const markNotificationRead = markRead.mutate

  return useCallback(
    (notification: InAppNotification) => {
      if (!notification.read_at) markNotificationRead(notification._id)
      const target = getNotificationTarget(notification)
      if (target.kind === 'alert') {
        openAlertFromBell(target.alertId)
        return
      }
      if (target.kind === 'report') {
        router.navigate({
          pathname: '/(tabs)/analytics',
          params: { tab: 'reports', reportId: target.reportId, returnTo: RETURN_TO_NOTIFICATIONS },
        })
        return
      }
      if (target.kind === 'workOrder') {
        router.push({ pathname: '/work-orders/[workOrderId]', params: { workOrderId: target.workOrderId } })
        return
      }
      router.push({ pathname: '/notifications/[notificationId]', params: { notificationId: target.notificationId } })
    },
    [markNotificationRead],
  )
}
