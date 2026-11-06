import { describe, expect, it } from 'vitest'
import { validateHealthLevels } from '@/validations/common/healthLevels.validation'

const DEFAULTS = { in_range_slight_pct: 90, in_range_clear_pct: 75, air_slight_h: 1, air_clear_h: 4, noise_slight: 1, noise_clear: 3 }

describe('validateHealthLevels (BR-28)', () => {
  it('mặc định hợp lệ', () => {
    expect(validateHealthLevels(DEFAULTS)).toEqual({})
  })

  it('ngoài khoảng, không phải số, tiếng ồn không nguyên', () => {
    expect(validateHealthLevels({ ...DEFAULTS, in_range_slight_pct: 49, air_clear_h: NaN, noise_slight: 1.5 }))
      .toEqual({ in_range_slight_pct: 'range', air_clear_h: 'number', noise_slight: 'integer' })
  })

  it('mức rõ không nhẹ hơn mức nhẹ: môi trường ngược chiều với không khí và tiếng ồn', () => {
    expect(validateHealthLevels({ ...DEFAULTS, in_range_clear_pct: 95 })).toEqual({ in_range_clear_pct: 'environmentOrder' })
    expect(validateHealthLevels({ ...DEFAULTS, air_clear_h: 0.5 })).toEqual({ air_clear_h: 'ascendingOrder' })
    expect(validateHealthLevels({ ...DEFAULTS, noise_slight: 4 })).toEqual({ noise_clear: 'ascendingOrder' })
  })

  it('bằng nhau thì hợp lệ', () => {
    expect(validateHealthLevels({ ...DEFAULTS, in_range_clear_pct: 90, air_clear_h: 1, noise_clear: 1 })).toEqual({})
  })
})
