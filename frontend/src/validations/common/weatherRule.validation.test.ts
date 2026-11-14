import { describe, it, expect } from 'vitest'
import { validateWeatherRule, isWeatherRuleValid } from '@/validations/common/weatherRule.validation'

describe('validateWeatherRule', () => {
  it('chấp nhận luật hợp lệ', () => {
    expect(validateWeatherRule({ metric: 'temperature', min: 35, offset_pct: 5, duration_min: 60 })).toEqual({})
  })

  it('báo lỗi khi thiếu metric', () => {
    const errors = validateWeatherRule({ min: 35, offset_pct: 5, duration_min: 60 })
    expect(errors.metric).toBeTruthy()
  })

  it('báo lỗi khi min ngoài khoảng', () => {
    const errors = validateWeatherRule({ metric: 'temperature', min: 60, offset_pct: 5, duration_min: 60 })
    expect(errors.min).toBeTruthy()
  })

  it('báo lỗi khi offset_pct = 0', () => {
    const errors = validateWeatherRule({ metric: 'rain', min: 5, offset_pct: 0, duration_min: 60 })
    expect(errors.offset_pct).toBeTruthy()
  })

  it('báo lỗi khi offset_pct ngoài −10…+10', () => {
    const errors = validateWeatherRule({ metric: 'humidity', min: 80, offset_pct: 15, duration_min: 60 })
    expect(errors.offset_pct).toBeTruthy()
  })

  it('báo lỗi khi duration_min là số thực', () => {
    const errors = validateWeatherRule({ metric: 'temperature', min: 35, offset_pct: 5, duration_min: 30.5 })
    expect(errors.duration_min).toBeTruthy()
  })

  it('báo lỗi khi duration_min ngoài 1…120', () => {
    const errors = validateWeatherRule({ metric: 'temperature', min: 35, offset_pct: 5, duration_min: 150 })
    expect(errors.duration_min).toBeTruthy()
  })

  it('báo lỗi khi duration_min = 0', () => {
    const errors = validateWeatherRule({ metric: 'temperature', min: 35, offset_pct: 5, duration_min: 0 })
    expect(errors.duration_min).toBeTruthy()
  })
})

describe('isWeatherRuleValid', () => {
  it('trả về true cho luật đầy đủ hợp lệ', () => {
    expect(isWeatherRuleValid({ metric: 'rain', min: 10, offset_pct: -5, duration_min: 120 })).toBe(true)
  })

  it('trả về false khi thiếu field', () => {
    expect(isWeatherRuleValid({ metric: 'rain', min: 10 })).toBe(false)
  })
})
