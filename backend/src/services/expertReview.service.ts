import { ParameterReview, IParameterReview, type ParameterReviewStatus } from '@/models/parameterReview.model'
import { logAction } from '@/services/auditLog.service'
import { formatChanges, notifyExpertDecision } from '@/services/expertActivity.service'
import { applyFuzzyTuning, updateHouseBirdCountTuning, updateHouseHealthLevels, updateZoneDetectionTuning } from '@/services/farm.service'
import { updateCountingSchedule } from '@/services/countingSchedule.service'
import { updateCountingRing } from '@/services/device.service'
import { GROUP_LABEL } from '@/services/parameterReview.service'
import { CameraNode } from '@/models/device.model'
import { House, Zone } from '@/models/houseZone.model'
import { assertFarmAccess, assertZoneAccess } from '@/utils/farmAccess.util'
import { assertValidFuzzyTuning, pickFuzzyTuning } from '@/utils/fuzzyTuning.util'
import { paginate } from '@/utils/helpers.util'
import logger from '@/utils/logger.util'
import { assertValidThresholds, pickThresholds } from '@/utils/thresholds.util'
import { applyThresholdUpdate } from '@/utils/thresholdUpdate.util'
import { ConflictError, ForbiddenError, NotFoundError } from '@/utils/appError.util'
import type { CountingRing, CurrentUser, Thresholds } from '@/types'


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

/** Mục duyệt đã kiểm: Domain Expert của farm, mục còn chờ (Report 3 §6.10) */
async function loadPendingReview(reviewId: string, user: CurrentUser) {
  const review = await ParameterReview.findById(reviewId)
  if (!review) throw NotFoundError('Không tìm thấy mục duyệt')
  const farm = await assertFarmAccess(String(review.farm_id), user)
  if (user.role !== 'DOMAIN_EXPERT') throw ForbiddenError('Chỉ Domain Expert duyệt thay đổi của Farm Owner')
  if (review.status !== 'PENDING_REVIEW') throw ConflictError('Mục duyệt này đã đóng')
  return { review, farm }
}

/** Nơi của mục duyệt trong thông báo: Zone, camera hoặc nhà */
async function placeOf(review: IParameterReview): Promise<string> {
  if (review.zone_id) return `Zone "${(await Zone.findById(review.zone_id).select('name').lean())?.name ?? ''}"`
  if (review.camera_node_id) return `Camera ${(await CameraNode.findById(review.camera_node_id).select('device_id').lean())?.device_id ?? ''}`
  return `Nhà "${(await House.findById(review.house_id).select('name').lean())?.name ?? ''}"`
}

// Lịch đếm và vòng đếm là cấu trúc lồng nhau: thông báo không liệt kê từng giá trị
const detailOf = (review: IParameterReview, before: object, after: object) =>
  (review.group === 'counting_schedule' || review.group === 'counting_ring' ? undefined : formatChanges(before, after))

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

const targetIds = (review: IParameterReview) => ({
  ...(review.zone_id && { zone_id: String(review.zone_id) }),
  ...(review.house_id && { house_id: String(review.house_id) }),
  ...(review.camera_node_id && { camera_node_id: String(review.camera_node_id) }),
})

/** EXPERT-FR-010 — chuyên gia chấp nhận thay đổi của Farm Owner: PENDING_REVIEW → ACCEPTED, báo Farm Owner */
export async function acceptReview(reviewId: string, user: CurrentUser) {
  const { review, farm } = await loadPendingReview(reviewId, user)
  const closed = await closeReview(review, user, 'ACCEPTED')

  const auditId = await logAction(user._id, 'REVIEW_ACCEPTED', 'parameter_review', String(review._id), {
    group: review.group, ...targetIds(review), before: review.old_values, after: review.new_values,
  }, { farmId: String(farm._id) })
  await notifyExpertDecision(user, farm._id, auditId, {
    what: `giữ thay đổi ${GROUP_LABEL[review.group]} của chủ nhà yến`,
    place: await placeOf(review),
    detail: detailOf(review, review.old_values, review.new_values),
  })
  return closed
}

/** Áp lại giá trị gốc của mục bằng chính hàm cập nhật của nhóm, với vai trò chuyên gia (thiết bị nhận lại cấu hình) */
async function applyOldValues(review: IParameterReview, user: CurrentUser, current: object) {
  const old = review.old_values
  const opts = { fromReview: true }
  const what = `hoàn tác ${GROUP_LABEL[review.group]}`
  // Lịch sử hoạt động chuyên gia chỉ hiện REVIEW_REVERTED, không thêm dòng đổi Zone (EXPERT-FR-009)
  const logDetails = { decided_in: 'parameter_review' }
  switch (review.group) {
    case 'thresholds': {
      const chain = await assertZoneAccess(String(review.zone_id), user)
      const restored = { ...current, ...pickThresholds(old) } as Thresholds
      await applyThresholdUpdate(chain, user, { thresholds: restored, historyValues: restored, source: 'EXPERT_REVERT', logDetails })
      return
    }
    case 'fuzzy':
      await applyFuzzyTuning(await assertZoneAccess(String(review.zone_id), user), user, pickFuzzyTuning(old), 'EXPERT_REVERT', { logDetails })
      return
    case 'detection':
      await updateZoneDetectionTuning(String(review.zone_id), user, old, what, opts)
      return
    case 'return_rate_drop':
      await updateHouseBirdCountTuning(String(review.house_id), user, old, what, opts)
      return
    case 'health_levels':
      await updateHouseHealthLevels(String(review.house_id), user, old, opts)
      return
    case 'counting_schedule':
      await updateCountingSchedule(String(review.house_id), user, old, opts)
      return
    case 'counting_ring':
      await updateCountingRing(String(review.camera_node_id), user, old.ring as CountingRing, opts)
  }
}

/**
 * EXPERT-FR-010 — chuyên gia hoàn lại thay đổi của Farm Owner: khôi phục giá trị gốc (trước lần sửa đầu tiên), gửi
 * xuống thiết bị (controller của Zone hoặc nút AI của camera); PENDING_REVIEW → REVERTED, báo Farm Owner. Kiểm giá trị
 * trước, đóng mục rồi mới áp: chuyên gia khác vừa chấp nhận thì 409 và không bị hoàn tác; áp lỗi thì mở lại mục.
 */
export async function revertReview(reviewId: string, user: CurrentUser) {
  const { review, farm } = await loadPendingReview(reviewId, user)
  let current: object = review.new_values
  if (review.group === 'thresholds' || review.group === 'fuzzy') {
    const zone = (await assertZoneAccess(String(review.zone_id), user)).zone.toObject()
    current = review.group === 'thresholds' ? zone.thresholds : zone.fuzzy_tuning
    if (review.group === 'thresholds') assertValidThresholds({ ...current, ...pickThresholds(review.old_values) } as Thresholds)
    else assertValidFuzzyTuning({ ...zone.fuzzy_tuning, ...pickFuzzyTuning(review.old_values) })
  }
  // Camera chưa có vòng trước lần vẽ của Farm Owner: không có gì để trả về, chuyên gia vẽ lại thay vì hoàn tác
  if (review.group === 'counting_ring' && !review.old_values.ring) {
    throw ConflictError('Camera chưa có vòng đếm trước thay đổi này, hãy vẽ lại vòng thay vì hoàn tác')
  }

  const closed = await closeReview(review, user, 'REVERTED')
  try {
    await applyOldValues(review, user, current)
  } catch (err) {
    await ParameterReview.updateOne(
      { _id: review._id, status: 'REVERTED' },
      { status: 'PENDING_REVIEW', $unset: { reviewed_by: 1, reviewed_at: 1 } },
    ).catch((reopenErr: Error) => logger.warn('Mở lại mục duyệt sau khi hoàn lại lỗi thất bại', { err: reopenErr, reviewId }))
    throw err
  }

  const auditId = await logAction(user._id, 'REVIEW_REVERTED', 'parameter_review', String(review._id), {
    group: review.group, ...targetIds(review), before: current, after: review.old_values,
  }, { farmId: String(farm._id) })
  await notifyExpertDecision(user, farm._id, auditId, {
    what: `hoàn tác thay đổi ${GROUP_LABEL[review.group]} của chủ nhà yến`,
    place: await placeOf(review),
    detail: detailOf(review, current, review.old_values),
  })
  return closed
}
