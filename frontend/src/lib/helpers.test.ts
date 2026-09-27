import { describe, expect, it } from 'vitest'
import { formatRelativeTime, formatDuration } from '@/lib/helpers'

describe('formatRelativeTime', () => {
  const now = Date.parse('2026-09-22T12:00:00Z')
  it('picks the largest fitting unit', () => {
    expect(formatRelativeTime('2026-09-22T11:55:00Z', now)).toBe('5 phút trước')
    expect(formatRelativeTime('2026-09-22T09:00:00Z', now)).toBe('3 giờ trước')
  })
})

describe('formatDuration', () => {
  const MIN = 60_000
  it('chính xác tới phút, 2 đơn vị lớn nhất, bỏ dấu âm', () => {
    expect(formatDuration(30_000)).toBe('dưới 1 phút')
    expect(formatDuration(45 * MIN)).toBe('45 phút')
    expect(formatDuration(-(3 * 60 + 20) * MIN)).toBe('3 giờ 20 phút')
    expect(formatDuration(2 * 60 * MIN)).toBe('2 giờ')
    expect(formatDuration((28 * 60 + 59) * MIN)).toBe('1 ngày 4 giờ')
    expect(formatDuration(48 * 60 * MIN)).toBe('2 ngày')
  })
})
