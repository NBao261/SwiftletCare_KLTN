import { describe, expect, it } from '@jest/globals'
import {
  clampOverrideDuration,
  formatClockTime,
  formatDuration,
  formatRemainingTime,
  formatSpeakerWindows,
  getOverrideDurationLimits,
} from '@/utils/relay.utils'

const now = new Date('2026-10-30T10:00:00.000Z').getTime()

describe('formatRemainingTime', () => {
  it('dưới 1 giờ thì ghi số phút', () => {
    expect(formatRemainingTime('2026-10-30T10:18:30.000Z', now)).toBe('còn 18 phút')
  })

  it('từ 1 giờ thì ghi giờ và phút', () => {
    expect(formatRemainingTime('2026-10-30T12:05:00.000Z', now)).toBe('còn 2 giờ 5 phút')
    expect(formatRemainingTime('2026-10-30T12:00:00.000Z', now)).toBe('còn 2 giờ')
  })

  it('dưới 1 phút và đã hết hạn', () => {
    expect(formatRemainingTime('2026-10-30T10:00:40.000Z', now)).toBe('còn dưới 1 phút')
    expect(formatRemainingTime('2026-10-30T09:59:00.000Z', now)).toBeNull()
  })
})

describe('getOverrideDurationLimits', () => {
  it('bật bơm tối đa 30 phút, tắt bơm và quạt tối đa 24 giờ (BR-08)', () => {
    expect(getOverrideDurationLimits('misting', true)).toEqual({ minMs: 60_000, maxMs: 30 * 60_000 })
    expect(getOverrideDurationLimits('misting', false).maxMs).toBe(24 * 3_600_000)
    expect(getOverrideDurationLimits('ventilation', true).maxMs).toBe(24 * 3_600_000)
  })
})

describe('clampOverrideDuration', () => {
  it('kẹp vào khoảng cho phép', () => {
    const limits = getOverrideDurationLimits('misting', true)
    expect(clampOverrideDuration(3_600_000, limits)).toBe(30 * 60_000)
    expect(clampOverrideDuration(1000, limits)).toBe(60_000)
    expect(clampOverrideDuration(15 * 60_000, limits)).toBe(15 * 60_000)
  })
})

describe('formatDuration', () => {
  it('ghi phút, giờ, giờ và phút', () => {
    expect(formatDuration(5 * 60_000)).toBe('5 phút')
    expect(formatDuration(3_600_000)).toBe('1 giờ')
    expect(formatDuration(90 * 60_000)).toBe('1 giờ 30 phút')
  })
})

describe('formatClockTime', () => {
  it('đổi sang giờ Việt Nam', () => {
    expect(formatClockTime('2026-10-30T07:05:00.000Z')).toBe('14:05')
  })
})

describe('formatSpeakerWindows', () => {
  it('nối các khung giờ, tắt lịch thì null', () => {
    const windows = [
      { start: '05:00', end: '07:00' },
      { start: '17:00', end: '19:00' },
    ]
    expect(formatSpeakerWindows({ enabled: true, windows })).toBe('05:00–07:00 · 17:00–19:00')
    expect(formatSpeakerWindows({ enabled: false, windows })).toBeNull()
    expect(formatSpeakerWindows(undefined)).toBeNull()
  })
})
