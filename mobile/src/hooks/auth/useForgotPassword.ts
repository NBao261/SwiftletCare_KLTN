import { useMutation } from '@tanstack/react-query'
import { authApi } from '@/services/api/auth.api'

// Gửi mã đặt lại mật khẩu về email (AUTH-FR-009) — backend luôn trả 200 để không lộ email nào có tài khoản
export function useForgotPassword() {
  return useMutation({
    // Không thử lại: mỗi lần gửi đều bị tính vào giới hạn 10 lần / 15 phút
    retry: false,
    mutationFn: (email: string) => authApi.forgotPassword(email.trim().toLowerCase()),
  })
}
