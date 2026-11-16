/**
 * Report 3 §4.5 — khoảng của bảng so sánh nhà và điện năng ước tính: trọn ngày giờ VN, giữ đúng số ngày yêu cầu,
 * tối đa 366 ngày (ANALYTICS-FR-016, 017).
 */
import { MAX_PERIOD_DAYS, vnDayPeriod } from '@/utils/period.util'

const DAY = 86_400_000
const vn = (iso: string) => new Date(`${iso}+07:00`)

describe('vnDayPeriod', () => {
  it('30 ngày tính từ giữa ngày vẫn là 30 ngày trọn, kết thúc hết hôm nay (giờ VN)', () => {
    const to = vn('2026-11-16T10:00:00')
    const range = vnDayPeriod(new Date(to.getTime() - 30 * DAY), to)
    expect(range).toEqual({ from: vn('2026-10-18T00:00:00'), to: vn('2026-11-17T00:00:00'), days: 30 })
  })

  it('khoảng đã trọn ngày VN giữ nguyên', () => {
    expect(vnDayPeriod(vn('2026-11-01T00:00:00'), vn('2026-11-08T00:00:00')))
      .toEqual({ from: vn('2026-11-01T00:00:00'), to: vn('2026-11-08T00:00:00'), days: 7 })
  })

  it('khoảng lẻ giờ được làm tròn lên thành đủ ngày', () => {
    const range = vnDayPeriod(vn('2026-11-10T20:00:00'), vn('2026-11-12T09:00:00'))
    expect(range.days).toBe(2)
    expect(range.to).toEqual(vn('2026-11-13T00:00:00'))
  })

  it(`from không trước to, hoặc quá ${MAX_PERIOD_DAYS} ngày → 400`, () => {
    const to = vn('2026-11-16T10:00:00')
    expect(() => vnDayPeriod(to, to)).toThrow(expect.objectContaining({ statusCode: 400 }))
    expect(() => vnDayPeriod(new Date(to.getTime() - 367 * DAY), to)).toThrow(expect.objectContaining({ statusCode: 400 }))
    expect(vnDayPeriod(new Date(to.getTime() - MAX_PERIOD_DAYS * DAY), to).days).toBe(MAX_PERIOD_DAYS)
  })
})
