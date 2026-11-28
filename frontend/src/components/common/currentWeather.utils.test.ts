import { describe, expect, it } from 'vitest'
import { describeWeather, rainfallText } from '@/components/common/currentWeather.utils'
import type { WeatherCondition } from '@/types'

describe('describeWeather', () => {
  it('quang ban ngày là nắng, ban đêm chỉ là trời quang', () => {
    expect(describeWeather({ condition: 'CLEAR', is_day: true })).toEqual({ label: 'Đang nắng', icon: 'sun', tone: 'sunny' })
    expect(describeWeather({ condition: 'CLEAR', is_day: false })).toEqual({ label: 'Trời quang', icon: 'moon', tone: 'neutral' })
  })

  it.each<[WeatherCondition, string]>([
    ['DRIZZLE', 'Đang mưa phùn'], ['RAIN', 'Đang mưa'], ['THUNDERSTORM', 'Đang mưa dông'],
  ])('%s là mưa', (condition, label) => {
    expect(describeWeather({ condition, is_day: true })).toMatchObject({ label, tone: 'rainy' })
  })

  it('trời nhiều mây, sương mù, lạ không bị coi là mưa hay nắng', () => {
    for (const condition of ['PARTLY_CLOUDY', 'CLOUDY', 'FOG', 'OTHER'] as WeatherCondition[]) {
      expect(describeWeather({ condition, is_day: true }).tone).toBe('neutral')
    }
    expect(describeWeather({ condition: 'OTHER', is_day: true }).label).toBe('Chưa rõ tình trạng trời')
  })
})

describe('rainfallText', () => {
  it('đang mưa và có lượng mưa thì hiện số mm', () => {
    expect(rainfallText({ is_raining: true, precipitation_mm: 0.7 })).toMatch(/0[.,]7 mm$/)
  })

  it('đang mưa mà lượng mưa là 0 hoặc chưa có thì không hiện', () => {
    expect(rainfallText({ is_raining: true, precipitation_mm: 0 })).toBeNull()
    expect(rainfallText({ is_raining: true, precipitation_mm: null })).toBeNull()
  })

  it('không mưa thì không hiện dù có lượng mưa', () => {
    expect(rainfallText({ is_raining: false, precipitation_mm: 1.2 })).toBeNull()
  })
})
