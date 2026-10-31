import { describe, expect, it } from '@jest/globals'
import { formatRemainingTime } from '@/utils/relay.utils'

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
