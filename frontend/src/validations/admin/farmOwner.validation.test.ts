import { describe, expect, it } from 'vitest'
import { validateFarmOwnerForm } from '@/validations/admin/farmOwner.validation'

// AUTH-FR-005c — form tạo Farm Owner
describe('validateFarmOwnerForm', () => {
  it('hợp lệ khi có email và họ tên, số điện thoại không bắt buộc', () => {
    expect(validateFarmOwnerForm({ email: ' chu@nhayen.vn ', fullName: 'Nguyễn Văn A', phone: '' })).toEqual({})
  })

  it('báo email sai và họ tên trống', () => {
    expect(validateFarmOwnerForm({ email: 'chu@nhayen', fullName: '   ', phone: '' })).toEqual({
      email: 'Email không hợp lệ',
      fullName: 'Cần nhập họ tên',
    })
  })
})
