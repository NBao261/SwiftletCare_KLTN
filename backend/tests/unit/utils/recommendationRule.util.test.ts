import { lastDates, measureEffect, parseRuleInput, ruleHolds } from '@/utils/recommendationRule.util'

const RULE = {
  name: 'NH3 cao kéo dài', indicator: 'AIR_HOURS_OVER', comparison: 'GTE', value: 4, window_days: 3,
  action: { type: 'WORK_ORDER', title: 'Kiểm tra thông gió và vệ sinh sàn' }, source: 'Phỏng vấn người nuôi 01/12',
}

describe('parseRuleInput (EXPERT-FR-016)', () => {
  it('accepts a supported indicator, a window of 1–30 days and an action', () => {
    expect(parseRuleInput(RULE)).toMatchObject({ indicator: 'AIR_HOURS_OVER', window_days: 3, active: true })
    expect(parseRuleInput({ ...RULE, action: { type: 'PARAMETER_CHANGE', group: 'thresholds', key: 'humidity_min', value: 80 } }).action)
      .toEqual({ type: 'PARAMETER_CHANGE', group: 'thresholds', key: 'humidity_min', value: 80 })
  })

  it.each([
    ['unsupported indicator', { indicator: 'HEALTH_GOOD_RATE' }],
    ['window 0', { window_days: 0 }],
    ['window 31', { window_days: 31 }],
    ['hours above 24', { value: 25 }],
    ['no source', { source: ' ' }],
    ['work order without title', { action: { type: 'WORK_ORDER', title: '' } }],
    ['unknown parameter key', { action: { type: 'PARAMETER_CHANGE', group: 'thresholds', key: 'heating', value: 1 } }],
    ['parameter out of range', { action: { type: 'PARAMETER_CHANGE', group: 'fuzzy', key: 'fuzzy_window_sec', value: 30 } }],
  ])('rejects %s with 400', (_label, over) => {
    expect(() => parseRuleInput({ ...RULE, ...over })).toThrow(expect.objectContaining({ statusCode: 400 }))
  })
})

describe('ruleHolds (EXPERT-FR-017)', () => {
  const days = [
    { date: '2026-11-10', value: 1 },
    { date: '2026-11-11', value: 5 },
    { date: '2026-11-12', value: 4 },
    { date: '2026-11-13', value: 6 },
  ]

  it('holds when every day of the window meets the condition, and returns those days as evidence', () => {
    expect(ruleHolds({ comparison: 'GTE', value: 4, window_days: 3 }, days, '2026-11-13')).toEqual(days.slice(1))
  })

  it('does not hold when one day misses the condition or has no value', () => {
    expect(ruleHolds({ comparison: 'GTE', value: 4, window_days: 4 }, days, '2026-11-13')).toBeNull()
    expect(ruleHolds({ comparison: 'GTE', value: 4, window_days: 3 }, days, '2026-11-14')).toBeNull()
    expect(ruleHolds({ comparison: 'LTE', value: 4, window_days: 1 }, [{ date: '2026-11-13', value: null }], '2026-11-13')).toBeNull()
  })
})

describe('measureEffect (EXPERT-FR-019, BR-42)', () => {
  const series = (start: string, values: number[]) => lastDates(start, values.length).map((date, i) => ({ date, value: values[i] }))

  it('compares the mean of the 7 days after acceptance with the 7 days before', () => {
    // Chấp nhận 2026-11-10: trước = 03…09/11, sau = 11…17/11
    const days = [...series('2026-11-09', [6, 6, 6, 6, 6, 6, 6]), ...series('2026-11-17', [2, 2, 2, 2, 2, 2, 2])]
    expect(measureEffect('GTE', '2026-11-10', days)).toEqual({ before: 6, after: 2, change: -4, improved: true })
    // Luật "tỷ lệ về ≤ x": tăng mới là cải thiện
    expect(measureEffect('LTE', '2026-11-10', days).improved).toBe(false)
  })

  it('gives null when one side has no data', () => {
    expect(measureEffect('GTE', '2026-11-10', series('2026-11-09', [6, 6]))).toEqual({ before: 6, after: null, change: null, improved: null })
  })
})
