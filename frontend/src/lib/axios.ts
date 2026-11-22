import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'
import { redirectToLogin, redirectToPasswordChange } from '@/lib/navigation'
import { queryClient } from '@/lib/queryClient'

// Dev: proxy '/api' tránh CORS. Production: VITE_API_URL trỏ thẳng backend
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
  withCredentials: true, // gửi/nhận cookie refreshToken
})

// Gắn JWT vào mọi request
api.interceptors.request.use(config => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Single-flight: mọi 401 đồng thời dùng chung 1 lần refresh
let refreshPromise: Promise<string> | null = null
function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true })
      .then(({ data }) => {
        const token = data.data.accessToken as string
        useAuthStore.getState().setAccessToken(token)
        return token
      })
      .finally(() => { refreshPromise = null })
  }
  return refreshPromise
}

// Tự refresh khi access token hết hạn
api.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config
    if (err.response?.status === 401 && err.response?.data?.error?.code === 'TOKEN_EXPIRED' && !original._retry) {
      original._retry = true
      try {
        const token = await refreshAccessToken()
        original.headers.Authorization = `Bearer ${token}`
        return api(original)
      } catch {
        useAuthStore.getState().clearAuth()
        queryClient.clear() // phiên hết hạn: dọn sạch cache cũ, tránh lộ dữ liệu sang phiên đăng nhập sau
        redirectToLogin(window.location.pathname + window.location.search)
      }
    }
    // tài khoản còn mật khẩu tạm: mọi route trừ đổi mật khẩu bị chặn, đưa về trang đổi
    if (err.response?.status === 403 && err.response?.data?.error?.code === 'PASSWORD_CHANGE_REQUIRED') {
      useAuthStore.getState().updateUser({ must_change_password: true })
      redirectToPasswordChange()
    }
    return Promise.reject(err)
  }
)

export default api
export { API_BASE_URL }
