import type { ApiError } from '@/types'

// Thông tin rút từ lỗi axios: không có status nghĩa là chưa tới được backend (mất mạng, hết thời gian chờ)
export interface ApiErrorInfo {
  status: number | null
  code: string | null
  details: Record<string, unknown>
}

// Thao tác xác thực đang chạy — cùng một mã lỗi nhưng câu báo khác nhau theo màn
export type AuthAction = 'login' | 'request-code' | 'reset-password' | 'change-password'

export const NETWORK_ERROR_MESSAGE = 'Không kết nối được máy chủ, thử lại sau'

// Đọc theo cấu trúc thay vì import axios, để hàm thuần và test được không cần mạng
export function readApiError(error: unknown): ApiErrorInfo {
  const response = (error as { response?: { status?: number; data?: Partial<ApiError> } } | null)?.response
  if (!response?.status) return { status: null, code: null, details: {} }
  return {
    status: response.status,
    code: response.data?.error?.code ?? null,
    details: response.data?.error?.details ?? {},
  }
}

// Thời gian chờ đọc được: dưới 1 phút ghi giây, từ 1 phút làm tròn lên theo phút
export function formatWaitTime(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.ceil(seconds))} giây`
  return `${Math.ceil(seconds / 60)} phút`
}

// Số giây phải chờ khi backend trả 429 RATE_LIMITED; không đọc được thì null
export function getRetryAfterSeconds(errorInfo: ApiErrorInfo): number | null {
  const retryAfterSeconds = errorInfo.details.retryAfterSec
  return typeof retryAfterSeconds === 'number' ? retryAfterSeconds : null
}

// Câu báo lỗi tiếng Việt cho từng thao tác xác thực — không lộ email nào có tài khoản
export function getAuthErrorMessage(error: unknown, action: AuthAction): string {
  const errorInfo = readApiError(error)
  if (errorInfo.status === null || errorInfo.status >= 500) return NETWORK_ERROR_MESSAGE

  if (errorInfo.status === 429) {
    const retryAfterSeconds = getRetryAfterSeconds(errorInfo)
    const waitText = retryAfterSeconds === null ? 'ít phút' : formatWaitTime(retryAfterSeconds)
    if (action === 'request-code') return `Bạn yêu cầu mã quá nhiều lần. Thử lại sau ${waitText}`
    if (action === 'reset-password') return `Bạn nhập sai quá nhiều lần. Thử lại sau ${waitText}`
    return `Bạn thử sai quá nhiều lần. Thử lại sau ${waitText}`
  }

  if (errorInfo.code === 'ACCOUNT_DISABLED') {
    const reason = errorInfo.details.reason
    return typeof reason === 'string' && reason ? `Tài khoản đã bị khoá. Lý do: ${reason}` : 'Tài khoản đã bị khoá'
  }
  if (errorInfo.code === 'INVALID_RESET_TOKEN') {
    return 'Mã xác thực không đúng hoặc đã hết hạn. Vui lòng thử lại hoặc gửi lại mã'
  }
  if (errorInfo.code === 'INVALID_CURRENT_PASSWORD') return 'Mật khẩu tạm không đúng'
  if (errorInfo.code === 'PASSWORD_UNCHANGED') return 'Mật khẩu mới phải khác mật khẩu tạm'

  // Sai email hay sai mật khẩu đều chung một câu (AUTH-FR-002)
  if (action === 'login' && errorInfo.status === 401) return 'Sai tài khoản hoặc mật khẩu'
  if (errorInfo.status === 422) return action === 'request-code' ? 'Email không hợp lệ' : 'Thông tin chưa hợp lệ'
  return 'Có lỗi xảy ra, thử lại sau'
}
