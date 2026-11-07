import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as Notifications from 'expo-notifications'
import { registerForPushNotifications } from '@/services/notification/pushNotification'

// Nhận push trên máy này (ALERT-FR-002): quyền thông báo đọc thật từ hệ điều hành; chỉ xin quyền khi người dùng bấm.
// Backend chưa có route nhận mã thiết bị (G-10, chưa có trong api-spec) nên mã KHÔNG gửi đi đâu và không ghi log — màn phải
// nói rõ máy chủ chưa gửi push. Có route thì thêm ENDPOINTS + services/api/pushToken.api.ts và gửi mã ở đây
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
      return token !== null
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['push-permission'] }),
  })

  return { isGranted: permission.data ?? false, isLoading: permission.isLoading, enable }
}
