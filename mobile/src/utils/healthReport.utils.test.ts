import { describe, expect, it } from '@jest/globals'
import { canEditConclusion, countDaysInclusive, formatReportPeriod, validateCustomReportRange } from '@/utils/healthReport.utils'

describe('formatReportPeriod', () => {
  it('tên kỳ theo loại báo cáo', () => {
    expect(formatReportPeriod({ kind: 'DAILY', period_start: '2026-11-05', period_end: '2026-11-05' })).toBe('05/11')
    expect(formatReportPeriod({ kind: 'WEEKLY', period_start: '2026-11-02', period_end: '2026-11-08' })).toBe(
      'Tuần 45 · 02/11 – 08/11',
    )
    expect(formatReportPeriod({ kind: 'MONTHLY', period_start: '2026-10-01', period_end: '2026-10-31' })).toBe('Tháng 10/2026')
    expect(formatReportPeriod({ kind: 'CUSTOM', period_start: '2026-11-01', period_end: '2026-11-10' })).toBe('01/11 – 10/11')
  })
})

describe('validateCustomReportRange', () => {
  const today = '2026-11-11'

  it('khoảng hợp lệ, tính cả hai đầu', () => {
    expect(countDaysInclusive('2026-11-01', '2026-11-01')).toBe(1)
    expect(countDaysInclusive('2026-10-12', '2026-11-11')).toBe(31)
    expect(validateCustomReportRange('2026-10-12', today, today)).toBeNull()
  })

  it('quá 31 ngày, đảo ngày, ngày cuối sau hôm nay', () => {
    expect(validateCustomReportRange('2026-10-11', today, today)).toBe('Báo cáo dài tối đa 31 ngày')
    expect(validateCustomReportRange('2026-11-05', '2026-11-04', today)).toBe('Ngày đầu phải trước hoặc bằng ngày cuối')
    expect(validateCustomReportRange('2026-11-05', '2026-11-12', today)).toBe('Ngày cuối không được sau hôm nay')
  })
})

describe('canEditConclusion', () => {
  const conclusion = { text: 'Ổn định', by: { _id: 'expert-a', full_name: 'Chuyên gia A' }, at: '2026-11-10T08:00:00Z' }

  it('chưa có kết luận thì chuyên gia nào cũng viết được', () => {
    expect(canEditConclusion(null, 'expert-b')).toBe(true)
    expect(canEditConclusion(undefined, 'expert-b')).toBe(true)
  })

  it('đã có kết luận thì chỉ tác giả sửa được (EXPERT-FR-006)', () => {
    expect(canEditConclusion(conclusion, 'expert-a')).toBe(true)
    expect(canEditConclusion(conclusion, 'expert-b')).toBe(false)
    expect(canEditConclusion(conclusion, null)).toBe(false)
  })
})
