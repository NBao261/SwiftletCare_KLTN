import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PUSH_TOKEN_KEY, usePushTokenStatus } from '@/hooks/notification/usePushTokenStatus'
import { requestPushPermission } from '@/services/notification/pushNotification'

// Dòng "Nhận push trên máy này" ở tab Tài khoản (ALERT-FR-002): trạng thái đăng ký với máy chủ, và nút bật — chỉ xin quyền
// khi người dùng bấm; cho phép xong thì đăng ký token ngay
export function usePushRegistration() {
  const queryClient = useQueryClient()
  const status = usePushTokenStatus()

  const enable = useMutation({
    retry: false,
    mutationFn: requestPushPermission,
    onSuccess: isGranted => {
      if (isGranted) void queryClient.invalidateQueries({ queryKey: PUSH_TOKEN_KEY })
    },
  })

  return {
    status: status.data ?? null,
    isLoading: status.isLoading,
    isError: status.isError,
    retry: () => status.refetch(),
    enable,
  }
}
