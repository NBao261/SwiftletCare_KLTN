import axios from 'axios'
import { useAuthStore } from '@/store/authStore'
import { redirectToLogin } from '@/utils/navigation'
import { queryClient } from '@/services/queryClient'

// Dev: vite.config.ts proxy '/api' -> http://localhost:3000 (bỏ prefix /api trước
// khi forward) — tránh CORS hoàn toàn vì trình duyệt coi đây là same-origin.
// Production: set VITE_API_URL trỏ thẳng origin backend thật (không có /api).
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
  withCredentials: true, // gửi/nhận cookie refreshToken (AUTH-FR-003)
})

// Gắn JWT vào mọi request
api.interceptors.request.use(config => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Refresh access token — dùng chung 1 promise cho mọi request 401 đồng thời,
// tránh bắn nhiều POST /auth/refresh cùng lúc (single-flight).
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
        queryClient.clear() // phiên hết hạn — dọn sạch cache cũ, tránh lộ dữ liệu sang phiên đăng nhập sau
        redirectToLogin(window.location.pathname + window.location.search)
      }
    }
    return Promise.reject(err)
  }
)

export default api
export { API_BASE_URL }
