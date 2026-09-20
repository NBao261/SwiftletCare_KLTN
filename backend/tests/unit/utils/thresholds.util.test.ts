import {
  DEFAULT_THRESHOLDS, THRESHOLD_KEYS, THRESHOLD_LIMITS, assertValidThresholds, pickThresholds,
} from '@/utils/thresholds.util'
import { Zone } from '@/models/houseZone.model'
import type { Thresholds } from '@/types'

describe('assertValidThresholds — sensor ranges', () => {
  // Mỗi khoá được thử tại 2 biên (hợp lệ) và ngay ngoài biên (bị từ chối), giữ các khoá còn lại hợp lệ
  const valid: Thresholds = { temp_min: 10, temp_max: 20, humidity_min: 40, humidity_max: 60, light_max: 1, nh3_max: 10, co2_max: 1000 }

  it.each(THRESHOLD_KEYS)('accepts %s exactly at both limits', key => {
    const { min, max } = THRESHOLD_LIMITS[key]
    for (const edge of [min, max]) {
      // min/max chỉ hợp lệ trong cặp khi phần còn lại của cặp không vi phạm thứ tự
      const candidate: Thresholds = { ...valid, temp_min: -40, temp_max: 125, humidity_min: 0, humidity_max: 100, [key]: edge }
      if (key === 'temp_min' && edge >= candidate.temp_max) continue
      if (key === 'temp_max' && edge <= candidate.temp_min) continue
      if (key === 'humidity_min' && edge >= candidate.humidity_max) continue
      if (key === 'humidity_max' && edge <= candidate.humidity_min) continue
      expect(() => assertValidThresholds(candidate)).not.toThrow()
    }
  })

  it.each([
    ['temp_max', 126], ['temp_min', -41], ['humidity_max', 101], ['humidity_min', -1],
    ['light_max', 200_001], ['nh3_max', 501], ['co2_max', 5001],
  ] as const)('rejects %s = %p (outside the sensor range)', (key, value) => {
    const candidate: Thresholds = { ...valid, ...(key === 'temp_min' ? { temp_max: 125 } : {}), ...(key === 'humidity_min' ? { humidity_max: 100 } : {}), [key]: value }
    expect(() => assertValidThresholds(candidate)).toThrow(/khoảng đo của cảm biến/)
  })

  it('names the key and the unit in the error', () => {
    expect(() => assertValidThresholds({ ...valid, humidity_max: 500 })).toThrow('humidity_max phải nằm trong khoảng 0–100 %')
    expect(() => assertValidThresholds({ ...valid, co2_max: 99_999 })).toThrow('co2_max phải nằm trong khoảng 0–5000 ppm')
  })

  it('rejects NaN and non-numeric values', () => {
    expect(() => assertValidThresholds({ ...valid, temp_max: NaN })).toThrow('temp_max phải là một số hợp lệ')
    expect(() => assertValidThresholds({ ...valid, nh3_max: 'abc' as never })).toThrow('nh3_max phải là một số hợp lệ')
    expect(() => assertValidThresholds({ ...valid, co2_max: Infinity })).toThrow('co2_max phải là một số hợp lệ')
  })

  it('still accepts numeric strings that Mongoose would cast on save', () => {
    expect(() => assertValidThresholds({ ...valid, temp_max: '30' as never })).not.toThrow()
  })

  it('keeps the system defaults inside the sensor ranges', () => {
    for (const key of THRESHOLD_KEYS) {
      const { min, max } = THRESHOLD_LIMITS[key]
      expect(DEFAULT_THRESHOLDS[key]).toBeGreaterThanOrEqual(min)
      expect(DEFAULT_THRESHOLDS[key]).toBeLessThanOrEqual(max)
    }
  })
})

describe('Zone schema defaults', () => {
  it('come from DEFAULT_THRESHOLDS so backend has a single source of truth', () => {
    const zone = new Zone({ house_id: '64b000000000000000000001', name: 'Z' })
    expect(zone.toObject().thresholds).toEqual(DEFAULT_THRESHOLDS)
  })
})

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
