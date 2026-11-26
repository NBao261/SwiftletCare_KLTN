import { describe, expect, it } from 'vitest'

import { describeRegistrationFailure } from '@/components/features/farm-owner/onboarding/registrationFailure'

const failWith = (status: number, code?: string) => ({ response: { status, data: { error: { code } } } })

describe('lý do đăng ký thiết bị thất bại', () => {
  it('mỗi mã lỗi của backend có câu riêng', () => {
    const titles = ['INVALID_DEVICE_LABEL', 'DEVICE_REVOKED', 'DEVICE_ALREADY_REGISTERED', 'DEVICE_IN_OTHER_FARM', 'SETUP_LOCATION_NOT_ALLOWED']
      .map(code => describeRegistrationFailure(failWith(409, code)).title)
    expect(new Set(titles).size).toBe(5)
  })

  it('đã đăng ký trong farm này khác với đang thuộc farm khác', () => {
    expect(describeRegistrationFailure(failWith(409, 'DEVICE_ALREADY_REGISTERED')).detail).toContain('trang Thiết bị')
    expect(describeRegistrationFailure(failWith(409, 'DEVICE_IN_OTHER_FARM')).detail).toContain('Quản trị viên')
  })

  it('không có phản hồi thì báo mất kết nối, 5xx thì báo máy chủ, còn lại nói chưa biết lý do', () => {
    expect(describeRegistrationFailure(new Error('Network Error')).title).toBe('Không kết nối được máy chủ')
    expect(describeRegistrationFailure(failWith(503)).title).toBe('Máy chủ đang gặp sự cố')
    const unknown = describeRegistrationFailure(failWith(409, 'CONFLICT'))
    expect(unknown.title).toBe('Chưa đăng ký được thiết bị')
    expect(unknown.detail).toContain('không cho biết lý do')
  })
})
