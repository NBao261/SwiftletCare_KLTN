import { describe, expect, it } from '@jest/globals'
import { formatElapsed, getIsoWeekNumber, getVietnamDate } from '@/utils/date.utils'

describe('getVietnamDate', () => {
  it('đổi sang ngày giờ Việt Nam', () => {
    expect(getVietnamDate(new Date('2026-10-29T18:00:00.000Z').getTime())).toBe('2026-10-30')
  })
})

describe('getIsoWeekNumber', () => {
  it('00:00 thứ Hai 19/10 giờ Việt Nam (17:00 Chủ nhật UTC) vẫn là tuần 43', () => {
    expect(getIsoWeekNumber('2026-10-18T17:00:00.000Z')).toBe(43)
  })
})

describe('formatElapsed', () => {
  it('chỉ lấy đơn vị lớn nhất', () => {
    expect(formatElapsed(25 * 1000)).toBe('25 giây')
    expect(formatElapsed(14 * 60 * 1000 + 30 * 1000)).toBe('14 phút')
    expect(formatElapsed(2 * 60 * 60 * 1000 + 5 * 60 * 1000)).toBe('2 giờ')
    expect(formatElapsed(26 * 60 * 60 * 1000)).toBe('1 ngày')
  })
})
