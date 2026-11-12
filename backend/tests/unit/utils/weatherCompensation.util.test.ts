import {
  assertValidWeatherRules, pickCompensation, summariseForecast, type WeatherRuleInput,
} from '@/utils/weatherCompensation.util'

const rule = (over: Partial<WeatherRuleInput> = {}): WeatherRuleInput =>
  ({ metric: 'temperature', min: 33, offset_pct: 5, duration_min: 120, active: true, ...over })

describe('assertValidWeatherRules (ENV-FR-030, BR-38)', () => {
  it('accepts offsets within ±10 and durations up to 2 h', () => {
    expect(() => assertValidWeatherRules([rule(), rule({ metric: 'rain', min: 0.5, offset_pct: -10, duration_min: 60 })])).not.toThrow()
  })

  it.each([
    ['offset above 10', rule({ offset_pct: 12 })],
    ['offset below -10', rule({ offset_pct: -11 })],
    ['offset 0', rule({ offset_pct: 0 })],
    ['duration above 2 h', rule({ duration_min: 180 })],
    ['duration 0', rule({ duration_min: 0 })],
    ['humidity above 100', rule({ metric: 'humidity', min: 120 })],
  ])('rejects %s with 400', (_label, bad) => {
    expect(() => assertValidWeatherRules([bad])).toThrow(expect.objectContaining({ statusCode: 400 }))
  })
})

describe('pickCompensation (BR-38)', () => {
  const forecast = { temperature_max: 34, humidity_max: 70, rain_mm: 0 }

  it('applies the rule whose condition holds on the forecast', () => {
    expect(pickCompensation([rule()], forecast)?.offset_pct).toBe(5)
  })

  it('takes the largest absolute offset when several rules hold', () => {
    const rules = [rule({ offset_pct: 4 }), rule({ metric: 'humidity', min: 60, offset_pct: -8 }), rule({ offset_pct: 6 })]
    expect(pickCompensation(rules, forecast)?.offset_pct).toBe(-8)
  })

  it('gives null without a forecast, below the condition, or with the rule off', () => {
    expect(pickCompensation([rule()], null)).toBeNull()
    expect(pickCompensation([rule({ min: 35 })], forecast)).toBeNull()
    expect(pickCompensation([rule({ active: false })], forecast)).toBeNull()
    expect(pickCompensation([rule({ metric: 'rain', min: 0.5 })], forecast)).toBeNull()
  })
})

describe('summariseForecast', () => {
  it('keeps only the hours in the next 2 h: max temperature and humidity, summed rain', () => {
    const hourly = {
      time: ['2026-11-12T03:00', '2026-11-12T04:00', '2026-11-12T05:00', '2026-11-12T06:00'],
      temperature_2m: [40, 33, 34.5, 39],
      relative_humidity_2m: [99, 80, null, 90],
      precipitation: [9, 0.4, 0.3, 9],
    }
    expect(summariseForecast(hourly, new Date('2026-11-12T03:20:00Z'))).toEqual({ temperature_max: 34.5, humidity_max: 80, rain_mm: 0.7 })
  })

  it('gives null when no hour of the window has a value', () => {
    expect(summariseForecast({ time: ['2026-11-12T10:00'], temperature_2m: [30] }, new Date('2026-11-12T03:00:00Z'))).toBeNull()
    expect(summariseForecast(undefined, new Date())).toBeNull()
  })
})
