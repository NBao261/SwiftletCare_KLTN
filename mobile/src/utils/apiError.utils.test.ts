import { describe, expect, it } from '@jest/globals'
import {
  formatWaitTime,
  getAuthErrorMessage,
  INVALID_CODE_MESSAGE,
  NETWORK_ERROR_MESSAGE,
  readApiError,
  SERVER_ERROR_MESSAGE,
} from '@/utils/apiError.utils'

// Lỗi axios giả theo đúng vỏ ApiError của backend
function backendError(status: number, code?: string, details?: Record<string, unknown>) {
  return { response: { status, data: { success: false, error: { code, message: 'x', details } } } }
}

describe('readApiError', () => {
  it('không có response nghĩa là chưa tới được backend', () => {
    expect(readApiError(new Error('Network Error'))).toEqual({ status: null, code: null, details: {} })
  })

  it('đọc status, code và details', () => {
    expect(readApiError(backendError(429, 'RATE_LIMITED', { retryAfterSec: 30 }))).toEqual({
      status: 429,
      code: 'RATE_LIMITED',
      details: { retryAfterSec: 30 },
    })
  })
})

describe('getAuthErrorMessage', () => {
  it('đăng nhập sai chỉ báo một câu chung', () => {
    expect(getAuthErrorMessage(backendError(401, 'UNAUTHORIZED'), 'login')).toBe('Tài khoản hoặc mật khẩu không chính xác')
  })

  it('tài khoản bị khoá kèm lý do; không có lý do thì hướng dẫn liên hệ quản trị viên', () => {
    const error = backendError(403, 'ACCOUNT_DISABLED', { reason: 'Vi phạm điều khoản' })
    expect(getAuthErrorMessage(error, 'login')).toBe('Tài khoản đã bị khoá. Lý do: Vi phạm điều khoản')
    expect(getAuthErrorMessage(backendError(403, 'ACCOUNT_DISABLED', { reason: null }), 'login')).toBe(
      'Tài khoản đã bị khoá. Vui lòng liên hệ quản trị viên',
    )
  })

  it('429 dùng thời gian chờ của backend, câu theo từng thao tác', () => {
    const error = backendError(429, 'RATE_LIMITED', { retryAfterSec: 45 })
    expect(getAuthErrorMessage(error, 'login')).toBe('Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau 45 giây')
    expect(getAuthErrorMessage(error, 'request-code')).toBe(
      'Bạn đã yêu cầu mã quá nhiều lần. Vui lòng thử lại sau 45 giây',
    )
    expect(getAuthErrorMessage(error, 'reset-password')).toBe(
      'Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau 45 giây',
    )
    expect(getAuthErrorMessage(backendError(429, 'RATE_LIMITED'), 'login')).toBe(
      'Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau ít phút',
    )
  })

  it('mã sai hoặc hết hạn chung một câu', () => {
    expect(getAuthErrorMessage(backendError(400, 'INVALID_RESET_TOKEN'), 'reset-password')).toBe(INVALID_CODE_MESSAGE)
  })

  it('đổi mật khẩu tạm: sai mật khẩu tạm, mật khẩu mới trùng cũ', () => {
    expect(getAuthErrorMessage(backendError(400, 'INVALID_CURRENT_PASSWORD'), 'change-password')).toBe(
      'Mật khẩu tạm không chính xác',
    )
    expect(getAuthErrorMessage(backendError(400, 'PASSWORD_UNCHANGED'), 'change-password')).toBe(
      'Mật khẩu mới phải khác mật khẩu tạm',
    )
  })

  it('mất mạng và lỗi máy chủ là hai câu khác nhau', () => {
    expect(getAuthErrorMessage(new Error('timeout'), 'login')).toBe(NETWORK_ERROR_MESSAGE)
    expect(getAuthErrorMessage(backendError(503), 'request-code')).toBe(SERVER_ERROR_MESSAGE)
  })

  it('dữ liệu không hợp lệ và lỗi không rõ', () => {
    expect(getAuthErrorMessage(backendError(422, 'VALIDATION_ERROR'), 'request-code')).toBe('Email không hợp lệ')
    expect(getAuthErrorMessage(backendError(422, 'VALIDATION_ERROR'), 'reset-password')).toBe(
      'Thông tin không hợp lệ. Vui lòng kiểm tra lại',
    )
    expect(getAuthErrorMessage(backendError(404, 'NOT_FOUND'), 'change-password')).toBe(
      'Đã có lỗi xảy ra. Vui lòng thử lại sau',
    )
  })
})

describe('formatWaitTime', () => {
  it('dưới 1 phút ghi giây, từ 1 phút làm tròn lên', () => {
    expect(formatWaitTime(45)).toBe('45 giây')
    expect(formatWaitTime(60)).toBe('1 phút')
    expect(formatWaitTime(601)).toBe('11 phút')
  })
})
