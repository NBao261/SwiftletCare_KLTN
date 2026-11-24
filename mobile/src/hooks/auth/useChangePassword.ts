import { useMutation } from '@tanstack/react-query'
import * as SecureStore from 'expo-secure-store'
import { authApi } from '@/services/api/auth.api'
import { connectSocket } from '@/services/socket/socketClient'
import { useAuthStore } from '@/stores/authStore'

interface ChangePasswordInput {
  currentPassword: string
  newPassword: string
}

// Đổi mật khẩu khi đang đăng nhập — cách duy nhất bỏ mật khẩu tạm do Admin cấp (AUTH-FR-005c)
export function useChangePassword() {
  const updateUser = useAuthStore(state => state.updateUser)

  return useMutation({
    retry: false,
    mutationFn: async ({ currentPassword, newPassword }: ChangePasswordInput) => {
      // Gửi refresh token đang dùng để backend giữ phiên này, chỉ thu hồi các máy khác
      const refreshToken = await SecureStore.getItemAsync('refreshToken')
      return authApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        refreshToken: refreshToken ?? undefined,
      })
    },
    onSuccess: async () => {
      await updateUser({ must_change_password: false })
      connectSocket()
    },
  })
}
