/**
 * Axios HTTP client with JWT auto-refresh interceptor
 * SRS: SEC-NFR-001, AUTH-FR-003
 */
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import * as SecureStore from 'expo-secure-store'
import { API_BASE_URL, ENDPOINTS } from '@/constants/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
})

// ── Request interceptor: attach access token ───────────────────────────────────
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await SecureStore.getItemAsync('accessToken')
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Response interceptor: auto-refresh on 401 ──────────────────────────────────
let isRefreshing = false
let failedQueue: Array<{ resolve: (v: unknown) => void; reject: (e: unknown) => void }> = []

const processQueue = (error: unknown, token: string | null = null): void => {
  failedQueue.forEach(prom => {
    if (error) prom.reject(error)
    else prom.resolve(token)
  })
  failedQueue = []
}

api.interceptors.response.use(
  response => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      }).then(token => {
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${token as string}`
        }
        return api(originalRequest)
      })
    }

    isRefreshing = true
    originalRequest._retry = true

    try {
      const refreshToken = await SecureStore.getItemAsync('refreshToken')
      const { data } = await axios.post(`${API_BASE_URL}${ENDPOINTS.AUTH_REFRESH}`, { refreshToken })
      const newToken = (data as { data: { accessToken: string } }).data.accessToken
      await SecureStore.setItemAsync('accessToken', newToken)
      processQueue(null, newToken)
      if (originalRequest.headers) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`
      }
      return api(originalRequest)
    } catch (refreshError) {
      processQueue(refreshError)
      // Token expired → force logout
      await SecureStore.deleteItemAsync('accessToken')
      await SecureStore.deleteItemAsync('refreshToken')
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  }
)

export default api
