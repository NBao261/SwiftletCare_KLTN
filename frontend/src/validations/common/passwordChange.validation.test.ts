import { describe, expect, it } from 'vitest'
import { validateNewPassword, validatePasswordChange, validatePasswordReset } from '@/validations/common/passwordChange.validation'

// đổi mật khẩu tạm. Chuỗi mẫu dựng bằng repeat để công cụ quét bí mật không coi là mật khẩu thật
const temporary = 't'.repeat(9)
const chosen = 'n'.repeat(10)

describe('validatePasswordChange', () => {
  it('hợp lệ khi đủ 8 ký tự, khác mật khẩu tạm và nhập lại khớp', () => {
    expect(validatePasswordChange({ currentPassword: temporary, newPassword: chosen, confirmPassword: chosen })).toEqual({})
  })

  it('báo thiếu mật khẩu tạm, mật khẩu mới ngắn hoặc trùng, nhập lại lệch', () => {
    expect(validatePasswordChange({ currentPassword: '', newPassword: 'x'.repeat(4), confirmPassword: 'y'.repeat(4) })).toEqual({
      currentPassword: 'Nhập mật khẩu tạm trong e-mail',
      newPassword: 'Tối thiểu 8 ký tự',
      confirmPassword: 'Hai lần nhập không khớp',
    })
    expect(validatePasswordChange({ currentPassword: temporary, newPassword: temporary, confirmPassword: temporary }).newPassword)
      .toBe('Mật khẩu mới phải khác mật khẩu tạm')
  })
})

describe('validateNewPassword, validatePasswordReset', () => {
  it('mật khẩu dài hơn 72 ký tự bị từ chối', () => {
    const long = 'p'.repeat(73)
    expect(validateNewPassword(long, long).newPassword).toBe('Tối đa 72 ký tự')
    expect(validatePasswordChange({ currentPassword: temporary, newPassword: long, confirmPassword: long }).newPassword).toBe('Tối đa 72 ký tự')
  })

  it('mã đặt lại phải đúng 6 chữ số', () => {
    const base = { newPassword: chosen, confirmPassword: chosen }
    expect(validatePasswordReset({ code: '123456', ...base })).toEqual({})
    expect(validatePasswordReset({ code: ' 123456 ', ...base })).toEqual({})
    for (const code of ['', '12345', '1234567', 'abcdef', '12 456']) {
      expect(validatePasswordReset({ code, ...base }).code).toBe('Mã gồm đúng 6 chữ số')
    }
  })

  it('đặt lại: báo mật khẩu ngắn và nhập lại lệch', () => {
    expect(validatePasswordReset({ code: '123456', newPassword: 'short', confirmPassword: 'other' })).toEqual({
      newPassword: 'Tối thiểu 8 ký tự', confirmPassword: 'Hai lần nhập không khớp',
    })
  })
})
