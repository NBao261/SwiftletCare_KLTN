import { describe, expect, it } from 'vitest'
import { validatePasswordChange } from '@/validations/common/passwordChange.validation'

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
