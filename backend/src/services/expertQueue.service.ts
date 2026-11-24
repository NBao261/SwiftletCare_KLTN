import { Types } from 'mongoose'
import { Alert } from '@/models/alert.model'
import { CoefficientProposal } from '@/models/coefficientProposal.model'
import { ConfigProfile } from '@/models/configProfile.model'
import { HarvestCycle } from '@/models/harvestCycle.model'
import { HouseHealthReport, type HouseReportKind } from '@/models/houseHealthReport.model'
import { House, Zone } from '@/models/houseZone.model'
import { ParameterReview } from '@/models/parameterReview.model'
import { RecommendationRule } from '@/models/recommendationRule.model'
import { INFERRED_ALERT_TYPES } from '@/services/alert.service'
import { vnDate } from '@/services/birdCount.service'
import { listDisagreements } from '@/services/healthDay.service'
import { GROUP_LABEL } from '@/services/parameterReview.service'
import { addDays } from '@/utils/countingSchedule.util'
import { assertFarmAccess } from '@/utils/farmAccess.util'
import type { CurrentUser } from '@/types'

// Mỗi nhóm chỉ trả vài việc đầu, phần còn lại mở ở trang của nhóm đó
export const QUEUE_ITEMS_PER_GROUP = 5
// Cùng khoảng với trang Ngày lệch
const DISAGREEMENT_DAYS = 14

export const QUEUE_KINDS = [
  'alert_verdict', 'parameter_review', 'coefficient_proposal', 'disagreeing_day', 'report_conclusion',
  'weather_proposal', 'profile_draft', 'recommendation_rule', 'season_conclusion',
] as const
export type QueueKind = typeof QUEUE_KINDS[number]

export interface QueueItem {
  id: string
  title: string
  house_name: string | null
  at: Date | string
  // Farm Owner đã bấm nhắc chuyên gia
  reminded: boolean
}

export interface QueueGroup { kind: QueueKind; total: number; items: QueueItem[] }

const REPORT_KIND: Record<HouseReportKind, string> = { DAILY: 'ngày', WEEKLY: 'tuần', MONTHLY: 'tháng', CUSTOM: 'theo yêu cầu' }
// 'YYYY-MM-DD' → 'DD/MM/YYYY' cho câu người đọc
const dayLabel = (date: string) => date.split('-').reverse().join('/')
// Việc đã được nhắc lên đầu, rồi mới nhất trước
const BY_REMINDER = { expert_reminded_at: -1, created_at: -1 } as const

// Mọi việc đang chờ chuyên gia của một trại, một phạm vi cho mọi nhóm
export async function getExpertQueue(user: CurrentUser, farmId: string, now = new Date()): Promise<{ farm_id: string; groups: QueueGroup[] }> {
  const farm = await assertFarmAccess(farmId, user)
  const farm_id = farm._id as Types.ObjectId
  const [houses, zones] = await Promise.all([
    House.find({ farm_id }).select('name weather_rules_proposal').lean(),
    Zone.find({ farm_id }).select('name house_id').lean(),
  ])
  const houseName = new Map(houses.map(house => [String(house._id), house.name]))
  const zoneHouse = new Map(zones.map(zone => [String(zone._id), String(zone.house_id)]))
  const nameOf = (houseId?: unknown, zoneId?: unknown): string | null =>
    houseName.get(String(houseId ?? zoneHouse.get(String(zoneId)) ?? '')) ?? null
  const limit = QUEUE_ITEMS_PER_GROUP

  const alertFilter = { farm_id, type: { $in: INFERRED_ALERT_TYPES }, expert_verdict: { $exists: false } }
  const reviewFilter = { farm_id, status: 'PENDING_REVIEW' }
  const proposalFilter = { farm_id, status: 'PROPOSED' }
  const reportFilter = { farm_id, expert_conclusion: null }
  const profileFilter = { farm_id, status: 'DRAFT' }
  const ruleFilter = { farm_id, pending_approval: true }
  const cycleFilter = { farm_id, status: 'CLOSED', conclusion: null }
  const today = vnDate(now)

  const [
    alerts, alertTotal, reviews, reviewTotal, proposals, proposalTotal, reports, reportTotal,
    profiles, profileTotal, rules, ruleTotal, cycles, cycleTotal, disagreements,
  ] = await Promise.all([
    Alert.find(alertFilter).sort(BY_REMINDER).limit(limit).select('title house_id zone_id created_at expert_reminded_at').lean(),
    Alert.countDocuments(alertFilter),
    ParameterReview.find(reviewFilter).sort({ created_at: -1 }).limit(limit).lean(),
    ParameterReview.countDocuments(reviewFilter),
    CoefficientProposal.find(proposalFilter).sort({ created_at: -1 }).limit(limit).lean(),
    CoefficientProposal.countDocuments(proposalFilter),
    HouseHealthReport.find(reportFilter).sort({ expert_reminded_at: -1, generated_at: -1 }).limit(limit).select('house_id kind period_end generated_at expert_reminded_at').lean(),
    HouseHealthReport.countDocuments(reportFilter),
    ConfigProfile.find(profileFilter).sort({ updated_at: -1 }).limit(limit).select('name updated_at').lean(),
    ConfigProfile.countDocuments(profileFilter),
    RecommendationRule.find(ruleFilter).sort({ updated_at: -1 }).limit(limit).select('name updated_at').lean(),
    RecommendationRule.countDocuments(ruleFilter),
    HarvestCycle.find(cycleFilter).sort(BY_REMINDER).limit(limit).select('house_id zone_id end_date created_at expert_reminded_at').lean(),
    HarvestCycle.countDocuments(cycleFilter),
    listDisagreements(user, { farmId, from: addDays(today, 1 - DISAGREEMENT_DAYS), to: today }, now),
  ])
  const zoneName = new Map(zones.map(zone => [String(zone._id), zone.name]))
  const weather = houses.filter(house => house.weather_rules_proposal)
    .sort((a, b) => +new Date(b.weather_rules_proposal!.proposed_at) - +new Date(a.weather_rules_proposal!.proposed_at))
  const reminded = (doc: object) => Boolean((doc as { expert_reminded_at?: Date }).expert_reminded_at)

  const groups: QueueGroup[] = [
    {
      kind: 'alert_verdict', total: alertTotal,
      items: alerts.map(a => ({ id: String(a._id), title: a.title, house_name: nameOf(a.house_id, a.zone_id), at: a.created_at, reminded: reminded(a) })),
    },
    {
      kind: 'parameter_review', total: reviewTotal,
      items: reviews.map(r => ({ id: String(r._id), title: `Thay đổi ${GROUP_LABEL[r.group]}`, house_name: nameOf(r.house_id, r.zone_id), at: r.created_at, reminded: false })),
    },
    {
      kind: 'coefficient_proposal', total: proposalTotal,
      items: proposals.map(p => ({ id: String(p._id), title: `Đề xuất hệ số mờ của ${zoneName.get(String(p.zone_id)) ?? 'Zone'}`, house_name: nameOf(undefined, p.zone_id), at: p.created_at, reminded: false })),
    },
    {
      kind: 'disagreeing_day', total: disagreements.days.length,
      items: disagreements.days.slice(0, limit).map(d => ({ id: d.day_id, title: `Ngày ${dayLabel(d.date)} lệch đánh giá`, house_name: d.house_name, at: d.date, reminded: false })),
    },
    {
      kind: 'report_conclusion', total: reportTotal,
      items: reports.map(r => ({ id: String(r._id), title: `Báo cáo ${REPORT_KIND[r.kind]} đến ${dayLabel(r.period_end)}`, house_name: nameOf(r.house_id), at: r.generated_at, reminded: reminded(r) })),
    },
    {
      kind: 'weather_proposal', total: weather.length,
      items: weather.slice(0, limit).map(h => ({ id: String(h._id), title: 'Đề xuất luật bù thời tiết', house_name: h.name, at: h.weather_rules_proposal!.proposed_at, reminded: false })),
    },
    {
      kind: 'profile_draft', total: profileTotal,
      items: profiles.map(p => ({ id: String(p._id), title: p.name, house_name: null, at: p.updated_at, reminded: false })),
    },
    {
      kind: 'recommendation_rule', total: ruleTotal,
      items: rules.map(r => ({ id: String(r._id), title: r.name, house_name: null, at: r.updated_at, reminded: false })),
    },
    {
      kind: 'season_conclusion', total: cycleTotal,
      items: cycles.map(c => ({ id: String(c._id), title: `Mùa vụ ${zoneName.get(String(c.zone_id)) ?? ''}`.trim(), house_name: nameOf(c.house_id), at: c.end_date ?? c.created_at, reminded: reminded(c) })),
    },
  ]
  return { farm_id: String(farm_id), groups }
}
