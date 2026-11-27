import { Types } from 'mongoose'
import { Alert } from '@/models/alert.model'
import { Farm } from '@/models/farm.model'
import { House, Zone, type IHouse } from '@/models/houseZone.model'
import { HouseHealthDay } from '@/models/houseHealthDay.model'
import { ParameterReview } from '@/models/parameterReview.model'
import { Recommendation, type IRecommendation, type RecommendationStatus, type RuleSnapshot } from '@/models/recommendation.model'
import { RecommendationRule, type IRecommendationRule } from '@/models/recommendationRule.model'
import { logAction } from '@/services/auditLog.service'
import { updateZoneFuzzyTuning, updateZoneThresholds } from '@/services/farm.service'
import { createInAppNotification, findRecipients, notifyExpertsOfProposal } from '@/services/notification.service'
import { createManualWorkOrder } from '@/services/workOrder.service'
import { vnDate } from '@/services/birdCount.service'
import { WorkOrder } from '@/models/workOrder.model'
import { emitRecommendationNew } from '@/socket'
import { assertValidFuzzyTuning, pickFuzzyTuning } from '@/utils/fuzzyTuning.util'
import { assertValidThresholds, pickThresholds } from '@/utils/thresholds.util'
import { stageOn } from '@/utils/houseStage.util'
import { assertFarmAccess, assertHouseAccess, farmHasActiveExpert, findFarmOrThrow, hasFarmAccess, listAssignedHouseIds } from '@/utils/farmAccess.util'
import type { IFarm } from '@/models/farm.model'
import { paginate } from '@/utils/helpers.util'
import logger from '@/utils/logger.util'
import {
  RECOMMENDATION_EFFECT_DAYS, RECOMMENDATION_EXPIRY_DAYS, dayOffset, lastDates, measureEffect, parseRuleInput, ruleHolds,
  type DayValue, type RuleIndicator,
} from '@/utils/recommendationRule.util'
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '@/utils/appError.util'
import type { CurrentUser } from '@/types'

// xét luật mỗi ngày sau đánh giá ngày, đo hiệu quả 7 ngày sau khi chấp nhận

const DAY_MS = 86_400_000
const vnDayStart = (date: string) => new Date(`${date}T00:00:00+07:00`)

async function loadRule(ruleId: string, user: CurrentUser) {
  const rule = await RecommendationRule.findById(ruleId)
  if (!rule) throw NotFoundError('Không tìm thấy luật khuyến nghị')
  const farm = await findFarmOrThrow(String(rule.farm_id))
  // Thợ và Admin đã bị chặn ở route
  if (!hasFarmAccess(farm, user)) throw ForbiddenError('Không có quyền trên farm này')
  return { rule, farm }
}

export async function listRules(farmId: string, user: CurrentUser, query: { page?: string; limit?: string } = {}) {
  const farm = await assertFarmAccess(farmId, user)
  const { page, skip, limit } = paginate(query.page, query.limit)
  const [records, total] = await Promise.all([
    RecommendationRule.find({ farm_id: farm._id }).sort({ updated_at: -1 }).skip(skip).limit(limit).lean(),
    RecommendationRule.countDocuments({ farm_id: farm._id }),
  ])
  return { records, total, page, limit }
}

// farm có chuyên gia thì luật của Farm Owner lưu tắt, chờ chuyên gia bật
async function ownerNeedsApproval(farm: IFarm, user: CurrentUser): Promise<boolean> {
  return user.role === 'FARM_OWNER' && (await farmHasActiveExpert(farm))
}

async function notifyRuleProposal(farm: IFarm, user: CurrentUser, rule: IRecommendationRule) {
  await notifyExpertsOfProposal(farm._id, user, {
    what: `đề xuất luật khuyến nghị "${rule.name}"`, body: 'Luật chỉ chạy khi chuyên gia bật.',
    ref: { kind: 'recommendation_rule', id: String(rule._id) },
  })
}

export async function createRule(user: CurrentUser, input: Record<string, unknown>) {
  const farm = await assertFarmAccess(String(input.farm_id), user)
  const parsed = parseRuleInput(input)
  const needsApproval = await ownerNeedsApproval(farm, user)
  const rule = await RecommendationRule.create({
    ...parsed, farm_id: farm._id, author_id: user._id,
    ...(needsApproval && { active: false, pending_approval: true }),
  })
  await logAction(user._id, 'RECOMMENDATION_RULE_CREATED', 'recommendation_rule', String(rule._id), { ...parsed }, { farmId: String(farm._id) })
  if (needsApproval) await notifyRuleProposal(farm, user, rule)
  return rule
}

// Khuyến nghị đã mở giữ nguyên bằng chứng lúc mở
export async function updateRule(ruleId: string, user: CurrentUser, input: Record<string, unknown>) {
  const { rule, farm } = await loadRule(ruleId, user)
  const needsApproval = await ownerNeedsApproval(farm, user)
  // Farm Owner chỉ sửa đề xuất của mình đang chờ duyệt
  if (needsApproval && !rule.pending_approval) throw ForbiddenError('Chỉ chuyên gia sửa hoặc bật, tắt luật này')
  const parsed = parseRuleInput(input, rule.active)
  const before = rule.toObject()
  // Chuyên gia chỉ sửa mà chưa bật thì đề xuất vẫn chờ duyệt, không rơi khỏi hàng đợi việc
  const stillPending = user.role === 'DOMAIN_EXPERT' && rule.pending_approval && !parsed.active
  // Ghi có điều kiện: chuyên gia vừa bật/tắt thì 409, không để nội dung chưa duyệt chạy
  const saved = await RecommendationRule.findOneAndUpdate(
    needsApproval ? { _id: rule._id, pending_approval: true, active: false } : { _id: rule._id },
    needsApproval ? { ...parsed, active: false, pending_approval: true } : { ...parsed, pending_approval: stillPending },
    { new: true, runValidators: true },
  )
  if (!saved) throw ConflictError('Chuyên gia vừa quyết định luật này, tải lại trang')
  await logAction(user._id, 'RECOMMENDATION_RULE_UPDATED', 'recommendation_rule', String(rule._id), {
    before: {
      name: before.name, indicator: before.indicator, comparison: before.comparison, value: before.value,
      window_days: before.window_days, action: before.action, active: before.active,
    },
    after: parsed,
  }, { farmId: String(farm._id) })
  if (needsApproval) await notifyRuleProposal(farm, user, saved)
  return saved
}

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

// Thợ và chuyên gia chỉ đọc
export async function listRecommendations(
  user: CurrentUser, query: { farmId?: string; houseId?: string; status?: string; page?: string; limit?: string },
) {
  const filter: Record<string, unknown> = {}
  if (query.houseId) filter.house_id = (await assertHouseAccess(query.houseId, user)).house._id
  else if (user.role === 'FARM_TECHNICIAN') {
    // Thợ theo trại: chỉ các nhà được giao, như phiếu công việc và bảo trì; farm không giao nhà nào thì rỗng, không 403
    filter.house_id = { $in: await listAssignedHouseIds(user) }
    filter.farm_id = new Types.ObjectId(String(query.farmId))
  } else filter.farm_id = (await assertFarmAccess(String(query.farmId), user))._id
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

// Ghi có điều kiện: quyết định sau nhận 409
async function decide(id: Types.ObjectId, set: Partial<IRecommendation>) {
  const updated = await Recommendation.findOneAndUpdate({ _id: id, status: 'OPEN' }, set, { new: true })
  if (!updated) throw ConflictError('Khuyến nghị không còn mở (đã quyết định hoặc đã hết hạn)')
  return updated
}

// Thay đổi tham số đi như Farm Owner tự sửa, nên có mục duyệt. Lỗi thì khuyến nghị mở lại
export async function acceptRecommendation(id: string, user: CurrentUser) {
  const { recommendation: current, house, farm } = await loadRecommendation(id, user)
  const rule = await snapshotOf(current)
  const action = rule.action
  // Kiểm mọi zone trước khi đổi: một zone sai thì không sửa dở nửa nhà. Không lean để có default của schema
  const zones = action.type === 'PARAMETER_CHANGE' ? await Zone.find({ house_id: house._id }) : []
  if (action.type === 'PARAMETER_CHANGE') {
    if (zones.length === 0) throw BadRequestError('Nhà chưa có zone nào để đổi tham số')
    const updates = { [action.key]: action.value }
    for (const zone of zones) {
      if (action.group === 'thresholds') assertValidThresholds({ ...zone.thresholds, ...pickThresholds(updates) })
      else assertValidFuzzyTuning({ ...zone.fuzzy_tuning, ...pickFuzzyTuning(updates) })
    }
  }
  const acceptStart = new Date()
  // Chỉ lỗi hạ tầng mới dừng giữa chừng: ghi log các zone đã đổi vì không hoàn tác được cấu hình đã gửi
  const applied: string[] = []
  const recommendation = await decide(current._id, { status: 'ACCEPTED', decided_by: user._id as never, decided_at: acceptStart })
  try {
    if (action.type === 'WORK_ORDER') {
      // Lần trước có thể đã mở Work Order rồi lỗi: dùng lại
      const wo = await WorkOrder.findOne({ recommendation_id: recommendation._id }).select('_id').lean()
        ?? await createManualWorkOrder(user, {
          house_id: String(house._id), title: action.title, recommendation_id: String(recommendation._id),
          description: `Khuyến nghị từ luật "${rule.name}" (${describeCondition(rule)})`,
        })
      recommendation.work_order_id = wo._id as never
    } else {
      const updates = { [action.key]: action.value }
      for (const zone of zones) {
        if (action.group === 'thresholds') await updateZoneThresholds(String(zone._id), user, updates)
        else await updateZoneFuzzyTuning(String(zone._id), user, updates)
        applied.push(String(zone._id))
      }
      // Chỉ các mục duyệt của lần chấp nhận này
      const reviews = await ParameterReview.find({
        zone_id: { $in: zones.map(z => z._id) }, group: action.group, status: 'PENDING_REVIEW', updated_at: { $gte: acceptStart },
      }).select('_id').lean()
      recommendation.review_ids = reviews.map(r => r._id) as never
    }
    await recommendation.save()
  } catch (err) {
    if (applied.length > 0) {
      logger.error('Chấp nhận khuyến nghị dừng giữa chừng, một số zone đã đổi tham số', {
        recommendationId: String(recommendation._id), appliedZoneIds: applied, err: (err as Error).message,
      })
    }
    await reopen(recommendation._id)
    throw err
  }
  await logAction(user._id, 'RECOMMENDATION_ACCEPTED', 'recommendation', String(recommendation._id), {
    rule_id: String(recommendation.rule_id), house_id: String(house._id), work_order_id: recommendation.work_order_id ? String(recommendation.work_order_id) : undefined,
    review_ids: recommendation.review_ids.map(String),
  }, { farmId: String(farm._id) })
  return recommendation
}

// Chỉ mở lại khi vẫn là ACCEPTED của lần này; không được thì ghi log để người gọi nhận lỗi gốc
async function reopen(id: Types.ObjectId) {
  try {
    await Recommendation.updateOne({ _id: id, status: 'ACCEPTED' }, { status: 'OPEN', $unset: { decided_by: 1, decided_at: 1 } })
  } catch (err) {
    logger.error('Không mở lại được khuyến nghị sau lỗi', { recommendationId: String(id), err: (err as Error).message })
  }
}

// Bản cũ chưa có snapshot thì đọc luật hiện tại
async function snapshotOf(recommendation: Pick<IRecommendation, 'rule_id' | 'rule_snapshot'>): Promise<RuleSnapshot> {
  if (recommendation.rule_snapshot) return recommendation.rule_snapshot
  const rule = await RecommendationRule.findById(recommendation.rule_id).lean()
  if (!rule) throw NotFoundError('Luật của khuyến nghị đã bị xoá')
  return rule
}

// Route chặn lý do rỗng (422)
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

const describeCondition = (rule: Pick<IRecommendationRule, 'indicator' | 'comparison' | 'value' | 'window_days'>) =>
  `${rule.indicator} ${rule.comparison === 'GTE' ? '≥' : '≤'} ${rule.value} trong ${rule.window_days} ngày`

// Giờ VN, gồm cả hai đầu
async function indicatorDays(indicator: RuleIndicator, house: Pick<IHouse, '_id'>, from: string, to: string): Promise<DayValue[]> {
  const dates = lastDates(to, Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1)
  // Thiếu ngày hoặc nguồn không đủ dữ liệu thì null
  const days = await HouseHealthDay.find({ house_id: house._id, date: { $gte: from, $lte: to } }).select('date indicators').lean()
  if (indicator === 'MISTING_INEFFECTIVE') {
    // Ngày chưa đánh giá là null, không phải 0, để luật "≤" không thoả trên ngày không có số
    const assessed = new Set(days.map(day => day.date))
    const zoneIds = (await Zone.find({ house_id: house._id }).select('_id').lean()).map(z => z._id)
    const alerts = await Alert.find({
      zone_id: { $in: zoneIds }, type: 'MISTING_INEFFECTIVE',
      created_at: { $gte: vnDayStart(from), $lt: new Date(vnDayStart(to).getTime() + DAY_MS) },
    }).select('created_at').lean()
    const counts = new Map<string, number>()
    for (const alert of alerts) counts.set(vnDate(alert.created_at), (counts.get(vnDate(alert.created_at)) ?? 0) + 1)
    return dates.map(date => ({ date, value: assessed.has(date) ? counts.get(date) ?? 0 : null }))
  }
  // theo giai đoạn của chính ngày ấy
  const stages = indicator === 'RETURN_RATE' ? (await House.findById(house._id).select('stage_history').lean())?.stage_history : undefined
  const byDate = new Map(days.map(day => {
    const i = day.indicators
    const value =
      indicator === 'TIME_IN_RANGE' ? i?.environment?.value
      : indicator === 'AIR_HOURS_OVER' ? i?.air?.value
      : indicator === 'NOISE_EPISODES' ? i?.noise?.value
      : stageOn(stages, day.date) === 'ATTRACTING' ? null : i?.flock?.details?.return_rate
    return [day.date, typeof value === 'number' ? value : null] as const
  }))
  return dates.map(date => ({ date, value: byDate.get(date) ?? null }))
}

// Lỗi ở một luật hay nhà không chặn cái khác
export async function evaluateRecommendationRules(date = vnDate(new Date()), now = new Date(), onlyHouseIds?: string[]): Promise<number> {
  const rules = await RecommendationRule.find({ active: true }).lean()
  // Farm.find ẩn farm đã xoá
  const liveFarms = new Set((await Farm.find({ _id: { $in: rules.map(r => r.farm_id) } }).select('_id').lean()).map(f => String(f._id)))
  let raised = 0
  for (const rule of rules.filter(r => liveFarms.has(String(r.farm_id)))) {
    const houses = await House.find({ farm_id: rule.farm_id, ...(onlyHouseIds && { _id: { $in: onlyHouseIds } }) }).select('_id name').lean()
    const windowStart = dayOffset(date, -(rule.window_days - 1))
    for (const house of houses) {
      try {
        if (await Recommendation.exists({ rule_id: rule._id, house_id: house._id, status: 'OPEN' })) continue
        // chỉ mở khi mọi ngày bằng chứng đều sau lần quyết định trước
        const last = await Recommendation.findOne({ rule_id: rule._id, house_id: house._id, status: { $ne: 'OPEN' } })
          .sort({ raised_at: -1 }).select('decided_at expired_at raised_at').lean()
        if (last && windowStart <= vnDate(last.decided_at ?? last.expired_at ?? last.raised_at)) continue
        const days = await indicatorDays(rule.indicator, house, windowStart, date)
        const evidence = ruleHolds(rule, days, date)
        if (!evidence) continue
        const recommendation = await Recommendation.create({
          farm_id: rule.farm_id, house_id: house._id, rule_id: rule._id, raised_at: now, raised_for: date,
          rule_snapshot: {
            name: rule.name, indicator: rule.indicator, comparison: rule.comparison, value: rule.value, window_days: rule.window_days, action: rule.action,
          },
          evidence: { indicator: rule.indicator, comparison: rule.comparison, value: rule.value, window_days: rule.window_days, days: evidence },
        })
        raised++
        emitRecommendationNew(String(house._id), {
          _id: String(recommendation._id), house_id: String(house._id), rule_name: rule.name, raised_for: date,
        })
        for (const owner of await findRecipients(String(rule.farm_id))) {
          await createInAppNotification(String(owner._id), {
            title: `Khuyến nghị mới cho nhà "${house.name}"`,
            body: `Luật "${rule.name}": ${describeCondition(rule)}. Mở mục Khuyến nghị để chấp nhận hoặc từ chối.`,
          })
        }
      } catch (err) {
        // Trùng unique index (job chạy chồng) là bình thường
        if ((err as { code?: number }).code !== 11000) {
          logger.error('Xét luật khuyến nghị thất bại', { ruleId: String(rule._id), houseId: String(house._id), err: (err as Error).message })
        }
      }
    }
  }
  return raised
}

export async function expireRecommendations(now = new Date()): Promise<number> {
  const { modifiedCount } = await Recommendation.updateMany(
    { status: 'OPEN', raised_at: { $lte: new Date(now.getTime() - RECOMMENDATION_EXPIRY_DAYS * DAY_MS) } },
    { status: 'EXPIRED' satisfies RecommendationStatus, expired_at: now },
  )
  return modifiedCount
}

export async function measureRecommendationEffects(now = new Date()): Promise<number> {
  const due = await Recommendation.find({
    status: 'ACCEPTED', decided_at: { $lte: new Date(now.getTime() - RECOMMENDATION_EFFECT_DAYS * DAY_MS) },
  })
  let measured = 0
  for (const recommendation of due) {
    try {
      const acceptedDate = vnDate(recommendation.decided_at!)
      // Ngày thứ 7 được tính lại đủ dữ liệu trễ hôm sau, nên đo từ ngày thứ 9
      if (vnDate(now) <= dayOffset(acceptedDate, RECOMMENDATION_EFFECT_DAYS + 1)) continue
      const rule = await snapshotOf(recommendation)
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
