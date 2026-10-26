import { describe, it, expect } from 'vitest'
import { validateFarmLocation } from '@/validations/farm-owner/farm.validation'

describe('validateFarmLocation', () => {
  it('bắt buộc khi tạo, để trống được khi sửa', () => {
    expect(validateFarmLocation('', ' ', true)).toBe('farmForm.errorLocationRequired')
    expect(validateFarmLocation('', '', false)).toBeNull()
  })

  it('báo lỗi ô thiếu hoặc ngoài khoảng', () => {
    expect(validateFarmLocation('95', '106.7', true)).toBe('farmForm.errorLatitude')
    expect(validateFarmLocation('10.8', '', false)).toBe('farmForm.errorLongitude')
    expect(validateFarmLocation('10.8', '-200', false)).toBe('farmForm.errorLongitude')
    expect(validateFarmLocation('abc', '106.7', true)).toBe('farmForm.errorLatitude')
  })

  it('chấp nhận tọa độ hợp lệ, kể cả biên', () => {
    expect(validateFarmLocation('10.762622', '106.660172', true)).toBeNull()
    expect(validateFarmLocation('-90', '180', true)).toBeNull()
  })
})
