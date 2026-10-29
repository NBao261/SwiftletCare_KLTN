import { useMutation } from '@tanstack/react-query'
import { authApi, type ResetPasswordPayload } from '@/services/api/auth.api'

// Đặt mật khẩu mới bằng mã 6 số (AUTH-FR-009) — mã sai hoặc hết hạn đều trả 400 INVALID_RESET_TOKEN
export function useResetPassword() {
  return useMutation({
    retry: false,
    mutationFn: (payload: ResetPasswordPayload) =>
      authApi.resetPassword({ ...payload, email: payload.email.trim().toLowerCase() }),
  })
}
