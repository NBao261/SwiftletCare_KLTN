import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as Notifications from 'expo-notifications'
import { pushTokenApi } from '@/services/api/pushToken.api'
import { registerForPushNotifications } from '@/services/notification/pushNotification'

// Nhận push trên máy này (ALERT-FR-002): quyền thông báo đọc thật từ hệ điều hành; chỉ xin quyền khi người dùng bấm.
// Bước gửi mã thiết bị lên máy chủ đang là bản mẫu (pushTokenApi) vì backend chưa có route (G-10); mã không được ghi log
export function usePushRegistration() {
  const queryClient = useQueryClient()

  const permission = useQuery({
    queryKey: ['push-permission'],
    queryFn: () => Notifications.getPermissionsAsync().then(result => result.granted),
  })

  const enable = useMutation({
    retry: false,
    mutationFn: async () => {
      const token = await registerForPushNotifications()
      if (!token) return false
      await pushTokenApi.register(token)
      return true
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['push-permission'] }),
  })

  return { isGranted: permission.data ?? false, isLoading: permission.isLoading, enable }
}
