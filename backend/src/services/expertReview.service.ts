import { ParameterReview, IParameterReview, type ParameterReviewStatus } from '@/models/parameterReview.model'
import { logAction } from '@/services/auditLog.service'
import { formatChanges, notifyExpertDecision } from '@/services/expertActivity.service'
import { applyFuzzyTuning } from '@/services/farm.service'
import { assertFarmAccess, assertZoneAccess } from '@/utils/farmAccess.util'
import { assertValidFuzzyTuning, pickFuzzyTuning } from '@/utils/fuzzyTuning.util'
import { paginate } from '@/utils/helpers.util'
import { assertValidThresholds, pickThresholds } from '@/utils/thresholds.util'
import { applyThresholdUpdate } from '@/utils/thresholdUpdate.util'
import { ConflictError, ForbiddenError, NotFoundError } from '@/utils/appError.util'
import type { CurrentUser, Thresholds } from '@/types'

const GROUP_LABEL = { thresholds: 'ngưỡng', fuzzy: 'hệ số điều khiển mờ' } as const

export interface ListReviewsQuery {
  farmId: string
  zoneId?: string
  status?: ParameterReviewStatus
  page?: string | number
  limit?: string | number
}

/** EXPERT-FR-010 — mục duyệt của 1 farm, mới nhất trước; chỉ Farm Owner và Domain Expert của farm */
export async function listReviews(user: CurrentUser, query: ListReviewsQuery) {
  const farm = await assertFarmAccess(query.farmId, user)
  const filter = {
    farm_id: farm._id,
    ...(query.zoneId && { zone_id: query.zoneId }),
    ...(query.status && { status: query.status }),
  }
  const { page, skip, limit } = paginate(query.page, query.limit)
  const [records, total] = await Promise.all([
    ParameterReview.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    ParameterReview.countDocuments(filter),
  ])
  return { records, total, page, limit }
}

/** Mục duyệt + Zone của nó, đã kiểm: Domain Expert của farm, mục còn chờ (Report 3 §6.10) */
async function loadPendingReview(reviewId: string, user: CurrentUser) {
  const review = await ParameterReview.findById(reviewId)
  if (!review) throw NotFoundError('Không tìm thấy mục duyệt')
  const chain = await assertZoneAccess(String(review.zone_id), user)
  if (user.role !== 'DOMAIN_EXPERT') throw ForbiddenError('Chỉ Domain Expert duyệt thay đổi của Farm Owner')
  if (review.status !== 'PENDING_REVIEW') throw ConflictError('Mục duyệt này đã đóng')
  return { review, chain }
}

/** Đóng mục đang chờ — có điều kiện để 2 thao tác cùng lúc chỉ 1 cái thành công */
async function closeReview(review: IParameterReview, user: CurrentUser, status: ParameterReviewStatus) {
  const closed = await ParameterReview.findOneAndUpdate(
    { _id: review._id, status: 'PENDING_REVIEW' },
    { status, reviewed_by: user._id, reviewed_at: new Date() },
    { new: true },
  )
  if (!closed) throw ConflictError('Mục duyệt này đã đóng')
  return closed
}

/** EXPERT-FR-010 — chuyên gia chấp nhận thay đổi của Farm Owner: PENDING_REVIEW → ACCEPTED, báo Farm Owner */
export async function acceptReview(reviewId: string, user: CurrentUser) {
  const { review, chain } = await loadPendingReview(reviewId, user)
  const closed = await closeReview(review, user, 'ACCEPTED')

  const auditId = await logAction(user._id, 'REVIEW_ACCEPTED', 'parameter_review', String(review._id), {
    group: review.group, zone_id: String(chain.zone._id), house_id: String(chain.house._id),
    before: review.old_values, after: review.new_values,
  }, { farmId: String(chain.farm._id) })
  await notifyExpertDecision(user, chain.farm._id, auditId, {
    what: `chấp nhận thay đổi ${GROUP_LABEL[review.group]} của Farm Owner`,
    place: `Khu vực "${chain.zone.name}"`,
    detail: formatChanges(review.old_values, review.new_values),
  })
  return closed
}

/**
 * EXPERT-FR-010 — chuyên gia hoàn lại thay đổi của Farm Owner: khôi phục giá trị gốc (trước lần sửa
 * đầu tiên), gửi xuống mọi thiết bị của Zone, lịch sử ghi EXPERT_REVERT; PENDING_REVIEW → REVERTED,
 * báo Farm Owner.
 */
export async function revertReview(reviewId: string, user: CurrentUser) {
  const { review, chain } = await loadPendingReview(reviewId, user)

  let current: object
  if (review.group === 'thresholds') {
    current = chain.zone.toObject().thresholds
    const restored = { ...current, ...pickThresholds(review.old_values) } as Thresholds
    assertValidThresholds(restored)
    await applyThresholdUpdate(chain, user, { thresholds: restored, historyValues: restored, source: 'EXPERT_REVERT' })
  } else {
    current = chain.zone.toObject().fuzzy_tuning
    const restored = pickFuzzyTuning(review.old_values)
    assertValidFuzzyTuning({ ...chain.zone.toObject().fuzzy_tuning, ...restored })
    await applyFuzzyTuning(chain, user, restored, 'EXPERT_REVERT')
  }
  const closed = await closeReview(review, user, 'REVERTED')

  const auditId = await logAction(user._id, 'REVIEW_REVERTED', 'parameter_review', String(review._id), {
    group: review.group, zone_id: String(chain.zone._id), house_id: String(chain.house._id),
    before: current, after: review.old_values,
  }, { farmId: String(chain.farm._id) })
  await notifyExpertDecision(user, chain.farm._id, auditId, {
    what: `hoàn lại thay đổi ${GROUP_LABEL[review.group]} của Farm Owner`,
    place: `Khu vực "${chain.zone.name}"`,
    detail: formatChanges(current, review.old_values),
  })
  return closed
}
