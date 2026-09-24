import { assertValidVisitTime, isWithinVisitHours, nextVisitSlot } from '@/utils/visitTime.util'

/** Giờ VN (UTC+7) của 1 ngày cố định ở tương lai xa */
const vn = (hhmm: string, day = '2099-01-15') => new Date(`${day}T${hhmm}:00+07:00`)

describe('visit hours 7:00–18:00 (Asia/Ho_Chi_Minh)', () => {
  it('accepts both edges and rejects just outside them', () => {
    expect(isWithinVisitHours(vn('07:00'))).toBe(true)
    expect(isWithinVisitHours(vn('18:00'))).toBe(true)
    expect(isWithinVisitHours(vn('06:59'))).toBe(false)
    expect(isWithinVisitHours(vn('18:01'))).toBe(false)
  })

  it('validates a visit time: future, within hours, parseable', () => {
    expect(assertValidVisitTime(vn('09:30').toISOString()).getTime()).toBe(vn('09:30').getTime())
    expect(() => assertValidVisitTime(vn('20:00'))).toThrow('7:00–18:00')
    expect(() => assertValidVisitTime(new Date(Date.now() - 60_000))).toThrow('tương lai')
    expect(() => assertValidVisitTime('không phải ngày')).toThrow('không hợp lệ')
  })

  it('moves an out-of-hours moment to the next 07:00 VN, keeps an in-hours one', () => {
    expect(nextVisitSlot(vn('10:00'))).toEqual(vn('10:00'))
    expect(nextVisitSlot(vn('05:00'))).toEqual(vn('07:00'))
    expect(nextVisitSlot(vn('19:00'))).toEqual(vn('07:00', '2099-01-16'))
    expect(nextVisitSlot(vn('23:30'))).toEqual(vn('07:00', '2099-01-16'))
  })
})
