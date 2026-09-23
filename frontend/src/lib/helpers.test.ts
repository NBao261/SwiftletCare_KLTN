import { describe, expect, it } from 'vitest'
import { formatRelativeTime } from '@/lib/helpers'

describe('formatRelativeTime', () => {
  const now = Date.parse('2026-09-22T12:00:00Z')
  it('picks the largest fitting unit', () => {
    expect(formatRelativeTime('2026-09-22T11:55:00Z', now)).toBe('5 phút trước')
    expect(formatRelativeTime('2026-09-22T09:00:00Z', now)).toBe('3 giờ trước')
  })
})
