import type { ExpertQueueGroup, ExpertQueueItem, ExpertQueueKind } from '@/types/expert/queue.types'

// 4 tab đầu trang, mỗi tab gom các loại việc cùng một kiểu quyết định
export type QueueSection = 'verdicts' | 'reviews' | 'proposals' | 'conclusions'

export const SECTION_KINDS: Record<QueueSection, ExpertQueueKind[]> = {
  verdicts: ['alert_verdict'],
  reviews: ['parameter_review', 'coefficient_proposal'],
  proposals: ['weather_proposal', 'profile_draft', 'recommendation_rule'],
  conclusions: ['disagreeing_day', 'report_conclusion', 'season_conclusion'],
}

// Thứ tự các khung trong trang
export const KIND_ORDER: ExpertQueueKind[] = Object.values(SECTION_KINDS).flat()

export type QueueTab = 'all' | QueueSection

// Các khung việc của một tab: chỉ khung còn việc, theo thứ tự trang; việc Chủ nhà yến đã nhắc đứng trước
export function groupsForTab(groups: ExpertQueueGroup[], tab: QueueTab): ExpertQueueGroup[] {
  const kinds = tab === 'all' ? KIND_ORDER : SECTION_KINDS[tab]
  const byKind = new Map(groups.map(group => [group.kind, group]))
  return kinds
    .map(kind => byKind.get(kind))
    .filter((group): group is ExpertQueueGroup => Boolean(group && group.total > 0))
    .map(group => ({ ...group, items: [...group.items].sort((a, b) => Number(b.reminded) - Number(a.reminded)) }))
}

export interface QueueRow {
  kind: ExpertQueueKind
  item: ExpertQueueItem
}

// Giờ của việc để xếp thứ tự: ISO hoặc 'YYYY-MM-DD'; không đọc được thì xuống cuối
const timeOf = (item: ExpertQueueItem): number => {
  const time = Date.parse(item.at)
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time
}

// Hàng đợi chung của một tab: việc Chủ nhà yến đã nhắc trước, rồi việc chờ lâu nhất
export function queueRows(groups: ExpertQueueGroup[], tab: QueueTab): QueueRow[] {
  return groupsForTab(groups, tab)
    .flatMap(group => group.items.map(item => ({ kind: group.kind, item })))
    .sort((a, b) => Number(b.item.reminded) - Number(a.item.reminded) || timeOf(a.item) - timeOf(b.item))
}

// Loại việc còn nhiều hơn số đã hiện trong tab: để dẫn tới trang đầy đủ của loại đó
export function hiddenCounts(groups: ExpertQueueGroup[], tab: QueueTab): Array<{ kind: ExpertQueueKind; hidden: number }> {
  return groupsForTab(groups, tab)
    .filter(group => group.total > group.items.length)
    .map(group => ({ kind: group.kind, hidden: group.total - group.items.length }))
}

export function remindedCount(groups: ExpertQueueGroup[]): number {
  return groups.reduce((sum, group) => sum + group.items.filter(item => item.reminded).length, 0)
}

export function sectionOf(kind: ExpertQueueKind): QueueSection {
  return (Object.keys(SECTION_KINDS) as QueueSection[]).find(section => SECTION_KINDS[section].includes(kind)) as QueueSection
}

export function sectionTotal(groups: ExpertQueueGroup[], section: QueueSection): number {
  const kinds = SECTION_KINDS[section]
  return groups.filter(group => kinds.includes(group.kind)).reduce((sum, group) => sum + group.total, 0)
}

// Trang xử lý một việc; luật thời tiết theo nhà nên trang đó đọc nhà đang chọn (chọn trước khi mở)
export function targetOf(kind: ExpertQueueKind, item?: ExpertQueueItem): string {
  switch (kind) {
    case 'alert_verdict': return item ? `/domain-expert/alert-verdicts?tab=PENDING&alertId=${item.id}` : '/domain-expert/alert-verdicts?tab=PENDING'
    case 'parameter_review': return '/domain-expert/reviews?tab=reviews'
    case 'coefficient_proposal': return '/domain-expert/reviews?tab=proposals'
    case 'disagreeing_day': return '/domain-expert/reports?tab=disagreements'
    case 'report_conclusion': return '/domain-expert/reports?tab=reports'
    case 'season_conclusion': return '/domain-expert/reports?tab=harvest-cycles'
    case 'weather_proposal': return '/domain-expert/weather-rules'
    case 'profile_draft': return '/domain-expert/profiles?status=DRAFT'
    case 'recommendation_rule': return '/domain-expert/recommendation-rules'
  }
}
