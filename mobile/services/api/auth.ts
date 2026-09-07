import api from './client'
import { ENDPOINTS } from '@/constants/api'
import type { LoginResponse, User, ApiResponse } from '@/types'

export const authApi = {
  login: (email: string, password: string) =>
    api.post<ApiResponse<LoginResponse>>(ENDPOINTS.AUTH_LOGIN, { email, password }),

  register: (data: { email: string; password: string; full_name: string; phone?: string }) =>
    api.post<ApiResponse<User>>(ENDPOINTS.AUTH_REGISTER, data),

  refresh: (refreshToken: string) =>
    api.post<ApiResponse<{ accessToken: string }>>(ENDPOINTS.AUTH_REFRESH, { refreshToken }),

  logout: () =>
    api.post(ENDPOINTS.AUTH_LOGOUT),

  sendOtp: (email: string) =>
    api.post(ENDPOINTS.AUTH_OTP_SEND, { email }),

  verifyOtp: (email: string, otp: string) =>
    api.post<ApiResponse<LoginResponse>>(ENDPOINTS.AUTH_OTP_VERIFY, { email, otp }),
}
