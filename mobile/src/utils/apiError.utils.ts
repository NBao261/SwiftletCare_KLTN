import type { ApiError } from '@/types'
import { t } from '@/utils/i18n.utils'

// Thông tin rút từ lỗi axios: không có status nghĩa là chưa tới được backend (mất mạng, hết thời gian chờ)
export interface ApiErrorInfo {
  status: number | null
  code: string | null
  details: Record<string, unknown>
}

// Thao tác xác thực đang chạy — cùng một mã lỗi nhưng câu báo khác nhau theo màn
export type AuthAction = 'login' | 'request-code' | 'reset-password' | 'change-password'

// Chưa tới được backend (mất mạng, sai địa chỉ máy chủ, hết thời gian chờ)
export const NETWORK_ERROR_MESSAGE = 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại'
// Backend nhận request nhưng lỗi phía máy chủ (5xx)
export const SERVER_ERROR_MESSAGE = 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau'
export const INVALID_CODE_MESSAGE = 'Mã xác thực không đúng hoặc đã hết hạn. Vui lòng nhập lại hoặc gửi lại mã'

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
  if (seconds < 60) return t('{count} giây', { count: Math.max(1, Math.ceil(seconds)) })
  return t('{count} phút', { count: Math.ceil(seconds / 60) })
}

// Số giây phải chờ khi backend trả 429 RATE_LIMITED; không đọc được thì null
export function getRetryAfterSeconds(errorInfo: ApiErrorInfo): number | null {
  const retryAfterSeconds = errorInfo.details.retryAfterSec
  return typeof retryAfterSeconds === 'number' ? retryAfterSeconds : null
}

// Câu báo lỗi tiếng Việt cho từng thao tác xác thực — không lộ email nào có tài khoản
export function getAuthErrorMessage(error: unknown, action: AuthAction): string {
  const errorInfo = readApiError(error)
  if (errorInfo.status === null) return t(NETWORK_ERROR_MESSAGE)
  if (errorInfo.status >= 500) return t(SERVER_ERROR_MESSAGE)

  if (errorInfo.status === 429) {
    const retryAfterSeconds = getRetryAfterSeconds(errorInfo)
    const waitText = retryAfterSeconds === null ? t('ít phút') : formatWaitTime(retryAfterSeconds)
    // Gửi mã: backend đếm mọi lần yêu cầu; đăng nhập, đặt lại, đổi mật khẩu: chỉ đếm lần nhập sai
    if (action === 'request-code') return t('Bạn đã yêu cầu mã quá nhiều lần. Vui lòng thử lại sau {wait}', { wait: waitText })
    return t('Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau {wait}', { wait: waitText })
  }

  if (errorInfo.code === 'ACCOUNT_DISABLED') {
    const reason = errorInfo.details.reason
    return typeof reason === 'string' && reason
      ? t('Tài khoản đã bị khoá. Lý do: {reason}', { reason })
      : t('Tài khoản đã bị khoá. Vui lòng liên hệ quản trị viên')
  }
  if (errorInfo.code === 'INVALID_RESET_TOKEN') return t(INVALID_CODE_MESSAGE)
  if (errorInfo.code === 'INVALID_CURRENT_PASSWORD') return t('Mật khẩu tạm không chính xác')
  if (errorInfo.code === 'PASSWORD_UNCHANGED') return t('Mật khẩu mới phải khác mật khẩu tạm')

  // Sai email hay sai mật khẩu đều chung một câu (AUTH-FR-002)
  if (action === 'login' && errorInfo.status === 401) return t('Tài khoản hoặc mật khẩu không chính xác')
  if (errorInfo.status === 422) {
    return action === 'request-code' ? t('Email không hợp lệ') : t('Thông tin không hợp lệ. Vui lòng kiểm tra lại')
  }
  return t('Đã có lỗi xảy ra. Vui lòng thử lại sau')
}

// Câu báo lỗi khi lưu cài đặt farm, nhà, zone; overrides: câu riêng của thao tác theo mã HTTP (ví dụ 403 khi xoá farm)
export function getSettingsErrorMessage(error: unknown, overrides: Partial<Record<number, string>> = {}): string {
  const errorInfo = readApiError(error)
  if (errorInfo.status === null) return t(NETWORK_ERROR_MESSAGE)
  const override = overrides[errorInfo.status]
  if (override) return override
  if (errorInfo.status >= 500) return t(SERVER_ERROR_MESSAGE)
  if (errorInfo.status === 400 || errorInfo.status === 422) return t('Giá trị không hợp lệ. Vui lòng kiểm tra lại')
  if (errorInfo.status === 403) return t('Bạn không có quyền thực hiện thao tác này')
  if (errorInfo.status === 404) return t('Không tìm thấy, có thể đã bị xoá')
  return t('Đã có lỗi xảy ra. Vui lòng thử lại sau')
}

// Câu báo lỗi khi đăng ký thiết bị bằng mã trên nhãn (FARM-FR-003, Flow 1 case 3a)
export function getDeviceRegisterErrorMessage(error: unknown): string {
  return getSettingsErrorMessage(error, {
    400: t('Mã thiết bị hoặc mã kích hoạt không đúng'),
    409: t('Thiết bị đã thuộc trang trại khác hoặc đã được đăng ký'),
  })
}
