import { useNavigate } from 'react-router-dom'
import { useApiErrorMessage } from '@/hooks/common/useApiErrorMessage'
import { useTranslation } from '@/hooks/common/useTranslation'
import { useMarkNotificationRead } from '@/hooks/shared/useNotifications'
import { shellDict } from '@/constants/shell.i18n'
import { notificationTarget } from '@/constants/notificationTargets'
import { useAuthStore } from '@/stores/authStore'
import { useToastStore } from '@/stores/toastStore'
import type { AppNotification } from '@/types'

// Bấm một thông báo: đánh dấu đã đọc rồi mở trang liên quan; onNavigate chạy trước khi chuyển trang (VD đóng popup chuông)
export function useOpenNotification(onNavigate?: () => void): (notification: AppNotification) => void {
  const { t } = useTranslation(shellDict)
  const navigate = useNavigate()
  const role = useAuthStore(state => state.user?.role)
  const markRead = useMarkNotificationRead()
  const push = useToastStore(state => state.push)
  const apiErrorMessage = useApiErrorMessage()

  return notification => {
    if (!notification.read_at) {
      markRead.mutate(notification._id, { onError: error => push(apiErrorMessage(error, t('notif.markFailed')), 'error') })
    }
    const target = notificationTarget(notification, role)
    if (!target) return
    onNavigate?.()
    navigate(target.path, target.state ? { state: target.state } : undefined)
  }
}
