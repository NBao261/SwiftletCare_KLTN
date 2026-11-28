import { describe, expect, it } from 'vitest'
import { FACTORY_DEFAULT_THRESHOLDS } from '@/constants/thresholds'
import { hasMinMaxOrderError, validateThresholds, validateThresholdSource } from '@/validations/common/threshold.validation'

// nguồn của ngưỡng mặc định, cùng luật với route PUT /system/settings/default-thresholds
describe('validateThresholdSource', () => {
  it('nhận nguồn có mã mục REF-5', () => {
    expect(validateThresholdSource('TL-003 sách nuôi yến')).toBeUndefined()
    expect(validateThresholdSource('  MC-012 ')).toBeUndefined()
  })

  it('từ chối nguồn trống, thiếu mã REF-5 hoặc quá dài', () => {
    expect(validateThresholdSource('   ')).toBe('Cần ghi nguồn của ngưỡng')
    expect(validateThresholdSource('sách nuôi yến')).toMatch(/REF-5/)
    expect(validateThresholdSource('KD-12')).toMatch(/REF-5/)
    expect(validateThresholdSource('XTL-0034')).toMatch(/REF-5/)
    expect(validateThresholdSource(`TL-001 ${'x'.repeat(500)}`)).toMatch(/500/)
  })
})

describe('validateThresholds', () => {
  it('bộ ngưỡng mặc định hợp lệ', () => {
    expect(validateThresholds(FACTORY_DEFAULT_THRESHOLDS)).toEqual({})
  })

  it('tối thiểu vượt tối đa thì báo ở cả hai ô, kèm số của ô kia', () => {
    const errors = validateThresholds({ ...FACTORY_DEFAULT_THRESHOLDS, temp_min: 32, temp_max: 30 })
    expect(errors.temp_min).toBe('Phải nhỏ hơn mức tối đa (30 °C)')
    expect(errors.temp_max).toBe('Phải lớn hơn mức tối thiểu (32 °C)')
    expect(Object.keys(errors)).toEqual(['temp_min', 'temp_max'])
  })

  it('bằng nhau cũng là sai; độ ẩm tính theo %', () => {
    const errors = validateThresholds({ ...FACTORY_DEFAULT_THRESHOLDS, humidity_min: 90, humidity_max: 90 })
    expect(errors.humidity_min).toBe('Phải nhỏ hơn mức tối đa (90 %)')
    expect(errors.humidity_max).toBe('Phải lớn hơn mức tối thiểu (90 %)')
  })

  it('ô trống hoặc ngoài khoảng đo thì báo số cần nhập, không báo thứ tự', () => {
    const errors = validateThresholds({ ...FACTORY_DEFAULT_THRESHOLDS, temp_min: Number.NaN, humidity_max: 150 })
    expect(errors.temp_min).toBe('Chưa nhập hoặc không phải số')
    expect(errors.humidity_max).toBe('Nhập từ 0 đến 100 %')
    expect(errors.temp_max).toBeUndefined()
    expect(errors.humidity_min).toBeUndefined()
  })
})

describe('hasMinMaxOrderError', () => {
  it('chỉ đúng với ô thuộc cặp bị đảo và hai số đều hợp lệ', () => {
    const swapped = { ...FACTORY_DEFAULT_THRESHOLDS, temp_min: 32, temp_max: 30 }
    expect(hasMinMaxOrderError(swapped, 'temp_min')).toBe(true)
    expect(hasMinMaxOrderError(swapped, 'temp_max')).toBe(true)
    expect(hasMinMaxOrderError(swapped, 'humidity_min')).toBe(false)
    expect(hasMinMaxOrderError(swapped, 'co2_max')).toBe(false)
    expect(hasMinMaxOrderError({ ...swapped, temp_max: Number.NaN }, 'temp_min')).toBe(false)
  })
})
