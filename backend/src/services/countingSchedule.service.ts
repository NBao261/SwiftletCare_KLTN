import type { IHouse } from '@/models/houseZone.model'
import { logAction } from '@/services/auditLog.service'
import { vnDate } from '@/services/birdCount.service'
import { pushHouseCameraConfigs } from '@/services/device.service'
import { notifyExpertDecision } from '@/services/expertActivity.service'
import {
  DEFAULT_WINDOWS, addDays, parseCountingSchedule, scheduleOn, windowsOn, type CountingSchedule, type TimeWindow,
} from '@/utils/countingSchedule.util'
import { assertHouseAccess } from '@/utils/farmAccess.util'
import { trackParameterChange, type ReviewApplyOptions } from '@/services/parameterReview.service'
import { THRESHOLD_HISTORY_LIMIT } from '@/utils/thresholdUpdate.util'
import type { CurrentUser } from '@/types'
import logger from '@/utils/logger.util'

// Lịch mới áp từ ngày hôm sau

const span = (window: TimeWindow) => `${window.start}–${window.end}`

// Chỉ đổi khung mặc định thì số hồ sơ, khung tạm không đổi: phải nói ra để Farm Owner biết có gì khác
function defaultsNote(before: CountingSchedule, after: CountingSchedule): string {
  if (JSON.stringify(before.default_windows ?? null) === JSON.stringify(after.default_windows ?? null)) return ''
  const own = after.default_windows
  return own ? `, khung mặc định của nhà sáng ${span(own.morning)}, chiều ${span(own.evening)}` : ', về khung mặc định hệ thống'
}

const EMPTY: CountingSchedule = { profiles: [], temporary: [] }

function present(house: IHouse) {
  const today = vnDate(new Date())
  const history = house.counting_schedule_history ?? []
  return {
    house_id: String(house._id),
    schedule: house.counting_schedule ?? EMPTY,
    effective_from: history.at(-1)?.effective_from ?? null,
    // Khung của nhà nếu đã đặt, không thì khung hệ thống; system_default_windows để nút về khung hệ thống
    default_windows: house.counting_schedule?.default_windows ?? DEFAULT_WINDOWS,
    system_default_windows: DEFAULT_WINDOWS,
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
  // Gửi lỗi chỉ ghi log: lịch đã lưu, job 00:05 gửi lại
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
      detail: `Áp từ ${effectiveFrom}: ${schedule.profiles.length} hồ sơ theo mùa, ${schedule.temporary.length} khung tạm${defaultsNote(before, schedule)}`,
    })
  }
  return present(house)
}
