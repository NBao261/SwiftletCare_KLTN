import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import * as SecureStore from 'expo-secure-store'
import { router } from 'expo-router'
import { API_BASE_URL, ENDPOINTS } from '@/constants/apiEndpoints'
import { clearLocalSession } from '@/services/session/localSession'
import { useAuthStore } from '@/stores/authStore'
import { readApiError } from '@/utils/apiError.utils'

// Request đã thử lại sau khi làm mới token thì không thử lại lần nữa
type RetriableRequestConfig = InternalAxiosRequestConfig & { hasRetried?: boolean }

// Route xác thực: 401 ở đây là sai thông tin, không phải token hết hạn — không làm mới token
const ROUTES_WITHOUT_REFRESH: readonly string[] = [
  ENDPOINTS.AUTH_LOGIN,
  ENDPOINTS.AUTH_REFRESH,
  ENDPOINTS.AUTH_LOGOUT,
  ENDPOINTS.AUTH_FORGOT_PASSWORD,
  ENDPOINTS.AUTH_RESET_PASSWORD,
  ENDPOINTS.AUTH_OTP_SEND,
  ENDPOINTS.AUTH_OTP_VERIFY,
]

// Request chờ lần làm mới token đang chạy
interface PendingRequest {
  resolve: (accessToken: string) => void
  reject: (error: unknown) => void
}

// Axios dùng chung — X-Client: mobile để backend trả refreshToken trong body (app không có cookie)
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json', 'X-Client': 'mobile' },
})

// Gắn access token vào mọi request, trừ khi request đã tự gắn
apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const accessToken = await SecureStore.getItemAsync('accessToken')
  if (accessToken && config.headers && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

let isRefreshing = false
let pendingRequests: PendingRequest[] = []

// Trả kết quả làm mới token cho các request đang chờ
function settlePendingRequests(error: unknown, accessToken: string | null): void {
  pendingRequests.forEach(pendingRequest => {
    if (error || !accessToken) pendingRequest.reject(error)
    else pendingRequest.resolve(accessToken)
  })
  pendingRequests = []
}

// Phiên hết hạn hẳn: xoá sạch phiên trên máy (realtime, cache, token) và về màn đăng nhập
async function endSession(): Promise<void> {
  await clearLocalSession()
  router.replace('/(auth)/login')
}

// Gặp 401 thì làm mới token 1 lần (các request đồng thời chờ chung) rồi gửi lại
apiClient.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableRequestConfig

    // Đang giữ mật khẩu tạm: mọi API khác bị chặn cho tới khi đổi (AUTH-FR-005c)
    if (readApiError(error).code === 'PASSWORD_CHANGE_REQUIRED') {
      await useAuthStore.getState().updateUser({ must_change_password: true })
      router.replace({ pathname: '/(auth)/reset-password', params: { mode: 'temporary' } })
      return Promise.reject(error)
    }

    const isAuthRoute = ROUTES_WITHOUT_REFRESH.includes(originalRequest?.url ?? '')
    if (error.response?.status !== 401 || !originalRequest || originalRequest.hasRetried || isAuthRoute) {
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        pendingRequests.push({ resolve, reject })
      }).then(accessToken => {
        originalRequest.headers.Authorization = `Bearer ${accessToken}`
        return apiClient(originalRequest)
      })
    }

    isRefreshing = true
    originalRequest.hasRetried = true

    try {
      const refreshToken = await SecureStore.getItemAsync('refreshToken')
      const { data } = await axios.post<{ data: { accessToken: string } }>(
        `${API_BASE_URL}${ENDPOINTS.AUTH_REFRESH}`,
        { refreshToken },
        { headers: { 'X-Client': 'mobile' } },
      )
      const newAccessToken = data.data.accessToken
      await SecureStore.setItemAsync('accessToken', newAccessToken)
      settlePendingRequests(null, newAccessToken)
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
      return apiClient(originalRequest)
    } catch (refreshError) {
      settlePendingRequests(refreshError, null)
      // Chỉ đăng xuất khi backend từ chối refresh token; mất mạng thì giữ phiên để thử lại sau
      if (readApiError(refreshError).status === 401) await endSession()
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  },
)
