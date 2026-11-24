import type { ExpertQueueGroup, ExpertQueueItem, ExpertQueueKind } from '@/types/expert/queue.types'

// 4 ô tóm tắt đầu trang, mỗi ô gom các loại việc cùng một kiểu quyết định
export type QueueSection = 'verdicts' | 'reviews' | 'proposals' | 'conclusions'

export const SECTION_KINDS: Record<QueueSection, ExpertQueueKind[]> = {
  verdicts: ['alert_verdict'],
  reviews: ['parameter_review', 'coefficient_proposal'],
  proposals: ['weather_proposal', 'profile_draft', 'recommendation_rule'],
  conclusions: ['disagreeing_day', 'report_conclusion', 'season_conclusion'],
}

// Thứ tự các khung trong trang
export const KIND_ORDER: ExpertQueueKind[] = Object.values(SECTION_KINDS).flat()

export function sectionTotal(groups: ExpertQueueGroup[], section: QueueSection): number {
  const kinds = SECTION_KINDS[section]
  return groups.filter(group => kinds.includes(group.kind)).reduce((sum, group) => sum + group.total, 0)
}

// Trang xử lý một việc; luật thời tiết theo nhà nên trang đó đọc nhà đang chọn (chọn trước khi mở)
export function targetOf(kind: ExpertQueueKind, item?: ExpertQueueItem): string {
  switch (kind) {
    case 'alert_verdict': return item ? `/domain-expert/alert-verdicts?alertId=${item.id}` : '/domain-expert/alert-verdicts'
    case 'parameter_review': return '/domain-expert/reviews'
    case 'coefficient_proposal': return '/domain-expert/reviews?tab=proposals'
    case 'disagreeing_day': return '/domain-expert/reports?tab=disagreements'
    case 'report_conclusion': return '/domain-expert/reports'
    case 'season_conclusion': return '/domain-expert/reports?tab=harvest-cycles'
    case 'weather_proposal': return '/domain-expert/weather-rules'
    case 'profile_draft': return '/domain-expert/profiles'
    case 'recommendation_rule': return '/domain-expert/recommendation-rules'
  }
}
