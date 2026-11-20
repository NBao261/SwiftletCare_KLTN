import { ParameterReview, type ParameterGroup } from '@/models/parameterReview.model'
import { User } from '@/models/user.model'
import { createInAppNotification, findFarmExperts } from '@/services/notification.service'
import { farmHasActiveExpert } from '@/utils/farmAccess.util'
import logger from '@/utils/logger.util'
import type { IFarm } from '@/models/farm.model'
import type { IZone } from '@/models/houseZone.model'
import type { CurrentUser } from '@/types'

/** Áp lại từ mục duyệt (chuyên gia hoàn tác): không báo Farm Owner hai lần, lịch sử chỉ hiện REVIEW_REVERTED */
export interface ReviewApplyOptions { fromReview?: boolean }

const ZONE_GROUPS: ParameterGroup[] = ['thresholds', 'fuzzy', 'detection']
const HOUSE_GROUPS: ParameterGroup[] = ['return_rate_drop', 'health_levels', 'counting_schedule']

/** Đối tượng của thay đổi: Zone (kèm nhà), nhà, hoặc camera (kèm nhà) — theo nhóm tham số */
export interface ReviewTarget {
  farm: IFarm
  zone?: Pick<IZone, '_id' | 'name'>
  house?: { _id: unknown; name: string }
  camera?: { _id: unknown; device_id: string }
}

function targetOf(target: ReviewTarget, group: ParameterGroup) {
  if (ZONE_GROUPS.includes(group)) {
    if (!target.zone) throw new Error(`Nhóm ${group} cần Zone`)
    return { id: target.zone._id, place: `Zone "${target.zone.name}"` }
  }
  if (HOUSE_GROUPS.includes(group)) {
    if (!target.house) throw new Error(`Nhóm ${group} cần nhà`)
    return { id: target.house._id, place: `Nhà "${target.house.name}"` }
  }
  if (!target.camera) throw new Error(`Nhóm ${group} cần camera`)
  return { id: target.camera._id, place: `Camera ${target.camera.device_id}` }
}

/**
 * Gọi SAU khi một thay đổi nhóm A (BR-22, Report 3 4.2.15) đã được áp dụng: ngưỡng, hệ số mờ, tham số phát hiện
 * của Zone; mức giảm tỷ lệ chim về, mức chỉ số sức khoẻ, lịch đếm của nhà; vòng đếm của camera. Cố tình không
 * import nơi áp giá trị để không tạo import vòng — phần hoàn lại nằm ở expertReview.service.
 *
 * EXPERT-FR-010, Report 3 §6.10:
 * - Farm Owner sửa trên farm có Domain Expert → mở 1 mục PENDING_REVIEW (báo chuyên gia trong ứng
 *   dụng); đã có mục đang chờ cùng đối tượng và nhóm thì chỉ cập nhật giá trị mới, giữ giá trị gốc;
 * - Domain Expert sửa cùng nhóm → mục đang chờ đóng ADJUSTED;
 * - farm chưa có chuyên gia, hoặc người sửa là Farm Technician (vòng đếm) → không mở gì.
 * Không throw: mục duyệt hỏng không được làm hỏng thay đổi đã áp dụng.
 */
export async function trackParameterChange(
  target: ReviewTarget,
  user: CurrentUser,
  group: ParameterGroup,
  before: object,
  after: object,
): Promise<void> {
  const { farm } = target
  try {
    const { id: targetId, place } = targetOf(target, group)
    if (user.role === 'DOMAIN_EXPERT') {
      await ParameterReview.updateOne(
        { target_id: targetId, group, status: 'PENDING_REVIEW' },
        { status: 'ADJUSTED', reviewed_by: user._id, reviewed_at: new Date() },
      )
      return
    }
    // Kỹ thuật viên vẽ lại vòng tại nhà: mục đang chờ ghi vòng mới, để chuyên gia duyệt đúng vòng đang chạy
    if (user.role === 'FARM_TECHNICIAN') {
      await ParameterReview.updateOne({ target_id: targetId, group, status: 'PENDING_REVIEW' }, { new_values: after })
      return
    }
    if (user.role !== 'FARM_OWNER' || !(await farmHasActiveExpert(farm))) return

    const updateOpen = () => ParameterReview.findOneAndUpdate(
      { target_id: targetId, group, status: 'PENDING_REVIEW' },
      { new_values: after, changed_by: user._id },
    )
    if (await updateOpen()) return
    // Lưu lại đúng giá trị đang có (hoặc đưa về mặc định khi đã ở mặc định): không có gì để chuyên gia duyệt
    if (JSON.stringify(before) === JSON.stringify(after)) return

    let review
    try {
      review = await ParameterReview.create({
        target_id: targetId, zone_id: target.zone?._id, house_id: target.house?._id, camera_node_id: target.camera?._id,
        farm_id: farm._id, group, old_values: before, new_values: after, changed_by: user._id,
      })
    } catch (err) {
      // 2 lần sửa đầu tiên tới cùng lúc: lần kia vừa mở mục (unique index) — ghi giá trị mới vào mục đó
      if ((err as { code?: number }).code !== 11000) throw err
      if (await updateOpen()) return
      // Trùng khoá mà không có mục nào của đối tượng này: chỉ mục cũ { zone_id, group } còn trong DB
      throw new Error('Chỉ mục cũ của mục duyệt còn: chạy npm run migrate:review-targets trước khi khởi động backend')
    }
    await notifyExpertsOfReview(farm._id, user, group, place, String(review._id))
  } catch (err) {
    logger.error('Ghi mục duyệt thay đổi của Farm Owner thất bại', { err, farmId: String(farm._id), group })
  }
}

export const GROUP_LABEL: Record<ParameterGroup, string> = {
  thresholds: 'ngưỡng',
  fuzzy: 'hệ số điều khiển mờ',
  detection: 'tham số phát hiện',
  return_rate_drop: 'mức giảm tỷ lệ chim về',
  health_levels: 'mức chỉ số sức khoẻ',
  counting_schedule: 'lịch đếm chim',
  counting_ring: 'vòng đếm',
}

/** EXPERT-FR-007 — mục duyệt mới chỉ báo trong ứng dụng cho Domain Expert của farm */
async function notifyExpertsOfReview(farmId: unknown, owner: CurrentUser, group: ParameterGroup, place: string, reviewId: string) {
  const [experts, author] = await Promise.all([
    findFarmExperts(farmId), User.findById(owner._id).select('full_name').lean(),
  ])
  await Promise.all(experts.map(expertId => createInAppNotification(expertId, {
    title: `Cần duyệt: ${author?.full_name ?? owner.email} đã sửa ${GROUP_LABEL[group]}`,
    body: `${place}: thay đổi đã được áp dụng, chờ chuyên gia giữ, hoàn tác hoặc chỉnh lại.`,
    ref: { kind: 'parameter_review', id: reviewId },
  })))
}
