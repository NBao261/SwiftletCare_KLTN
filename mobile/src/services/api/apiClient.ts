import axios, { type AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import * as SecureStore from 'expo-secure-store'
import { router } from 'expo-router'
import { API_BASE_URL, ENDPOINTS } from '@/constants/apiEndpoints'
import { clearLocalSession } from '@/services/session/localSession'
import { setSocketTokenRefresher } from '@/services/socket/socketClient'
import { useAuthStore } from '@/stores/authStore'
import { readApiError } from '@/utils/apiError.utils'

// ─── Cấu hình ────────────────────────────────────────────────────────────────

const REQUEST_TIMEOUT_MS = 15_000

// X-Client: mobile để backend trả refreshToken trong body (app không có cookie)
const DEFAULT_HEADERS = { 'Content-Type': 'application/json', 'X-Client': 'mobile' }

// Route xác thực: 401 ở đây là sai thông tin, không phải token hết hạn — không làm mới token.
// Logout không nằm đây: backend đòi access token còn hạn, nên phải làm mới rồi gửi lại thì mới thu hồi được refresh token
const ROUTES_WITHOUT_REFRESH: readonly string[] = [
  ENDPOINTS.AUTH_LOGIN,
  ENDPOINTS.AUTH_REFRESH,
  ENDPOINTS.AUTH_FORGOT_PASSWORD,
  ENDPOINTS.AUTH_RESET_PASSWORD,
]

// Axios dùng chung cho mọi API
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: DEFAULT_HEADERS,
})

// Riêng cho làm mới token: không gắn interceptor (tránh vòng lặp 401), vẫn có timeout để
// mạng chập chờn không giữ isRefreshing mãi và treo mọi request đang chờ
const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: DEFAULT_HEADERS,
})

// ─── Gắn token vào request ───────────────────────────────────────────────────

function toBearer(accessToken: string): string {
  return `Bearer ${accessToken}`
}

// Đọc token trong bộ nhớ (authStore), không đọc SecureStore mỗi request — Keystore/Keychain giải mã chậm
function attachAccessToken(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  const { accessToken } = useAuthStore.getState()
  // Request tự gắn token (đăng xuất role không dùng mobile ngay sau đăng nhập) thì giữ nguyên
  if (accessToken && !config.headers.Authorization) {
    config.headers.Authorization = toBearer(accessToken)
  }
  return config
}

apiClient.interceptors.request.use(attachAccessToken)

// ─── Làm mới token khi gặp 401 ───────────────────────────────────────────────

// Request đã thử lại sau khi làm mới token thì không thử lại lần nữa
type RetriableRequestConfig = InternalAxiosRequestConfig & { hasRetried?: boolean }

// Request chờ lần làm mới token đang chạy
interface PendingRequest {
  resolve: (accessToken: string) => void
  reject: (error: unknown) => void
}

let isRefreshing = false
let pendingRequests: PendingRequest[] = []

// Trả kết quả làm mới token cho các request đang chờ
function settlePendingRequests(error: unknown, accessToken: string | null): void {
  for (const pendingRequest of pendingRequests) {
    if (accessToken) pendingRequest.resolve(accessToken)
    else pendingRequest.reject(error)
  }
  pendingRequests = []
}

// Gửi lại request với token mới
function retryWithToken(request: RetriableRequestConfig, accessToken: string): Promise<AxiosResponse> {
  request.hasRetried = true
  request.headers.Authorization = toBearer(accessToken)
  return apiClient(request)
}

// Phiên hết hạn hẳn: xoá sạch phiên trên máy (realtime, cache, token) và về màn đăng nhập
async function endSession(): Promise<void> {
  await clearLocalSession()
  router.replace('/(auth)/login')
}

// Gọi POST /auth/refresh một lần; các request 401 trong lúc đó xếp hàng chờ chung kết quả
async function refreshAccessToken(): Promise<string> {
  if (isRefreshing) {
    return new Promise<string>((resolve, reject) => {
      pendingRequests.push({ resolve, reject })
    })
  }

  isRefreshing = true
  try {
    const refreshToken = await SecureStore.getItemAsync('refreshToken')
    const { data } = await refreshClient.post<{ data: { accessToken: string } }>(ENDPOINTS.AUTH_REFRESH, {
      refreshToken,
    })
    const newAccessToken = data.data.accessToken
    await useAuthStore.getState().setAccessToken(newAccessToken)
    settlePendingRequests(null, newAccessToken)
    return newAccessToken
  } catch (refreshError) {
    settlePendingRequests(refreshError, null)
    // Chỉ đăng xuất khi backend từ chối refresh token; mất mạng thì giữ phiên để thử lại sau
    if (readApiError(refreshError).status === 401) await endSession()
    throw refreshError
  } finally {
    isRefreshing = false
  }
}

// Xử lý lỗi của mọi request: mật khẩu tạm → màn đổi mật khẩu; 401 → làm mới token rồi gửi lại 1 lần
async function handleResponseError(error: AxiosError): Promise<AxiosResponse> {
  const request = error.config as RetriableRequestConfig | undefined

  // Đang giữ mật khẩu tạm: mọi API khác bị chặn cho tới khi đổi (AUTH-FR-005c)
  if (readApiError(error).code === 'PASSWORD_CHANGE_REQUIRED') {
    await useAuthStore.getState().updateUser({ must_change_password: true })
    router.replace({ pathname: '/(auth)/reset-password', params: { mode: 'temporary' } })
    throw error
  }

  const isUnauthorized = error.response?.status === 401
  const canRefresh = request && !request.hasRetried && !ROUTES_WITHOUT_REFRESH.includes(request.url ?? '')
  if (!isUnauthorized || !canRefresh) throw error

  // Request này mang token cũ nhưng một lần làm mới khác đã xong trước đó: gửi lại luôn, không làm mới lần nữa
  const { accessToken: currentAccessToken } = useAuthStore.getState()
  if (currentAccessToken && request.headers.Authorization !== toBearer(currentAccessToken)) {
    return retryWithToken(request, currentAccessToken)
  }

  const newAccessToken = await refreshAccessToken()
  return retryWithToken(request, newAccessToken)
}

apiClient.interceptors.response.use(response => response, handleResponseError)

// Socket bị từ chối vì token hết hạn cũng dùng chung lần làm mới này (các request đang chờ không bị gọi refresh hai lần)
setSocketTokenRefresher(refreshAccessToken)
