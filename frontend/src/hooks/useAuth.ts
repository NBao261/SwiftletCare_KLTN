import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import type { User } from '@/types'

/** useAuth – login/register/logout/quên mật khẩu/thông báo/xoá tài khoản (AUTH-FR-001..003/009/012) */
export function useAuth() {
  const navigate = useNavigate()
  const setAuth = useAuthStore(s => s.setAuth)
  const clearAuth = useAuthStore(s => s.clearAuth)
  const updateUser = useAuthStore(s => s.updateUser)

  const login = useMutation({
    mutationFn: ({ returnTo: _returnTo, ...input }: { email: string; password: string; returnTo?: string }) => authApi.login(input),
    onSuccess: ({ data }, variables) => {
      setAuth(data.data.user, data.data.accessToken)
      navigate(variables.returnTo || '/dashboard')
    },
  })

  const register = useMutation({
    mutationFn: (input: { email: string; password: string; full_name: string; phone?: string }) =>
      authApi.register(input),
    onSuccess: () => navigate('/login'),
  })

  const logout = useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      clearAuth()
      navigate('/login')
    },
  })

  // AUTH-FR-009 — quên/đặt lại mật khẩu
  const forgotPassword = useMutation({
    mutationFn: (email: string) => authApi.forgotPassword(email),
  })
  const resetPassword = useMutation({
    mutationFn: (input: { email: string; token: string; newPassword: string }) => authApi.resetPassword(input),
  })

  // ALERT-FR-005/006 — backend trả lại User đầy đủ, gộp thẳng vào authStore để UI phản hồi tức thì
  const updateNotificationPreferences = useMutation({
    mutationFn: (prefs: Partial<User['notification_preferences']>) => authApi.updateNotificationPreferences(prefs),
    onSuccess: ({ data }) => updateUser(data.data),
  })

  // AUTH-FR-012 — API chỉ trả message, tự đánh dấu thời điểm gửi yêu cầu ở phía client
  const requestDeletion = useMutation({
    mutationFn: () => authApi.requestDeletion(),
    onSuccess: () => updateUser({ deletion_requested_at: new Date().toISOString() }),
  })

  return { login, register, logout, forgotPassword, resetPassword, updateNotificationPreferences, requestDeletion }
}
