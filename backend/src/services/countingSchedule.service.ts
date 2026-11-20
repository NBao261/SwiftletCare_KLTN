import type { IHouse } from '@/models/houseZone.model'
import { logAction } from '@/services/auditLog.service'
import { vnDate } from '@/services/birdCount.service'
import { pushHouseCameraConfigs } from '@/services/device.service'
import { notifyExpertDecision } from '@/services/expertActivity.service'
import {
  DEFAULT_WINDOWS, addDays, parseCountingSchedule, scheduleOn, windowsOn, type CountingSchedule,
} from '@/utils/countingSchedule.util'
import { assertHouseAccess } from '@/utils/farmAccess.util'
import { trackParameterChange, type ReviewApplyOptions } from '@/services/parameterReview.service'
import { THRESHOLD_HISTORY_LIMIT } from '@/utils/thresholdUpdate.util'
import type { CurrentUser } from '@/types'
import logger from '@/utils/logger.util'

/**
 * VISION-FR-019 — lịch đếm của nhà: Domain Expert đặt hồ sơ theo mùa và khung tạm (Farm Owner làm thay khi farm chưa
 * có chuyên gia, BR-22); Farm Owner, Domain Expert và thợ của nhà xem. Lịch mới áp từ ngày hôm sau, ngày đã tính giữ khung cũ.
 */

const EMPTY: CountingSchedule = { profiles: [], temporary: [] }

function present(house: IHouse) {
  const today = vnDate(new Date())
  const history = house.counting_schedule_history ?? []
  return {
    house_id: String(house._id),
    schedule: house.counting_schedule ?? EMPTY,
    // Lần sửa gần nhất áp từ ngày này; null khi nhà chưa đặt lịch (dùng khung mặc định)
    effective_from: history.at(-1)?.effective_from ?? null,
    default_windows: DEFAULT_WINDOWS,
    today: { date: today, ...windowsOn(scheduleOn(history, today), today) },
    history: history.map(version => ({
      effective_from: version.effective_from, changed_by: version.changed_by, changed_by_role: version.changed_by_role,
      changed_at: version.changed_at, schedule: version.schedule,
    })),
  }
}

export async function getCountingSchedule(houseId: string, user: CurrentUser) {
  const { house } = await assertHouseAccess(houseId, user)
  return present(house)
}

/** VISION-FR-019 — 400 khi lịch sai (countingSchedule.util); Farm Owner trên farm có chuyên gia thì mở mục duyệt (BR-22) */
export async function updateCountingSchedule(houseId: string, user: CurrentUser, input: unknown, opts: ReviewApplyOptions = {}) {
  const { house, farm } = await assertHouseAccess(houseId, user)
  const schedule = parseCountingSchedule(input)
  const before = house.counting_schedule ?? EMPTY
  const effectiveFrom = addDays(vnDate(new Date()), 1)

  house.counting_schedule = schedule
  house.markModified('counting_schedule')
  house.counting_schedule_history.push({
    schedule, effective_from: effectiveFrom, changed_by: user._id as never, changed_by_role: user.role, changed_at: new Date(),
  })
  const overflow = house.counting_schedule_history.length - THRESHOLD_HISTORY_LIMIT
  if (overflow > 0) house.counting_schedule_history.splice(0, overflow)
  await house.save()
  // Nút AI nhận khung mới ngay (áp từ ngày mai) để số trực tiếp theo đúng khung; mất kết nối thì nhận khi nối lại.
  // Lịch đã lưu: gửi lỗi chỉ ghi log, không làm mất audit và thông báo (job 00:05 gửi lại)
  try {
    await pushHouseCameraConfigs(house._id)
  } catch (err) {
    logger.warn('Gửi khung phiên mới cho nút AI thất bại', { houseId: String(house._id), err })
  }

  const auditId = await logAction(user._id, 'COUNTING_SCHEDULE_UPDATED', 'house', String(house._id), {
    before, after: schedule, effective_from: effectiveFrom, house_id: String(house._id),
    ...(opts.fromReview && { decided_in: 'parameter_review' }),
  }, { farmId: String(farm._id) })
  await trackParameterChange({ farm, house }, user, 'counting_schedule', before, schedule)
  if (!opts.fromReview) {
    await notifyExpertDecision(user, farm._id, auditId, {
      what: 'đổi lịch đếm chim', place: `Nhà "${house.name}"`,
      detail: `Áp từ ${effectiveFrom}: ${schedule.profiles.length} hồ sơ theo mùa, ${schedule.temporary.length} khung tạm`,
    })
  }
  return present(house)
}
