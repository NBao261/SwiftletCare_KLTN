import { DEFAULT_THRESHOLDS, assertValidThresholds, pickThresholds } from '@/utils/thresholds.util'

describe('assertValidThresholds', () => {
  it('accepts the system defaults', () => {
    expect(() => assertValidThresholds(DEFAULT_THRESHOLDS)).not.toThrow()
  })

  it('rejects temp_min >= temp_max', () => {
    expect(() => assertValidThresholds({ ...DEFAULT_THRESHOLDS, temp_min: 31, temp_max: 31 }))
      .toThrow('temp_min phải nhỏ hơn temp_max')
  })

  it('rejects humidity_min >= humidity_max', () => {
    expect(() => assertValidThresholds({ ...DEFAULT_THRESHOLDS, humidity_min: 96 }))
      .toThrow('humidity_min phải nhỏ hơn humidity_max')
  })

  it('rejects negative max thresholds', () => {
    expect(() => assertValidThresholds({ ...DEFAULT_THRESHOLDS, co2_max: -1 })).toThrow('không được âm')
  })
})

describe('pickThresholds', () => {
  it('keeps only known threshold keys and coerces to number', () => {
    expect(pickThresholds({ temp_max: '32', role: 'ADMIN', __proto__injected: 1 })).toEqual({ temp_max: 32 })
  })
})
