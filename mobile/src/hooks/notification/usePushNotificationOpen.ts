import { useEffect } from 'react'
import { router } from 'expo-router'
import { notificationsModule } from '@/services/notification/notificationsModule'
import { getPushTarget } from '@/utils/notification.utils'

// Mỗi thông báo đẩy chỉ mở một lần, kể cả khi màn gắn hook dựng lại (đổi tài khoản, mở lại tab)
const handledResponseIds = new Set<string>()

// Expo Go không có module push nên không bao giờ có thông báo được bấm
const useLastNotificationResponse = notificationsModule?.useLastNotificationResponse ?? (() => null)

// Bấm thông báo đẩy (ALERT-FR-002), lúc app đang chạy hoặc mở app từ thông báo: cảnh báo mở trang chi tiết của nó,
// báo cáo mở tab Phân tích › Báo cáo, Work Order mở trang chi tiết Work Order, ngày đánh giá mở health/[dayId], còn lại mở chuông. Gắn khi đã đăng nhập (RealtimeSync) để các tab đã sẵn sàng
export function usePushNotificationOpen() {
  const lastResponse = useLastNotificationResponse()

  useEffect(() => {
    if (!lastResponse || lastResponse.actionIdentifier !== notificationsModule?.DEFAULT_ACTION_IDENTIFIER) return
    const responseId = lastResponse.notification.request.identifier
    if (handledResponseIds.has(responseId)) return
    handledResponseIds.add(responseId)

    const target = getPushTarget(lastResponse.notification.request.content.data)
    if (target.kind === 'alert') {
      router.push({ pathname: '/alert/[alertId]', params: { alertId: target.alertId } })
    } else if (target.kind === 'report') {
      router.navigate({ pathname: '/(tabs)/analytics', params: { tab: 'reports', reportId: target.reportId } })
    } else if (target.kind === 'workOrder') {
      router.push({ pathname: '/work-orders/[workOrderId]', params: { workOrderId: target.workOrderId } })
    } else if (target.kind === 'healthDay') {
      router.push({ pathname: '/health/[dayId]', params: { dayId: target.dayId } })
    } else {
      router.push('/notifications')
    }
  }, [lastResponse])
}
