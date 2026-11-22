import { MAX_PERIOD_DAYS, isPeriodParam, parsePeriodParam, vnDayPeriod } from '@/utils/period.util'

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

describe('parsePeriodParam', () => {
  it('chỉ có ngày là đầu ngày giờ VN; có giờ thì đọc như ISO; rỗng hoặc không phải chuỗi thì undefined', () => {
    expect(parsePeriodParam('2026-11-01')).toEqual(new Date('2026-10-31T17:00:00.000Z'))
    expect(parsePeriodParam('2026-11-01T10:00:00Z')).toEqual(new Date('2026-11-01T10:00:00.000Z'))
    expect(parsePeriodParam('')).toBeUndefined()
    expect(parsePeriodParam(undefined)).toBeUndefined()
    expect(parsePeriodParam(['2026-11-01'])).toBeUndefined()
  })
})

describe('isPeriodParam', () => {
  it('nhận YYYY-MM-DD và ngày giờ có Z hoặc offset; từ chối năm, năm-tháng, ngày giờ không múi giờ và ngày sai', () => {
    for (const ok of ['2026-11-01', '2026-11-01T10:00:00Z', '2026-11-01T10:00+07:00', '2026-11-01T10:00:00.123-05:00']) {
      expect(isPeriodParam(ok)).toBe(true)
    }
    for (const bad of ['2026', '2026-11', '2026-11-01T10:00', '2026-13-45', '', 20261101, undefined]) {
      expect(isPeriodParam(bad)).toBe(false)
    }
  })
})
