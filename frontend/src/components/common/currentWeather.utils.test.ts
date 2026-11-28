import { describe, expect, it } from 'vitest'
import { describeWeather } from '@/components/common/currentWeather.utils'
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
