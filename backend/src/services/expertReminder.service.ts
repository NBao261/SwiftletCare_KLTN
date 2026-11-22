import { Types } from 'mongoose'
import { Alert } from '@/models/alert.model'
import { HarvestCycle } from '@/models/harvestCycle.model'
import { HouseHealthReport } from '@/models/houseHealthReport.model'
import { House } from '@/models/houseZone.model'
import { INFERRED_ALERT_TYPES } from '@/services/alert.service'
import { logAction } from '@/services/auditLog.service'
import { notifyExpertsOfProposal } from '@/services/notification.service'
import { assertFarmAccess, farmHasActiveExpert } from '@/utils/farmAccess.util'
import { BadRequestError, ConflictError, NotFoundError, ServiceUnavailableError } from '@/utils/appError.util'
import type { CurrentUser } from '@/types'

export const REMINDER_KINDS = ['alert', 'health_report', 'harvest_cycle'] as const
export type ReminderKind = typeof REMINDER_KINDS[number]

// Có điều kiện: hai lần bấm cùng lúc chỉ một lần thành công
const notYet = (id: string) => ({ _id: new Types.ObjectId(id), expert_reminded_at: { $exists: false } })

function reminderMarks(model: typeof Alert | typeof HouseHealthReport | typeof HarvestCycle, id: string) {
  const collection = model.collection
  return {
    mark: (at: Date) => collection.updateOne(notYet(id), { $set: { expert_reminded_at: at } }),
    unmark: () => collection.updateOne({ _id: new Types.ObjectId(id) }, { $unset: { expert_reminded_at: 1 } }),
  }
}

// Gọi sau khi kiểm quyền để không lộ trạng thái của farm khác
async function loadTask(kind: ReminderKind, id: string) {
  if (kind === 'alert') {
    const alert = await Alert.findById(id).select('farm_id house_id type expert_verdict').lean()
    if (!alert) throw NotFoundError('Không tìm thấy cảnh báo')
    return {
      farmId: alert.farm_id, houseId: alert.house_id, what: 'nhờ kết luận một cảnh báo suy luận', ...reminderMarks(Alert, id),
      check: () => {
        if (!INFERRED_ALERT_TYPES.includes(alert.type)) throw BadRequestError('Chỉ cảnh báo suy luận mới cần chuyên gia kết luận')
        if (alert.expert_verdict) throw ConflictError('Chuyên gia đã làm việc này')
      },
    }
  }
  if (kind === 'health_report') {
    const report = await HouseHealthReport.findById(id).select('farm_id house_id expert_conclusion').lean()
    if (!report) throw NotFoundError('Không tìm thấy báo cáo')
    return {
      farmId: report.farm_id, houseId: report.house_id, what: 'nhờ viết kết luận báo cáo sức khoẻ', ...reminderMarks(HouseHealthReport, id),
      check: () => {
        if (report.expert_conclusion) throw ConflictError('Chuyên gia đã làm việc này')
      },
    }
  }
  const cycle = await HarvestCycle.findById(id).select('farm_id house_id status conclusion').lean()
  if (!cycle) throw NotFoundError('Không tìm thấy chu kỳ thu hoạch')
  return {
    farmId: cycle.farm_id, houseId: cycle.house_id, what: 'nhờ viết kết luận mùa vụ', ...reminderMarks(HarvestCycle, id),
    check: () => {
      if (cycle.status === 'OPEN') throw ConflictError('Chu kỳ chưa đóng, chưa cần kết luận')
      if (cycle.conclusion) throw ConflictError('Chuyên gia đã làm việc này')
    },
  }
}

// Không gửi được thông báo nào → 503 và trả lại lượt nhắc
export async function remindExpert(user: CurrentUser, kind: ReminderKind, id: string) {
  const task = await loadTask(kind, id)
  const farm = await assertFarmAccess(String(task.farmId), user)
  task.check()
  if (!(await farmHasActiveExpert(farm))) throw ConflictError('Farm chưa có chuyên gia')

  const remindedAt = new Date()
  const { modifiedCount } = await task.mark(remindedAt)
  if (modifiedCount === 0) throw ConflictError('Đã nhắc chuyên gia việc này')

  const house = task.houseId ? await House.findById(task.houseId).select('name').lean() : null
  const sent = await notifyExpertsOfProposal(farm._id, user, {
    prefix: 'Nhắc việc', what: task.what,
    body: house ? `Nhà "${house.name}"` : `Trang trại "${farm.name}"`,
    ref: { kind, id },
  })
  if (sent === 0) {
    await task.unmark()
    throw ServiceUnavailableError('Chưa gửi được lời nhắc, thử lại sau')
  }
  await logAction(user._id, 'EXPERT_REMINDED', kind, id, { kind }, { farmId: String(farm._id) })
  return { kind, id, expert_reminded_at: remindedAt }
}
