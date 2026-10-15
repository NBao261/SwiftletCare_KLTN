import { describe, it, expect } from 'vitest'
import { validateFuzzyTuning } from '@/validations/common/fuzzyTuning.validation'
import { DEFAULT_FUZZY_TUNING } from '@/constants/thresholds'

describe('validateFuzzyTuning', () => {
  it('chấp nhận hệ số mặc định', () => {
    expect(validateFuzzyTuning(DEFAULT_FUZZY_TUNING)).toEqual({})
  })

  it('báo lỗi từng field ngoài khoảng, rỗng (NaN) và cửa sổ lẻ giây', () => {
    const errors = validateFuzzyTuning({
      fuzzy_humidity_band: 1, fuzzy_temp_band: NaN, fuzzy_fan_dry_level: 101, fuzzy_window_sec: 90.5,
    })
    expect(Object.keys(errors).sort()).toEqual(['fuzzy_fan_dry_level', 'fuzzy_humidity_band', 'fuzzy_temp_band', 'fuzzy_window_sec'])
    expect(errors.fuzzy_window_sec).toBe('Phải là số giây nguyên')
  })
})
