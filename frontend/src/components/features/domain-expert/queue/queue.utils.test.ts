import { describe, expect, it } from 'vitest'
import { KIND_ORDER, groupsForTab, sectionTotal, targetOf } from '@/components/features/domain-expert/queue/queue.utils'
import type { ExpertQueueGroup } from '@/types/expert/queue.types'

const group = (kind: ExpertQueueGroup['kind'], total: number): ExpertQueueGroup => ({ kind, total, items: [] })

describe('hàng đợi việc của chuyên gia', () => {
  it('mỗi loại việc nằm đúng một ô tóm tắt', () => {
    expect(new Set(KIND_ORDER).size).toBe(9)
    const groups = [group('alert_verdict', 2), group('parameter_review', 1), group('coefficient_proposal', 3),
      group('weather_proposal', 1), group('profile_draft', 0), group('recommendation_rule', 2),
      group('disagreeing_day', 4), group('report_conclusion', 5), group('season_conclusion', 1)]
    expect(['verdicts', 'reviews', 'proposals', 'conclusions'].map(s => sectionTotal(groups, s as 'verdicts'))).toEqual([2, 4, 3, 10])
  })

  it('mỗi tab chỉ giữ khung còn việc, việc được nhắc lên trước', () => {
    const item = (id: string, reminded: boolean) => ({ id, title: id, house_name: null, at: '', reminded })
    const groups: ExpertQueueGroup[] = [
      { kind: 'alert_verdict', total: 2, items: [item('a', false), item('b', true)] },
      group('parameter_review', 0),
      { kind: 'profile_draft', total: 1, items: [item('p', false)] },
    ]
    expect(groupsForTab(groups, 'all').map(g => g.kind)).toEqual(['alert_verdict', 'profile_draft'])
    expect(groupsForTab(groups, 'all')[0].items.map(i => i.id)).toEqual(['b', 'a'])
    expect(groupsForTab(groups, 'proposals').map(g => g.kind)).toEqual(['profile_draft'])
    expect(groupsForTab(groups, 'reviews')).toEqual([])
  })

  it('mở đúng trang và đúng tab của việc', () => {
    expect(targetOf('alert_verdict', { id: 'a1', title: '', house_name: null, at: '', reminded: false }))
      .toBe('/domain-expert/alert-verdicts?tab=PENDING&alertId=a1')
    expect(targetOf('alert_verdict')).toBe('/domain-expert/alert-verdicts?tab=PENDING')
    expect(targetOf('profile_draft')).toBe('/domain-expert/profiles?status=DRAFT')
    expect(targetOf('coefficient_proposal')).toBe('/domain-expert/reviews?tab=proposals')
    expect(targetOf('disagreeing_day')).toBe('/domain-expert/reports?tab=disagreements')
    expect(targetOf('season_conclusion')).toBe('/domain-expert/reports?tab=harvest-cycles')
  })
})
