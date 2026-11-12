import { useQuery } from '@tanstack/react-query'
import { pushTokenApi } from '@/services/api/pushToken.api'
import { getDevicePushState } from '@/services/notification/pushNotification'
import { useAuthStore } from '@/stores/authStore'

// Trạng thái push của máy với tài khoản đang đăng nhập
export type PushTokenStatus = 'registered' | 'no-permission' | 'unsupported'

export const PUSH_TOKEN_KEY = ['push-token'] as const

// Đăng ký FCM device token của máy với backend (ALERT-FR-002): chạy sau khi đăng nhập (mỗi tài khoản một lần, gọi lại cùng
// token backend chỉ cập nhật thời điểm) và sau khi người dùng vừa cho phép thông báo. Chưa có quyền thì không hỏi, chỉ báo
// no-permission. Token không vào cache — chỉ trạng thái
export function usePushTokenStatus() {
  const userId = useAuthStore(state => state.user?._id ?? null)

  return useQuery({
    queryKey: [...PUSH_TOKEN_KEY, userId],
    queryFn: async (): Promise<PushTokenStatus> => {
      const state = await getDevicePushState()
      if (state.kind !== 'ready') return state.kind
      await pushTokenApi.register(state.payload)
      return 'registered'
    },
    enabled: Boolean(userId),
    // Token không đổi trong phiên; mở lại app (phiên mới) hoặc vừa cho phép thông báo thì gửi lại
    staleTime: Infinity,
    retry: 1,
  })
}
