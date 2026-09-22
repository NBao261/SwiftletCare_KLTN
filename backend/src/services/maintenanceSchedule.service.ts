import { MaintenanceSchedule, IMaintenanceSchedule } from '@/models/maintenanceSchedule.model'
import { assertFarmAccess, assertZoneAccess, listAccessibleFarmIds } from '@/utils/farmAccess.util'
import { createMaintenanceTicket } from '@/services/ticket.service'
import { logAction } from '@/services/auditLog.service'
import { paginate } from '@/utils/helpers.util'
import { NotFoundError, BadRequestError } from '@/utils/appError.util'
import logger from '@/utils/logger.util'
import type { CurrentUser } from '@/types'

const DAY_MS = 86400_000

export interface MaintenanceScheduleInput {
  farm_id?: string
  zone_id?: string
  description?: string
  interval_days?: number
  next_due_at?: string
  is_active?: boolean
}

function assertFutureDate(value: string): Date {
  const date = new Date(value)
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) throw BadRequestError('next_due_at phải ở tương lai')
  return date
}

/** Zone (nếu có) phải thuộc đúng farm của lịch — tránh ticket trỏ sang zone farm khác */
async function assertZoneInFarm(zoneId: string, farmId: string, user: CurrentUser): Promise<void> {
  const chain = await assertZoneAccess(zoneId, user)
  if (String(chain.farm._id) !== farmId) throw BadRequestError('zone_id không thuộc farm này')
}

/** TICKET-FR-013 — Farm Owner xem được lịch của farm mình, Technician/Admin theo phạm vi farm */
export async function listSchedules(user: CurrentUser, query: { farmId?: string; page?: string | number; limit?: string | number }) {
  const filter: Record<string, unknown> = {}
  if (query.farmId) {
    await assertFarmAccess(query.farmId, user)
    filter.farm_id = query.farmId
  } else {
    filter.farm_id = { $in: await listAccessibleFarmIds(user) }
  }
  const { page, skip, limit } = paginate(query.page, query.limit)
  const [records, total] = await Promise.all([
    MaintenanceSchedule.find(filter).sort({ next_due_at: 1 }).skip(skip).limit(limit).lean(),
    MaintenanceSchedule.countDocuments(filter),
  ])
  return { records, total, page, limit }
}

async function getOwnedSchedule(id: string, user: CurrentUser): Promise<IMaintenanceSchedule> {
  const schedule = await MaintenanceSchedule.findById(id)
  if (!schedule) throw NotFoundError('Không tìm thấy lịch bảo trì')
  await assertFarmAccess(String(schedule.farm_id), user)
  return schedule
}

export async function createSchedule(user: CurrentUser, input: MaintenanceScheduleInput): Promise<IMaintenanceSchedule> {
  const farmId = String(input.farm_id)
  await assertFarmAccess(farmId, user)
  if (input.zone_id) await assertZoneInFarm(input.zone_id, farmId, user)

  const schedule = await MaintenanceSchedule.create({
    farm_id: farmId,
    zone_id: input.zone_id,
    description: input.description,
    interval_days: input.interval_days,
    next_due_at: assertFutureDate(String(input.next_due_at)),
    created_by: user._id,
  })
  await logAction(user._id, 'MAINTENANCE_SCHEDULE_CREATED', 'maintenance_schedule', String(schedule._id), {
    farmId, intervalDays: input.interval_days, nextDueAt: schedule.next_due_at,
  })
  return schedule
}

export async function updateSchedule(id: string, user: CurrentUser, input: MaintenanceScheduleInput): Promise<IMaintenanceSchedule> {
  const schedule = await getOwnedSchedule(id, user)
  const before = schedule.toObject()

  if (input.zone_id !== undefined) {
    await assertZoneInFarm(input.zone_id, String(schedule.farm_id), user)
    schedule.zone_id = input.zone_id as never
  }
  if (input.description !== undefined) schedule.description = input.description
  if (input.interval_days !== undefined) schedule.interval_days = input.interval_days
  if (input.next_due_at !== undefined) schedule.next_due_at = assertFutureDate(input.next_due_at)
  if (input.is_active !== undefined) schedule.is_active = input.is_active
  await schedule.save()

  await logAction(user._id, 'MAINTENANCE_SCHEDULE_UPDATED', 'maintenance_schedule', id, {
    before: { interval_days: before.interval_days, next_due_at: before.next_due_at, is_active: before.is_active },
    after: { interval_days: schedule.interval_days, next_due_at: schedule.next_due_at, is_active: schedule.is_active },
  })
  return schedule
}

export async function deleteSchedule(id: string, user: CurrentUser): Promise<void> {
  const schedule = await getOwnedSchedule(id, user)
  await schedule.deleteOne()
  await logAction(user._id, 'MAINTENANCE_SCHEDULE_DELETED', 'maintenance_schedule', id, { farmId: String(schedule.farm_id) })
}

/**
 * TICKET-FR-013 — gọi mỗi giờ từ jobs/maintenanceSchedule.job.ts. Mỗi lịch đến
 * hạn được "giành" bằng findOneAndUpdate có điều kiện đúng `next_due_at` cũ:
 * 2 tiến trình chạy cùng lúc (VD 2 instance backend) chỉ 1 bên thắng nên không
 * tạo ticket trùng. Lịch bị trễ nhiều chu kỳ (server tắt lâu) chỉ tạo 1 ticket
 * rồi nhảy thẳng tới chu kỳ kế tiếp ở tương lai.
 */
export async function generateDueMaintenanceTickets(now = new Date()): Promise<number> {
  const due = await MaintenanceSchedule.find({ is_active: true, next_due_at: { $lte: now } }).lean()
  let created = 0

  for (const schedule of due) {
    const periods = Math.floor((now.getTime() - schedule.next_due_at.getTime()) / (schedule.interval_days * DAY_MS)) + 1
    const next = new Date(schedule.next_due_at.getTime() + periods * schedule.interval_days * DAY_MS)
    const claimed = await MaintenanceSchedule.findOneAndUpdate(
      { _id: schedule._id, next_due_at: schedule.next_due_at, is_active: true },
      { next_due_at: next, last_generated_at: now },
      { new: true },
    )
    if (!claimed) continue

    try {
      const ticket = await createMaintenanceTicket({
        farm_id: String(schedule.farm_id),
        zone_id: schedule.zone_id ? String(schedule.zone_id) : undefined,
        scheduled_visit_at: schedule.next_due_at,
        description: `Bảo trì định kỳ (mỗi ${schedule.interval_days} ngày): ${schedule.description}`,
      })
      await MaintenanceSchedule.updateOne({ _id: schedule._id }, { last_ticket_id: ticket._id })
      created++
    } catch (err) {
      logger.error('Tạo ticket bảo trì định kỳ thất bại', { scheduleId: String(schedule._id), err })
    }
  }
  return created
}
