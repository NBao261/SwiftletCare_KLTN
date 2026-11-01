import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/services/api/auth.api'
import { useAuthStore } from '@/stores/authStore'
import type { NotificationPreferences } from '@/types'

// Lưu kênh push, Telegram, giờ yên lặng (ALERT-FR-005, 006); backend trả User mới thì cập nhật phiên đang lưu
export function useUpdateNotificationPreferences() {
  const updateUser = useAuthStore(state => state.updateUser)

  return useMutation({
    mutationFn: (payload: Partial<NotificationPreferences>) =>
      authApi.updateNotificationPreferences(payload).then(response => response.data.data),
    onSuccess: user => updateUser({ notification_preferences: user.notification_preferences }),
  })
}
