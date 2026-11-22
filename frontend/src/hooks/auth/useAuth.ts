import { flushSync } from 'react-dom'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/apis/auth/auth.api'
import { useAuthStore } from '@/stores/authStore'
import { useLoginSplashStore } from '@/stores/loginSplashStore'
import { queryClient } from '@/lib/queryClient'
import { getRoleHomePath, canAccessPath } from '@/constants/roles'
import type { NotificationPreferencesInput } from '@/types'

// useAuth – login/logout/quên mật khẩu/thông báo/xoá tài khoản
export function useAuth() {
  const navigate = useNavigate()
  const setAuth = useAuthStore(s => s.setAuth)
  const clearAuth = useAuthStore(s => s.clearAuth)
  const updateUser = useAuthStore(s => s.updateUser)

  const login = useMutation({
    mutationFn: ({ returnTo: _returnTo, ...input }: { email: string; password: string; returnTo?: string }) => authApi.login(input),
    onSuccess: ({ data }, variables) => {
      setAuth(data.data.user, data.data.accessToken)
      // mật khẩu tạm Admin cấp: đổi trước, chưa vào trang nào khác
      if (data.data.user.must_change_password) {
        navigate('/change-password', { replace: true })
        return
      }
      const role = data.data.user.role
      // returnTo cũ mà role mới không vào được thì về trang nhà, tránh văng /403
      const target = variables.returnTo && canAccessPath(role, variables.returnTo)
        ? variables.returnTo
        : getRoleHomePath(role)
      // Màn chuyển cảnh đọc vị trí logo trước khi rời trang đăng nhập; trang trong tải phía dưới trong lúc chạy
      useLoginSplashStore.getState().start()
      navigate(target)
    },
  })

  const logout = useMutation({
    mutationFn: () => authApi.logout(),
    // onSettled: luôn dọn phía client dù API logout lỗi
    onSettled: () => {
      // flushSync gộp navigate() và clearAuth() vào 1 lần render, không thì ProtectedRoute ghi returnTo sai
      flushSync(() => {
        navigate('/login', { replace: true })
        clearAuth()
      })
      queryClient.clear() // xoá cache của phiên vừa đăng xuất: tránh user kế tiếp trên cùng máy thấy dữ liệu cũ
    },
  })

  // quên/đặt lại mật khẩu
  const forgotPassword = useMutation({
    mutationFn: (email: string) => authApi.forgotPassword(email),
  })
  const resetPassword = useMutation({
    mutationFn: (input: { email: string; token: string; newPassword: string }) => authApi.resetPassword(input),
  })

  // backend trả lại User đầy đủ, gộp thẳng vào authStore để UI phản hồi tức thì
  const updateNotificationPreferences = useMutation({
    mutationFn: (prefs: NotificationPreferencesInput) => authApi.updateNotificationPreferences(prefs),
    onSuccess: ({ data }) => updateUser(data.data),
  })

  // Đọc lại tài khoản từ server (GET /auth/me) thay vì tự đoán giá trị phía client
  const reloadUser = async () => updateUser((await authApi.me()).data.data)

  // gửi hoặc huỷ yêu cầu xoá, rồi đọc lại tài khoản
  const requestDeletion = useMutation({
    mutationFn: () => authApi.requestDeletion(),
    onSuccess: reloadUser,
  })
  const cancelDeletion = useMutation({
    mutationFn: () => authApi.cancelDeletion(),
    // API trả user không còn trường này; đặt null để form hiện lại nút gửi ngay cả khi updateUser chỉ gộp
    onSuccess: async () => { updateUser({ deletion_requested_at: null }); await reloadUser() },
  })

  // liên kết Telegram xảy ra ngoài web (người dùng bấm Start trong Telegram) nên kiểm lại bằng /auth/me
  const createTelegramLink = useMutation({ mutationFn: () => authApi.createTelegramLink().then(response => response.data.data) })
  const checkTelegramLink = useMutation({ mutationFn: reloadUser })
  const unlinkTelegram = useMutation({
    mutationFn: () => authApi.unlinkTelegram(),
    onSuccess: async () => { updateUser({ telegram_linked: false }); await reloadUser() },
  })

  // đổi mật khẩu tạm rồi vào trang chủ của role
  const changePassword = useMutation({
    mutationFn: (input: { current_password: string; new_password: string }) => authApi.changePassword(input),
    onSuccess: () => {
      updateUser({ must_change_password: false })
      navigate(getRoleHomePath(useAuthStore.getState().user?.role), { replace: true })
    },
  })

  return {
    login, logout, forgotPassword, resetPassword, changePassword, updateNotificationPreferences, requestDeletion,
    cancelDeletion, createTelegramLink, checkTelegramLink, unlinkTelegram,
  }
}
