import { Types } from 'mongoose'
import { Alert } from '@/models/alert.model'
import { House, Zone, type IHouse } from '@/models/houseZone.model'
import { HouseHealthDay } from '@/models/houseHealthDay.model'
import { ParameterReview } from '@/models/parameterReview.model'
import { Recommendation, type IRecommendation, type RecommendationStatus } from '@/models/recommendation.model'
import { RecommendationRule, type IRecommendationRule } from '@/models/recommendationRule.model'
import { logAction } from '@/services/auditLog.service'
import { updateZoneFuzzyTuning, updateZoneThresholds } from '@/services/farm.service'
import { createInAppNotification, findRecipients } from '@/services/notification.service'
import { createManualWorkOrder } from '@/services/workOrder.service'
import { vnDate } from '@/services/birdCount.service'
import { assertFarmAccess, assertHouseAccess, findFarmOrThrow, hasFarmAccess } from '@/utils/farmAccess.util'
import { paginate } from '@/utils/helpers.util'
import logger from '@/utils/logger.util'
import {
  RECOMMENDATION_EFFECT_DAYS, RECOMMENDATION_EXPIRY_DAYS, dayOffset, lastDates, measureEffect, parseRuleInput, ruleHolds,
  type DayValue, type RuleIndicator,
} from '@/utils/recommendationRule.util'
import { ConflictError, ForbiddenError, NotFoundError } from '@/utils/appError.util'
import type { CurrentUser } from '@/types'

/**
 * EXPERT-FR-016…019, BR-42, Report 3 §6.21, Report 4 D19 / DF-15 — vòng khuyến nghị (MF-08): Domain Expert viết luật,
 * mỗi ngày sau đánh giá ngày backend xét luật cho từng nhà, Farm Owner chấp nhận (Work Order hoặc thay đổi tham số
 * theo MF-05) hoặc từ chối, 7 ngày sau khi chấp nhận thì đo hiệu quả.
 */

const DAY_MS = 86_400_000
/** 'YYYY-MM-DD' giờ VN → thời điểm đầu ngày đó */
const vnDayStart = (date: string) => new Date(`${date}T00:00:00+07:00`)

// ── Luật (Domain Expert) ─────────────────────────────────────────────────────

async function loadRule(ruleId: string, user: CurrentUser) {
  const rule = await RecommendationRule.findById(ruleId)
  if (!rule) throw NotFoundError('Không tìm thấy luật khuyến nghị')
  const farm = await findFarmOrThrow(String(rule.farm_id))
  // Farm Owner và Domain Expert của farm (Report 3 §2.4); thợ và Administrator đã bị chặn ở route
  if (!hasFarmAccess(farm, user)) throw ForbiddenError('Không có quyền trên farm này')
  return { rule, farm }
}

/** EXPERT-FR-016 — luật của farm, mới sửa trước */
export async function listRules(farmId: string, user: CurrentUser, query: { page?: string; limit?: string } = {}) {
  const farm = await assertFarmAccess(farmId, user)
  const { page, skip, limit } = paginate(query.page, query.limit)
  const [records, total] = await Promise.all([
    RecommendationRule.find({ farm_id: farm._id }).sort({ updated_at: -1 }).skip(skip).limit(limit).lean(),
    RecommendationRule.countDocuments({ farm_id: farm._id }),
  ])
  return { records, total, page, limit }
}

/** EXPERT-FR-016 — Domain Expert viết luật (route chỉ DOMAIN_EXPERT); chỉ số không hỗ trợ, cửa sổ ngoài 1–30 → 400 */
export async function createRule(user: CurrentUser, input: Record<string, unknown>) {
  const farm = await assertFarmAccess(String(input.farm_id), user)
  const parsed = parseRuleInput(input)
  const rule = await RecommendationRule.create({ ...parsed, farm_id: farm._id, author_id: user._id })
  await logAction(user._id, 'RECOMMENDATION_RULE_CREATED', 'recommendation_rule', String(rule._id), { ...parsed }, { farmId: String(farm._id) })
  return rule
}

/** EXPERT-FR-016 — sửa luật hoặc bật/tắt; khuyến nghị đã mở giữ nguyên bằng chứng lúc mở */
export async function updateRule(ruleId: string, user: CurrentUser, input: Record<string, unknown>) {
  const { rule, farm } = await loadRule(ruleId, user)
  const parsed = parseRuleInput(input)
  const before = rule.toObject()
  rule.set(parsed)
  await rule.save()
  await logAction(user._id, 'RECOMMENDATION_RULE_UPDATED', 'recommendation_rule', String(rule._id), {
    before: { indicator: before.indicator, comparison: before.comparison, value: before.value, window_days: before.window_days, active: before.active },
    after: parsed,
  }, { farmId: String(farm._id) })
  return rule
}

/** EXPERT-FR-019 — theo từng luật: số khuyến nghị đã mở, đã chấp nhận, đã đo, đã cải thiện */
export async function ruleEffects(farmId: string, user: CurrentUser) {
  const farm = await assertFarmAccess(farmId, user)
  const rules = await RecommendationRule.find({ farm_id: farm._id }).select('name indicator active').lean()
  const rows = await Recommendation.aggregate<{ _id: Types.ObjectId; raised: number; accepted: number; measured: number; improved: number }>([
    { $match: { farm_id: farm._id } },
    { $group: {
      _id: '$rule_id',
      raised: { $sum: 1 },
      accepted: { $sum: { $cond: [{ $in: ['$status', ['ACCEPTED', 'MEASURED']] }, 1, 0] } },
      measured: { $sum: { $cond: [{ $eq: ['$status', 'MEASURED'] }, 1, 0] } },
      improved: { $sum: { $cond: [{ $eq: ['$effect.improved', true] }, 1, 0] } },
    } },
  ])
  const byRule = new Map(rows.map(r => [String(r._id), r]))
  return rules.map(rule => {
    const row = byRule.get(String(rule._id))
    return {
      rule_id: String(rule._id), name: rule.name, indicator: rule.indicator, active: rule.active,
      raised: row?.raised ?? 0, accepted: row?.accepted ?? 0, measured: row?.measured ?? 0, improved: row?.improved ?? 0,
    }
  })
}

// ── Khuyến nghị (Farm Owner quyết định) ──────────────────────────────────────

/**
 * Khuyến nghị của một nhà (cả thợ được giao nhà, chỉ đọc) hoặc của cả farm (Farm Owner, Domain Expert). Report 3 §2.4:
 * thợ và chuyên gia chỉ đọc.
 */
export async function listRecommendations(
  user: CurrentUser, query: { farmId?: string; houseId?: string; status?: string; page?: string; limit?: string },
) {
  const filter: Record<string, unknown> = {}
  if (query.houseId) filter.house_id = (await assertHouseAccess(query.houseId, user)).house._id
  else filter.farm_id = (await assertFarmAccess(String(query.farmId), user))._id
  if (query.status) filter.status = query.status
  const { page, skip, limit } = paginate(query.page, query.limit)
  const [records, total] = await Promise.all([
    Recommendation.find(filter).sort({ raised_at: -1 }).skip(skip).limit(limit)
      .populate<{ rule_id: Pick<IRecommendationRule, '_id' | 'name' | 'action'> }>('rule_id', 'name action').lean(),
    Recommendation.countDocuments(filter),
  ])
  return { records, total, page, limit }
}

async function loadRecommendation(id: string, user: CurrentUser) {
  const recommendation = await Recommendation.findById(id)
  if (!recommendation) throw NotFoundError('Không tìm thấy khuyến nghị')
  const chain = await assertHouseAccess(String(recommendation.house_id), user)
  return { recommendation, ...chain }
}

export async function getRecommendation(id: string, user: CurrentUser) {
  return (await loadRecommendation(id, user)).recommendation
}

/** Chuyển khỏi OPEN trong một lần ghi có điều kiện: hai quyết định cùng lúc thì quyết định sau nhận 409 */
async function decide(id: Types.ObjectId, set: Partial<IRecommendation>) {
  const updated = await Recommendation.findOneAndUpdate({ _id: id, status: 'OPEN' }, set, { new: true })
  if (!updated) throw ConflictError('Khuyến nghị không còn mở (đã quyết định hoặc đã hết hạn)')
  return updated
}

/**
 * EXPERT-FR-018 — Farm Owner chấp nhận (route chỉ FARM_OWNER): hành động Work Order mở đúng một Work Order sửa chữa
 * nối với khuyến nghị (MF-02); hành động thay đổi tham số sửa ngưỡng hoặc hệ số mờ của các zone trong nhà như Farm
 * Owner tự sửa, nên farm có chuyên gia có mục duyệt (MF-05, EXPERT-FR-010). Lỗi khi thực hiện thì khuyến nghị mở lại.
 */
export async function acceptRecommendation(id: string, user: CurrentUser) {
  const { recommendation: current, house, farm } = await loadRecommendation(id, user)
  const rule = await RecommendationRule.findById(current.rule_id).lean()
  if (!rule) throw NotFoundError('Luật của khuyến nghị đã bị xoá')
  const recommendation = await decide(current._id, { status: 'ACCEPTED', decided_by: user._id as never, decided_at: new Date() })
  try {
    if (rule.action.type === 'WORK_ORDER') {
      const wo = await createManualWorkOrder(user, {
        house_id: String(house._id), title: rule.action.title, recommendation_id: String(recommendation._id),
        description: `Khuyến nghị từ luật "${rule.name}" (${describeCondition(rule)})`,
      })
      recommendation.work_order_id = wo._id as never
    } else {
      const action = rule.action
      const zones = await Zone.find({ house_id: house._id }).select('_id').lean()
      for (const zone of zones) {
        const updates = { [action.key]: action.value }
        if (action.group === 'thresholds') await updateZoneThresholds(String(zone._id), user, updates)
        else await updateZoneFuzzyTuning(String(zone._id), user, updates)
      }
      const reviews = await ParameterReview.find({
        zone_id: { $in: zones.map(z => z._id) }, group: action.group, status: 'PENDING_REVIEW',
      }).select('_id').lean()
      recommendation.review_ids = reviews.map(r => r._id) as never
    }
    await recommendation.save()
  } catch (err) {
    await Recommendation.updateOne({ _id: recommendation._id }, { status: 'OPEN', $unset: { decided_by: 1, decided_at: 1 } })
    throw err
  }
  await logAction(user._id, 'RECOMMENDATION_ACCEPTED', 'recommendation', String(recommendation._id), {
    rule_id: String(rule._id), house_id: String(house._id), work_order_id: recommendation.work_order_id ? String(recommendation.work_order_id) : undefined,
    review_ids: recommendation.review_ids.map(String),
  }, { farmId: String(farm._id) })
  return recommendation
}

/** EXPERT-FR-018 — từ chối kèm lý do (route chặn lý do rỗng: 422) */
export async function rejectRecommendation(id: string, user: CurrentUser, reason: string) {
  const { recommendation: current, house, farm } = await loadRecommendation(id, user)
  const recommendation = await decide(current._id, {
    status: 'REJECTED', decided_by: user._id as never, decided_at: new Date(), reject_reason: reason.trim(),
  })
  await logAction(user._id, 'RECOMMENDATION_REJECTED', 'recommendation', String(recommendation._id), {
    rule_id: String(recommendation.rule_id), house_id: String(house._id), reason: recommendation.reject_reason,
  }, { farmId: String(farm._id) })
  return recommendation
}

// ── Job ──────────────────────────────────────────────────────────────────────

const describeCondition = (rule: Pick<IRecommendationRule, 'indicator' | 'comparison' | 'value' | 'window_days'>) =>
  `${rule.indicator} ${rule.comparison === 'GTE' ? '≥' : '≤'} ${rule.value} trong ${rule.window_days} ngày`

/** Giá trị theo ngày của một chỉ số ở một nhà, từ `from` tới `to` (giờ VN, gồm cả hai đầu) */
async function indicatorDays(indicator: RuleIndicator, house: Pick<IHouse, '_id'>, from: string, to: string): Promise<DayValue[]> {
  const dates = lastDates(to, Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1)
  if (indicator === 'MISTING_INEFFECTIVE') {
    // Đếm cảnh báo phun không hiệu quả mở trong từng ngày ở các zone của nhà; ngày không có là 0
    const zoneIds = (await Zone.find({ house_id: house._id }).select('_id').lean()).map(z => z._id)
    const alerts = await Alert.find({
      zone_id: { $in: zoneIds }, type: 'MISTING_INEFFECTIVE',
      created_at: { $gte: vnDayStart(from), $lt: new Date(vnDayStart(to).getTime() + DAY_MS) },
    }).select('created_at').lean()
    const counts = new Map<string, number>()
    for (const alert of alerts) counts.set(vnDate(alert.created_at), (counts.get(vnDate(alert.created_at)) ?? 0) + 1)
    return dates.map(date => ({ date, value: counts.get(date) ?? 0 }))
  }
  // Chỉ số của đánh giá ngày (ANALYTICS-FR-012): thiếu ngày hoặc nguồn không đủ dữ liệu thì null
  const days = await HouseHealthDay.find({ house_id: house._id, date: { $gte: from, $lte: to } }).select('date indicators').lean()
  const byDate = new Map(days.map(day => {
    const i = day.indicators
    const value =
      indicator === 'TIME_IN_RANGE' ? i?.environment?.value
      : indicator === 'AIR_HOURS_OVER' ? i?.air?.value
      : indicator === 'NOISE_EPISODES' ? i?.noise?.value
      : i?.flock?.details?.return_rate
    return [day.date, typeof value === 'number' ? value : null] as const
  }))
  return dates.map(date => ({ date, value: byDate.get(date) ?? null }))
}

/**
 * EXPERT-FR-017, BR-42 — gọi mỗi ngày sau đánh giá ngày (jobs/returnRate.job.ts). Mỗi luật đang bật xét từng nhà của
 * farm; thoả mà chưa có khuyến nghị mở thì mở một khuyến nghị kèm bằng chứng và báo Farm Owner trong app. Lỗi ở một
 * luật hay một nhà không chặn các luật và nhà khác. Trả số khuyến nghị mới.
 */
export async function evaluateRecommendationRules(date = vnDate(new Date()), now = new Date()): Promise<number> {
  const rules = await RecommendationRule.find({ active: true }).lean()
  let raised = 0
  for (const rule of rules) {
    const houses = await House.find({ farm_id: rule.farm_id }).select('_id name').lean()
    for (const house of houses) {
      try {
        if (await Recommendation.exists({ rule_id: rule._id, house_id: house._id, status: 'OPEN' })) continue
        const days = await indicatorDays(rule.indicator, house, dayOffset(date, -(rule.window_days - 1)), date)
        const evidence = ruleHolds(rule, days, date)
        if (!evidence) continue
        await Recommendation.create({
          farm_id: rule.farm_id, house_id: house._id, rule_id: rule._id, raised_at: now, raised_for: date,
          evidence: { indicator: rule.indicator, comparison: rule.comparison, value: rule.value, window_days: rule.window_days, days: evidence },
        })
        raised++
        for (const owner of await findRecipients(String(rule.farm_id))) {
          await createInAppNotification(String(owner._id), {
            title: `Khuyến nghị mới cho nhà "${house.name}"`,
            body: `Luật "${rule.name}": ${describeCondition(rule)}. Mở mục Khuyến nghị để chấp nhận hoặc từ chối.`,
          })
        }
      } catch (err) {
        // Trùng index unique một phần (job chạy chồng) là bình thường; lỗi khác ghi log rồi qua nhà sau
        if ((err as { code?: number }).code !== 11000) {
          logger.error('Xét luật khuyến nghị thất bại', { ruleId: String(rule._id), houseId: String(house._id), err: (err as Error).message })
        }
      }
    }
  }
  return raised
}

/** SM-21 OPEN → EXPIRED — 7 ngày không ai quyết định (BR-42) */
export async function expireRecommendations(now = new Date()): Promise<number> {
  const { modifiedCount } = await Recommendation.updateMany(
    { status: 'OPEN', raised_at: { $lte: new Date(now.getTime() - RECOMMENDATION_EXPIRY_DAYS * DAY_MS) } },
    { status: 'EXPIRED' satisfies RecommendationStatus },
  )
  return modifiedCount
}

/**
 * SM-21 ACCEPTED → MEASURED, EXPERT-FR-019 — 7 ngày sau ngày chấp nhận: trung bình chỉ số của luật 7 ngày sau trừ 7
 * ngày trước. Trả số khuyến nghị vừa đo.
 */
export async function measureRecommendationEffects(now = new Date()): Promise<number> {
  const due = await Recommendation.find({
    status: 'ACCEPTED', decided_at: { $lte: new Date(now.getTime() - RECOMMENDATION_EFFECT_DAYS * DAY_MS) },
  })
  let measured = 0
  for (const recommendation of due) {
    try {
      const rule = await RecommendationRule.findById(recommendation.rule_id).lean()
      if (!rule) continue
      const acceptedDate = vnDate(recommendation.decided_at!)
      const days = await indicatorDays(
        rule.indicator, { _id: recommendation.house_id },
        dayOffset(acceptedDate, -RECOMMENDATION_EFFECT_DAYS), dayOffset(acceptedDate, RECOMMENDATION_EFFECT_DAYS),
      )
      const effect = measureEffect(rule.comparison, acceptedDate, days)
      const { modifiedCount } = await Recommendation.updateOne(
        { _id: recommendation._id, status: 'ACCEPTED' },
        { status: 'MEASURED', effect: { ...effect, measured_at: now } },
      )
      measured += modifiedCount
    } catch (err) {
      logger.error('Đo hiệu quả khuyến nghị thất bại', { recommendationId: String(recommendation._id), err: (err as Error).message })
    }
  }
  return measured
}
