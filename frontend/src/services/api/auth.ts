import api from './client'
import type { ApiResponse, User } from '@/types'

export interface LoginResponse { accessToken: string; user: User }

export const authApi = {
  register: (input: { email: string; password: string; full_name: string; phone?: string }) =>
    api.post<ApiResponse<User>>('/auth/register', input),
  login: (input: { email: string; password: string }) =>
    api.post<ApiResponse<LoginResponse>>('/auth/login', input),
  logout: () => api.post<ApiResponse<{ message: string }>>('/auth/logout'),

  // AUTH-FR-009 — quên/đặt lại mật khẩu (Flow 11 bước 6-7)
  forgotPassword: (email: string) =>
    api.post<ApiResponse<{ message: string }>>('/auth/forgot-password', { email }),
  resetPassword: (input: { email: string; token: string; newPassword: string }) =>
    api.post<ApiResponse<{ message: string }>>('/auth/reset-password', input),

  // ALERT-FR-005/006 — kênh nhận thông báo + giờ im lặng
  updateNotificationPreferences: (prefs: Partial<User['notification_preferences']>) =>
    api.put<ApiResponse<User>>('/auth/notification-preferences', prefs),

  // AUTH-FR-012 — yêu cầu xoá tài khoản (Administrator xử lý trong ≤30 ngày)
  requestDeletion: () => api.post<ApiResponse<{ message: string }>>('/auth/delete-request'),
}
