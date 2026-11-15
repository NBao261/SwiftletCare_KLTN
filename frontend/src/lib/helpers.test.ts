import { describe, expect, it } from 'vitest'
import { formatRelativeTime, formatDuration, lastPage, newestFirstPage } from '@/lib/helpers'
import type { Alert } from '@/types'

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

describe('lastPage', () => {
  it('trang cuối còn dữ liệu, ít nhất là trang 1', () => {
    expect(lastPage(0, 10)).toBe(1)
    expect(lastPage(10, 10)).toBe(1)
    expect(lastPage(11, 10)).toBe(2)
    expect(lastPage(20, 10)).toBe(2)
  })
})

describe('newestFirstPage', () => {
  const alert = (id: string, at: string) => ({ _id: id, created_at: at }) as Alert
  const critical = [alert('c2', '2026-11-15T10:00:00Z'), alert('c1', '2026-11-15T07:00:00Z')]
  const high = [alert('h2', '2026-11-15T09:00:00Z'), alert('h1', '2026-11-15T08:00:00Z')]

  it('ghép 2 mức theo thời gian, mới nhất trước, rồi cắt đúng trang', () => {
    expect(newestFirstPage([critical, high], 1, 3).map(item => item._id)).toEqual(['c2', 'h2', 'h1'])
    expect(newestFirstPage([critical, high], 2, 3).map(item => item._id)).toEqual(['c1'])
  })
})
