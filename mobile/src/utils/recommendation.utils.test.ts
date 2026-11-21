import { describe, expect, it } from '@jest/globals'
import type { Recommendation } from '@/types'
import {
  describeRecommendationAction,
  describeRecommendationCondition,
  formatEvidenceValue,
  getRecommendationAction,
  getRecommendationRuleName,
} from '@/utils/recommendation.utils'

// Khuyến nghị mẫu: thời gian trong ngưỡng thấp 3 ngày, đề xuất mở phiếu
function buildRecommendation(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    _id: 'recommendation-1',
    farm_id: 'farm-1',
    house_id: 'house-1',
    rule_id: { _id: 'rule-1', name: 'Luật cũ', action: { type: 'WORK_ORDER', title: 'Kiểm béc phun' } },
    status: 'OPEN',
    evidence: {
      indicator: 'TIME_IN_RANGE',
      comparison: 'LTE',
      value: 75,
      window_days: 3,
      days: [
        { date: '2026-11-17', value: 70 },
        { date: '2026-11-18', value: null },
      ],
    },
    raised_at: '2026-11-19T00:00:00.000Z',
    raised_for: '2026-11-18',
    ...overrides,
  }
}

describe('getRecommendationRuleName / getRecommendationAction', () => {
  it('ưu tiên bản chụp của luật lúc mở', () => {
    const recommendation = buildRecommendation({
      rule_snapshot: {
        name: 'Luật mới',
        indicator: 'TIME_IN_RANGE',
        comparison: 'LTE',
        value: 75,
        window_days: 3,
        action: { type: 'PARAMETER_CHANGE', group: 'thresholds', key: 'humidity_min', value: 80 },
      },
    })
    expect(getRecommendationRuleName(recommendation)).toBe('Luật mới')
    expect(getRecommendationAction(recommendation)?.type).toBe('PARAMETER_CHANGE')
  })

  it('không có bản chụp thì đọc luật backend kèm; chỉ có id thì không đọc được', () => {
    expect(getRecommendationRuleName(buildRecommendation())).toBe('Luật cũ')
    expect(getRecommendationAction(buildRecommendation({ rule_id: 'rule-1' }))).toBeNull()
    expect(getRecommendationRuleName(buildRecommendation({ rule_id: 'rule-1' }))).toBe('_')
  })
})

describe('describeRecommendationAction', () => {
  it('mở phiếu thì ghi tiêu đề phiếu', () => {
    expect(describeRecommendationAction({ type: 'WORK_ORDER', title: 'Kiểm béc phun' })).toBe(
      'Mở phiếu công việc: Kiểm béc phun',
    )
  })

  it('đổi tham số thì ghi tên tham số và giá trị kèm đơn vị', () => {
    const text = describeRecommendationAction({ type: 'PARAMETER_CHANGE', group: 'thresholds', key: 'humidity_min', value: 80 })
    expect(text).toContain('80 %')
    expect(text).toContain('cho mọi khu vực của nhà')
  })

  it('không đọc được hành động thì "_"', () => {
    expect(describeRecommendationAction(null)).toBe('_')
  })
})

describe('describeRecommendationCondition / formatEvidenceValue', () => {
  it('ghi điều kiện của luật và giá trị từng ngày, ngày thiếu số là "_"', () => {
    const recommendation = buildRecommendation()
    expect(describeRecommendationCondition(recommendation)).toBe('Thời gian trong ngưỡng ≤ 75 % trong 3 ngày liền')
    expect(formatEvidenceValue(recommendation, 70)).toBe('70 %')
    expect(formatEvidenceValue(recommendation, null)).toBe('_')
  })
})
