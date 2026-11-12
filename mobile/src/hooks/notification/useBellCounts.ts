import { useUnreadNotificationCount } from '@/hooks/notification/useUnreadNotificationCount'
import { useAlertStore } from '@/stores/alertStore'
import { useAuthStore } from '@/stores/authStore'
import { canPerform } from '@/utils/permission.utils'

export interface BellCounts {
  // Thông báo chưa đọc
  notificationCount: number
  // Cảnh báo chưa xác nhận (ACTIVE) — chỉ người xác nhận được cảnh báo mới đếm
  alertCount: number
  // Số trên chuông
  total: number
}

// Số của chuông: tổng thông báo chưa đọc và cảnh báo chưa xác nhận. Cảnh báo lấy từ alertStore (useSyncAlertBadge, cùng số
// với badge tab Cảnh báo); chuyên gia không xác nhận cảnh báo nên phần này là 0
export function useBellCounts(): BellCounts {
  const user = useAuthStore(state => state.user)
  const { data: notificationCount = 0 } = useUnreadNotificationCount()
  const unacknowledgedCount = useAlertStore(state => state.unreadCount)
  const alertCount = canPerform(user, 'acknowledgeAlert') ? unacknowledgedCount : 0

  return { notificationCount, alertCount, total: notificationCount + alertCount }
}
