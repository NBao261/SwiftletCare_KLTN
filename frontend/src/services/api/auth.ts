import api from './client'
import type { ApiResponse, User } from '@/types'

export interface LoginResponse { accessToken: string; user: User }

export const authApi = {
  register: (input: { email: string; password: string; full_name: string; phone?: string }) =>
    api.post<ApiResponse<User>>('/auth/register', input),
  login: (input: { email: string; password: string }) =>
    api.post<ApiResponse<LoginResponse>>('/auth/login', input),
  logout: () => api.post<ApiResponse<{ message: string }>>('/auth/logout'),
}
