import { Alert } from '@/models/alert.model'
import { HarvestCycle } from '@/models/harvestCycle.model'
import { HouseHealthReport } from '@/models/houseHealthReport.model'
import { House } from '@/models/houseZone.model'
import { INFERRED_ALERT_TYPES } from '@/services/alert.service'
import { logAction } from '@/services/auditLog.service'
import { notifyExpertsOfProposal } from '@/services/notification.service'
import { assertFarmAccess, farmHasActiveExpert } from '@/utils/farmAccess.util'
import { BadRequestError, ConflictError, NotFoundError } from '@/utils/appError.util'
import type { CurrentUser } from '@/types'

export const REMINDER_KINDS = ['alert', 'health_report', 'harvest_cycle'] as const
export type ReminderKind = typeof REMINDER_KINDS[number]

// Ghi có điều kiện: hai lần bấm cùng lúc chỉ một lần thành công
const notYet = (id: string) => ({ _id: id, expert_reminded_at: { $exists: false } })

/** Việc chỉ chuyên gia làm (nhóm C) mà Farm Owner nhắc được: farm, nơi, câu nhắc và việc đã xong chưa */
async function loadTask(kind: ReminderKind, id: string) {
  if (kind === 'alert') {
    const alert = await Alert.findById(id).select('farm_id house_id type expert_verdict').lean()
    if (!alert) throw NotFoundError('Không tìm thấy cảnh báo')
    if (!INFERRED_ALERT_TYPES.includes(alert.type)) throw BadRequestError('Chỉ cảnh báo suy luận mới cần chuyên gia kết luận')
    return { farmId: alert.farm_id, houseId: alert.house_id, done: Boolean(alert.expert_verdict), what: 'nhờ kết luận một cảnh báo suy luận', mark: (at: Date) => Alert.updateOne(notYet(id), { expert_reminded_at: at }) }
  }
  if (kind === 'health_report') {
    const report = await HouseHealthReport.findById(id).select('farm_id house_id expert_conclusion').lean()
    if (!report) throw NotFoundError('Không tìm thấy báo cáo')
    return { farmId: report.farm_id, houseId: report.house_id, done: Boolean(report.expert_conclusion), what: 'nhờ viết kết luận báo cáo sức khoẻ', mark: (at: Date) => HouseHealthReport.updateOne(notYet(id), { expert_reminded_at: at }) }
  }
  const cycle = await HarvestCycle.findById(id).select('farm_id house_id status conclusion').lean()
  if (!cycle) throw NotFoundError('Không tìm thấy chu kỳ thu hoạch')
  // Chỉ chu kỳ đã đóng mới chờ kết luận (SF-06)
  if (cycle.status === 'OPEN') throw ConflictError('Chu kỳ chưa đóng, chưa cần kết luận')
  return { farmId: cycle.farm_id, houseId: cycle.house_id, done: Boolean(cycle.conclusion), what: 'nhờ viết kết luận mùa vụ', mark: (at: Date) => HarvestCycle.updateOne(notYet(id), { expert_reminded_at: at }) }
}

/**
 * BR-22 (Report 3 4.2.15) — Farm Owner nhắc Domain Expert một việc chỉ chuyên gia làm (kết luận cảnh báo suy luận,
 * kết luận báo cáo sức khoẻ, kết luận mùa vụ): báo trong ứng dụng cho chuyên gia của farm, mỗi việc nhắc một lần.
 * Việc đã xong, farm chưa có chuyên gia hoặc đã nhắc → 409.
 */
export async function remindExpert(user: CurrentUser, kind: ReminderKind, id: string) {
  const task = await loadTask(kind, id)
  const farm = await assertFarmAccess(String(task.farmId), user)
  if (task.done) throw ConflictError('Chuyên gia đã làm việc này')
  if (!(await farmHasActiveExpert(farm))) throw ConflictError('Farm chưa có chuyên gia')

  const remindedAt = new Date()
  const { modifiedCount } = await task.mark(remindedAt)
  if (modifiedCount === 0) throw ConflictError('Đã nhắc chuyên gia việc này')

  const house = task.houseId ? await House.findById(task.houseId).select('name').lean() : null
  await notifyExpertsOfProposal(farm._id, user, {
    prefix: 'Nhắc việc', what: task.what,
    body: house ? `Nhà "${house.name}"` : `Trang trại "${farm.name}"`,
    ref: { kind, id },
  })
  await logAction(user._id, 'EXPERT_REMINDED', kind, id, { kind }, { farmId: String(farm._id) })
  return { kind, id, expert_reminded_at: remindedAt }
}
