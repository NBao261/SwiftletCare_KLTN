import { ParameterReview, type ParameterGroup } from '@/models/parameterReview.model'
import { User } from '@/models/user.model'
import { createInAppNotification, findFarmExperts } from '@/services/notification.service'
import { farmHasActiveExpert } from '@/utils/farmAccess.util'
import logger from '@/utils/logger.util'
import type { IFarm } from '@/models/farm.model'
import type { IZone } from '@/models/houseZone.model'
import type { CurrentUser } from '@/types'

/**
 * Hook gọi SAU khi ngưỡng hoặc hệ số mờ của 1 Zone đã được áp dụng (thresholdUpdate.util,
 * farm.service#applyFuzzyTuning). Cố tình không import nơi áp giá trị (thresholdUpdate.util) để
 * không tạo import vòng — phần hoàn lại nằm ở expertReview.service.
 *
 * EXPERT-FR-010, Report 3 §6.10:
 * - Farm Owner sửa trên farm có Domain Expert → mở 1 mục PENDING_REVIEW (báo chuyên gia trong ứng
 *   dụng); đã có mục đang chờ cùng nhóm thì chỉ cập nhật giá trị mới, giữ giá trị gốc;
 * - Domain Expert sửa cùng nhóm → mục đang chờ đóng ADJUSTED;
 * - farm chưa có chuyên gia → không mở gì (BR-22).
 * Không throw: mục duyệt hỏng không được làm hỏng thay đổi đã áp dụng.
 */
export async function trackParameterChange(
  chain: { zone: IZone; farm: IFarm },
  user: CurrentUser,
  group: ParameterGroup,
  before: object,
  after: object,
): Promise<void> {
  const { zone, farm } = chain
  try {
    if (user.role === 'DOMAIN_EXPERT') {
      await ParameterReview.updateOne(
        { zone_id: zone._id, group, status: 'PENDING_REVIEW' },
        { status: 'ADJUSTED', reviewed_by: user._id, reviewed_at: new Date() },
      )
      return
    }
    if (user.role !== 'FARM_OWNER' || !(await farmHasActiveExpert(farm))) return

    const updateOpen = () => ParameterReview.findOneAndUpdate(
      { zone_id: zone._id, group, status: 'PENDING_REVIEW' },
      { new_values: after, changed_by: user._id },
    )
    if (await updateOpen()) return

    let review
    try {
      review = await ParameterReview.create({
        zone_id: zone._id, farm_id: farm._id, group, old_values: before, new_values: after, changed_by: user._id,
      })
    } catch (err) {
      // 2 lần sửa đầu tiên tới cùng lúc: lần kia vừa mở mục (unique index) — ghi giá trị mới vào mục đó
      if ((err as { code?: number }).code !== 11000) throw err
      await updateOpen()
      return
    }
    await notifyExpertsOfReview(farm._id, user, group, zone.name, String(review._id))
  } catch (err) {
    logger.warn('Ghi mục duyệt thay đổi của Farm Owner thất bại', { err, zoneId: String(zone._id), group })
  }
}

const GROUP_LABEL: Record<ParameterGroup, string> = { thresholds: 'ngưỡng', fuzzy: 'hệ số điều khiển mờ' }

/** EXPERT-FR-007 — mục duyệt mới chỉ báo trong ứng dụng cho Domain Expert của farm */
async function notifyExpertsOfReview(farmId: unknown, owner: CurrentUser, group: ParameterGroup, zoneName: string, reviewId: string) {
  const [experts, author] = await Promise.all([
    findFarmExperts(farmId), User.findById(owner._id).select('full_name').lean(),
  ])
  await Promise.all(experts.map(expertId => createInAppNotification(expertId, {
    title: `Cần duyệt: ${author?.full_name ?? owner.email} đã sửa ${GROUP_LABEL[group]}`,
    body: `Khu vực "${zoneName}" — thay đổi đã được áp dụng, chờ chuyên gia chấp nhận, hoàn lại hoặc chỉnh lại.`,
    ref: { kind: 'parameter_review', id: reviewId },
  })))
}
