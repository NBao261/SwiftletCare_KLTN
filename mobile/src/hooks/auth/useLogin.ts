import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/services/api/auth.api'
import { connectSocket } from '@/services/socket/socketClient'
import { useAuthStore } from '@/stores/authStore'
import { isMobileRole } from '@/constants/roleTabs'
import type { User } from '@/types'

interface LoginCredentials {
  email: string
  password: string
}

// Đăng nhập đúng nhưng role không dùng app mobile (Technician, Admin dùng bản web)
export class UnsupportedRoleError extends Error {
  constructor() {
    super('Tài khoản này chỉ dùng được trên bản web')
    this.name = 'UnsupportedRoleError'
  }
}

// Đăng nhập: chặn role không dùng mobile, lưu phiên vào SecureStore rồi mở kết nối realtime
export function useLogin() {
  const setAuth = useAuthStore(state => state.setAuth)

  return useMutation({
    // Không thử lại: mỗi lần sai đều bị backend tính vào giới hạn 10 lần / 15 phút
    retry: false,
    mutationFn: async ({ email, password }: LoginCredentials): Promise<User> => {
      const response = await authApi.login(email.trim().toLowerCase(), password)
      const { accessToken, refreshToken, user } = response.data.data
      if (!isMobileRole(user.role)) {
        // Thu hồi phiên vừa cấp; lỗi mạng ở đây không đổi kết quả cho người dùng
        await authApi.logout(refreshToken, accessToken).catch(() => undefined)
        throw new UnsupportedRoleError()
      }
      await setAuth(user, accessToken, refreshToken ?? '')
      return user
    },
    onSuccess: user => {
      // Mật khẩu tạm thì backend chặn mọi API khác — chờ đổi xong mới mở realtime
      if (!user.must_change_password) connectSocket()
    },
  })
}
