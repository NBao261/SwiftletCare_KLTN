import { describe, expect, it } from 'vitest'
import { validateFarmOwnerForm } from '@/validations/admin/farmOwner.validation'

// form tạo Farm Owner
describe('validateFarmOwnerForm', () => {
  it('hợp lệ khi có email và họ tên, số điện thoại không bắt buộc', () => {
    expect(validateFarmOwnerForm({ email: ' chu@nhayen.vn ', fullName: 'Nguyễn Văn A', phone: '' })).toEqual({})
  })

  it('báo họ tên quá dài và số điện thoại sai', () => {
    expect(validateFarmOwnerForm({ email: 'chu@nhayen.vn', fullName: 'a'.repeat(101), phone: 'abc' })).toEqual({
      fullName: 'Họ tên tối đa 100 ký tự',
      phone: 'Số điện thoại gồm 8–20 ký tự: số, khoảng trắng, + - ( )',
    })
    expect(validateFarmOwnerForm({ email: 'chu@nhayen.vn', fullName: 'A', phone: '+84 912 345 678' })).toEqual({})
  })

  it('báo email sai và họ tên trống', () => {
    expect(validateFarmOwnerForm({ email: 'chu@nhayen', fullName: '   ', phone: '' })).toEqual({
      email: 'Email không hợp lệ',
      fullName: 'Cần nhập họ tên',
    })
  })
})
