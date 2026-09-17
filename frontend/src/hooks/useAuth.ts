import { flushSync } from 'react-dom'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import { queryClient } from '@/services/queryClient'
import { getRoleHomePath, canAccessPath } from '@/components/layout/navItems'
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
      const role = data.data.user.role
      // returnTo có thể "cũ" (VD phiên trước hết hạn trên 1 trang chỉ role
      // khác được xem) — nếu role vừa đăng nhập chắc chắn không vào được, bỏ
      // qua returnTo và về thẳng trang nhà, tránh vừa đăng nhập xong đã bị
      // văng sang /403 (trước đây phải tự bấm "Về trang chính" mới thoát được).
      const target = variables.returnTo && canAccessPath(role, variables.returnTo)
        ? variables.returnTo
        : getRoleHomePath(role)
      navigate(target)
    },
  })

  const register = useMutation({
    mutationFn: (input: { email: string; password: string; full_name: string; phone?: string }) =>
      authApi.register(input),
    onSuccess: () => navigate('/login'),
  })

  const logout = useMutation({
    mutationFn: () => authApi.logout(),
    // onSettled (không phải onSuccess) — luôn dọn sạch phía client dù API logout
    // lỗi/mất mạng, không để user kẹt lại trạng thái "đăng nhập" cục bộ.
    onSettled: () => {
      // flushSync gộp navigate() + clearAuth() vào ĐÚNG 1 lần render đồng bộ.
      // Không có flushSync: clearAuth() đổi isAuthenticated trước, khiến
      // ProtectedRoute (đang mount trên trang cũ, VD /dashboard) render lại và
      // tự tạo <Navigate to="/login?returnTo=/dashboard">; effect của Navigate
      // đó chạy SAU navigate('/login') thủ công ở đây nên ghi đè mất, để lại
      // returnTo trỏ về trang vừa rời đi. Lần đăng nhập kế tiếp (có thể là 1
      // tài khoản role khác) sẽ bị đưa nhầm về đúng URL đó rồi văng sang /403.
      // Gộp vào 1 flush: khi commit xong, route đã là /login nên ProtectedRoute
      // của path cũ bị unmount luôn, không còn cơ hội tạo returnTo sai nữa.
      flushSync(() => {
        navigate('/login', { replace: true })
        clearAuth()
      })
      queryClient.clear() // xoá cache của phiên vừa đăng xuất — tránh user kế tiếp trên cùng máy thấy dữ liệu cũ
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
