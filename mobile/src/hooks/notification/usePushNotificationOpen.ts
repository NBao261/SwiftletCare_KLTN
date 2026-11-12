import { useEffect } from 'react'
import { router } from 'expo-router'
import * as Notifications from 'expo-notifications'
import { getPushTarget } from '@/utils/notification.utils'

// Mỗi thông báo đẩy chỉ mở một lần, kể cả khi màn gắn hook dựng lại (đổi tài khoản, mở lại tab)
const handledResponseIds = new Set<string>()

// Bấm thông báo đẩy (ALERT-FR-002), lúc app đang chạy hoặc mở app từ thông báo: cảnh báo mở đúng sheet chi tiết ở tab Cảnh báo,
// báo cáo mở tab Phân tích › Báo cáo, còn lại mở chuông. Gắn khi đã đăng nhập (RealtimeSync) để các tab đã sẵn sàng
export function usePushNotificationOpen() {
  const lastResponse = Notifications.useLastNotificationResponse()

  useEffect(() => {
    if (!lastResponse || lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return
    const responseId = lastResponse.notification.request.identifier
    if (handledResponseIds.has(responseId)) return
    handledResponseIds.add(responseId)

    const target = getPushTarget(lastResponse.notification.request.content.data)
    if (target.kind === 'alert') {
      router.navigate({ pathname: '/(tabs)/alerts', params: { alertId: target.alertId } })
    } else if (target.kind === 'report') {
      router.navigate({ pathname: '/(tabs)/analytics', params: { tab: 'reports', reportId: target.reportId } })
    } else {
      router.push('/notifications')
    }
  }, [lastResponse])
}
