import api from '@/lib/axios'
import type { ApiResponse, LoginRequest, LoginResponse, NotificationPreferencesInput, User } from '@/types'

export const authApi = {
  login: (input: LoginRequest) =>
    api.post<ApiResponse<LoginResponse>>('/auth/login', input),
  logout: () => api.post<ApiResponse<{ message: string }>>('/auth/logout'),

  // quên/đặt lại mật khẩu
  forgotPassword: (email: string) =>
    api.post<ApiResponse<{ message: string }>>('/auth/forgot-password', { email }),
  resetPassword: (input: { email: string; token: string; newPassword: string }) =>
    api.post<ApiResponse<{ message: string }>>('/auth/reset-password', input),

  // kênh nhận thông báo + giờ im lặng
  updateNotificationPreferences: (prefs: NotificationPreferencesInput) =>
    api.put<ApiResponse<User>>('/auth/notification-preferences', prefs),

  // đổi mật khẩu khi đang đăng nhập; là cách duy nhất bỏ mật khẩu tạm Admin cấp
  changePassword: (input: { current_password: string; new_password: string }) =>
    api.put<ApiResponse<{ message: string }>>('/auth/password', input),

  // yêu cầu xoá tài khoản (Administrator xử lý trong ≤30 ngày); huỷ được khi chưa xử lý
  requestDeletion: () => api.post<ApiResponse<{ message: string }>>('/auth/delete-request'),
  cancelDeletion: () => api.delete<ApiResponse<{ message: string }>>('/auth/delete-request'),

  // Đọc lại tài khoản sau khi đổi ngoài màn hình (liên kết Telegram qua bot, gửi/huỷ yêu cầu xoá)
  me: () => api.get<ApiResponse<User>>('/auth/me'),

  // mã liên kết một lần (10 phút) mở bằng deep link; gỡ liên kết
  createTelegramLink: () => api.post<ApiResponse<{ deep_link: string; expires_at: string }>>('/auth/telegram/link'),
  unlinkTelegram: () => api.delete<ApiResponse<{ message: string }>>('/auth/telegram/link'),
}
