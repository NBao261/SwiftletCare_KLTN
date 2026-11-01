import { apiClient } from '@/services/api/apiClient'
import { ENDPOINTS } from '@/constants/apiEndpoints'
import type { ApiResponse, LoginResponse, NotificationPreferences, User } from '@/types'

export interface ResetPasswordPayload {
  email: string
  // Mã 6 số gửi qua email từ /auth/forgot-password
  token: string
  newPassword: string
}

export interface ChangePasswordPayload {
  current_password: string
  new_password: string
  // Phiên cần giữ lại — backend thu hồi refresh token của mọi thiết bị khác
  refreshToken?: string
}

// API xác thực (AUTH-FR-002, 003, 005c, 009) — không có đăng ký công khai, không đăng nhập bằng OTP (Report 3 §1.2, §8)
export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post<ApiResponse<LoginResponse>>(ENDPOINTS.AUTH_LOGIN, { email, password }),

  // accessToken truyền tay khi phiên chưa được lưu (role không dùng mobile vừa đăng nhập)
  logout: (refreshToken?: string, accessToken?: string) =>
    apiClient.post(
      ENDPOINTS.AUTH_LOGOUT,
      { refreshToken },
      accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
    ),

  forgotPassword: (email: string) => apiClient.post(ENDPOINTS.AUTH_FORGOT_PASSWORD, { email }),

  resetPassword: (payload: ResetPasswordPayload) => apiClient.post(ENDPOINTS.AUTH_RESET_PASSWORD, payload),

  changePassword: (payload: ChangePasswordPayload) => apiClient.put(ENDPOINTS.AUTH_CHANGE_PASSWORD, payload),

  // Kênh push, Telegram và giờ yên lặng (ALERT-FR-005, 006); gửi trường nào sửa trường đó, trả User mới
  updateNotificationPreferences: (payload: Partial<NotificationPreferences>) =>
    apiClient.put<ApiResponse<User>>(ENDPOINTS.AUTH_NOTIFICATION_PREFERENCES, payload),

  // Mã liên kết bot Telegram dùng một lần, 10 phút (ALERT-FR-013); bot chưa cấu hình thì 503
  linkTelegram: () =>
    apiClient.post<ApiResponse<{ deep_link: string; expires_at: string }>>(ENDPOINTS.AUTH_TELEGRAM_LINK),

  unlinkTelegram: () => apiClient.delete(ENDPOINTS.AUTH_TELEGRAM_LINK),
}
