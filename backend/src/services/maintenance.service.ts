import { Types } from 'mongoose'
import { Alert, OPEN_ALERT_STATUSES } from '@/models/alert.model'
import { SensorNode, IN_SERVICE } from '@/models/device.model'
import { House, Zone } from '@/models/houseZone.model'
import {
  IMaintenancePlan, MaintenanceBasis, MaintenanceEquipment, MaintenancePlan, MaintenancePlanState,
} from '@/models/maintenancePlan.model'
import { WorkOrder } from '@/models/workOrder.model'
import { createAlert } from '@/services/alert.service'
import { logAction } from '@/services/auditLog.service'
import { LOAD_OF_EQUIPMENT } from '@/services/maintenanceRecord.service'
import { findRecipients, notifyUser } from '@/services/notification.service'
import { openPreventiveWorkOrder } from '@/services/workOrder.service'
import { AppError, ConflictError, ForbiddenError, NotFoundError } from '@/utils/appError.util'
import {
  assertFarmAccess, assertHouseAccess, listAccessibleFarmIds, listAssignedHouseIds,
} from '@/utils/farmAccess.util'
import { paginate } from '@/utils/helpers.util'
import logger from '@/utils/logger.util'
import type { CurrentUser } from '@/types'

/** OPS-FR-006, Report 3 §4.5 — kế hoạch còn đến hạn quá chừng này thì báo Farm Owner (OVERDUE) */
export const MAINTENANCE_GRACE_DAYS = 7
const DAY_MS = 86_400_000

const EQUIPMENT_LABEL: Record<MaintenanceEquipment, string> = {
  PUMP: 'bơm phun sương', FAN: 'quạt thông gió', SENSOR: 'vệ sinh cảm biến', NOZZLE: 'vệ sinh béc phun', CALIBRATION: 'hiệu chuẩn cảm biến',
}
const UNIT: Record<MaintenanceBasis, string> = { RUN_HOURS: 'giờ chạy', SWITCHES: 'lần đóng cắt', CALENDAR: 'ngày' }

export interface MaintenancePlanInput {
  house_id: string
  equipment: MaintenanceEquipment
  basis: MaintenanceBasis
  interval: number
  checklist_template: string[]
  source: string
  note?: string
}

const invalid = (message: string) => new AppError(422, 'VALIDATION_ERROR', message)

/** OPS-FR-005 — bơm, quạt tính theo giờ chạy hoặc số lần đóng cắt; thiết bị khác theo lịch; khoảng phải dương */
function assertPlanShape(equipment: MaintenanceEquipment, basis: MaintenanceBasis, interval: number): void {
  const counted = equipment in LOAD_OF_EQUIPMENT
  if (counted && basis === 'CALENDAR') throw invalid('Bơm và quạt bảo trì theo giờ chạy hoặc số lần đóng cắt')
  if (!counted && basis !== 'CALENDAR') throw invalid('Vệ sinh và hiệu chuẩn bảo trì theo lịch (CALENDAR)')
  if (!(interval > 0)) throw invalid('Khoảng bảo trì phải lớn hơn 0')
}

// ── Kế hoạch (OPS-FR-005) ───────────────────────────────────────────────────

/** Farm Owner, Domain Expert theo farm; Farm Technician theo nhà được giao (chỉ đọc) */
async function findPlanWithAccess(id: string, user: CurrentUser): Promise<IMaintenancePlan> {
  const plan = await MaintenancePlan.findById(id)
  if (!plan) throw NotFoundError('Không tìm thấy kế hoạch bảo trì')
  if (user.role === 'FARM_TECHNICIAN') await assertHouseAccess(String(plan.house_id), user)
  else await assertFarmAccess(String(plan.farm_id), user)
  return plan
}

async function scopeFilter(user: CurrentUser, query: { farmId?: string; houseId?: string }): Promise<Record<string, unknown>> {
  const filter: Record<string, unknown> = {}
  if (user.role === 'FARM_TECHNICIAN') {
    filter.house_id = { $in: await listAssignedHouseIds(user) }
    if (query.farmId) filter.farm_id = query.farmId
  } else {
    const farmIds = await listAccessibleFarmIds(user)
    if (query.farmId && !farmIds.some(id => String(id) === query.farmId)) throw ForbiddenError('Không có quyền trên farm này')
    filter.farm_id = query.farmId ?? { $in: farmIds }
  }
  if (query.houseId) filter.$and = [{ house_id: new Types.ObjectId(query.houseId) }]
  return filter
}

export async function listPlans(
  user: CurrentUser, query: { farmId?: string; houseId?: string; state?: MaintenancePlanState; page?: number; limit?: number },
) {
  const filter = await scopeFilter(user, query)
  filter.state = query.state ?? { $ne: 'RETIRED' }
  const { page, skip, limit } = paginate(query.page, query.limit)
  const [records, total] = await Promise.all([
    MaintenancePlan.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    MaintenancePlan.countDocuments(filter),
  ])
  return { records, total, page, limit }
}

/** OPS-FR-006 — kế hoạch DUE và OVERDUE, quá hạn trước, kèm Work Order phòng ngừa đang mở */
export async function listDuePlans(
  user: CurrentUser, query: { farmId?: string; houseId?: string },
): Promise<Array<Record<string, unknown> & { open_work_orders: string[] }>> {
  const filter = await scopeFilter(user, query)
  filter.state = { $in: ['DUE', 'OVERDUE'] }
  const plans = await MaintenancePlan.find(filter).sort({ state: -1, due_since: 1 }).lean()
  const open = await WorkOrder.find({ plan_id: { $in: plans.map(p => p._id) }, is_open: true }).select('plan_id').lean()
  return plans.map(p => ({
    ...p, open_work_orders: open.filter(w => String(w.plan_id) === String(p._id)).map(w => String(w._id)),
  }))
}

export async function createPlan(user: CurrentUser, input: MaintenancePlanInput, now = new Date()) {
  const { house, farm } = await assertHouseAccess(input.house_id, user)
  assertPlanShape(input.equipment, input.basis, input.interval)
  const plan = await MaintenancePlan.create({
    farm_id: farm._id, house_id: house._id, equipment: input.equipment, basis: input.basis, interval: input.interval,
    checklist_template: input.checklist_template.map(i => i.trim()).filter(Boolean),
    source: input.source.trim(), note: input.note?.trim() || undefined, created_by: user._id, created_at: now,
    // SM-20 — kế hoạch theo lịch có điểm đến hạn đầu ngay khi tạo
    ...(input.basis === 'CALENDAR' && { next_due_at: new Date(now.getTime() + input.interval * DAY_MS) }),
  })
  await logAction(user._id, 'MAINTENANCE_PLAN_CREATED', 'maintenance_plan', String(plan._id), {
    house_id: String(house._id), equipment: plan.equipment, basis: plan.basis, interval: plan.interval,
  }, { farmId: String(farm._id) })
  return plan
}

export async function updatePlan(
  id: string, user: CurrentUser, input: { interval?: number; checklist_template?: string[]; source?: string; note?: string },
) {
  const plan = await findPlanWithAccess(id, user)
  if (plan.state === 'RETIRED') throw ConflictError('Kế hoạch đã xoá')
  const before = { interval: plan.interval, checklist_template: [...plan.checklist_template] }
  if (input.interval !== undefined) {
    assertPlanShape(plan.equipment, plan.basis, input.interval)
    plan.interval = input.interval
    if (plan.basis === 'CALENDAR') {
      plan.next_due_at = new Date((plan.last_done_at ?? plan.created_at).getTime() + input.interval * DAY_MS)
    }
  }
  if (input.checklist_template) plan.checklist_template = input.checklist_template.map(i => i.trim()).filter(Boolean)
  if (input.source !== undefined) plan.source = input.source.trim()
  if (input.note !== undefined) plan.note = input.note.trim() || undefined
  await plan.save()
  await logAction(user._id, 'MAINTENANCE_PLAN_UPDATED', 'maintenance_plan', String(plan._id), {
    before, after: { interval: plan.interval, checklist_template: plan.checklist_template },
  }, { farmId: String(plan.farm_id) })
  return plan
}

export async function retirePlan(id: string, user: CurrentUser) {
  const plan = await findPlanWithAccess(id, user)
  if (plan.state !== 'RETIRED') {
    plan.state = 'RETIRED'
    await plan.save()
    await logAction(user._id, 'MAINTENANCE_PLAN_RETIRED', 'maintenance_plan', String(plan._id), {}, { farmId: String(plan.farm_id) })
  }
  return plan
}

/** Report 3 §2.4 — Domain Expert góp ý kế hoạch; Farm Owner được báo */
export async function addComment(id: string, user: CurrentUser, text: string) {
  const plan = await findPlanWithAccess(id, user)
  plan.comments.push({ by: user._id as never, text: text.trim(), at: new Date() })
  await plan.save()
  const owners = await findRecipients(String(plan.farm_id))
  await Promise.all(owners.map(o => notifyUser(String(o._id), {
    title: `Chuyên gia góp ý kế hoạch ${EQUIPMENT_LABEL[plan.equipment]}`, body: text.trim(),
  })))
  return plan
}

// ── Đến hạn và quá hạn (OPS-FR-006, ALERT-FR-016) ───────────────────────────

async function markDue(plan: IMaintenancePlan, now: Date): Promise<void> {
  if (plan.state !== 'SCHEDULED') return
  plan.state = 'DUE'
  plan.due_since = now
  await plan.save()
}

/** Kế hoạch theo giờ chạy hoặc số lần đóng cắt: mỗi controller của nhà có tải vượt khoảng → cảnh báo + Work Order */
async function checkCountedPlan(plan: IMaintenancePlan, now: Date): Promise<number> {
  const load = LOAD_OF_EQUIPMENT[plan.equipment]
  if (!load) return 0
  const zones = await Zone.find({ house_id: plan.house_id }).select('_id name').lean()
  const nodes = await SensorNode.find({ zone_id: { $in: zones.map(z => z._id) }, ...IN_SERVICE })
    .select('_id zone_id device_id relay_usage').lean()
  let opened = 0
  for (const node of nodes) {
    const usage = node.relay_usage?.[load]
    const counter = plan.basis === 'RUN_HOURS' ? usage?.since_service_hours ?? 0 : usage?.since_service_switches ?? 0
    if (counter < plan.interval) continue
    await markDue(plan, now)
    if (await WorkOrder.exists({ plan_id: plan._id, node_id: node._id, is_open: true })) continue

    const zoneName = zones.find(z => String(z._id) === String(node.zone_id))?.name ?? ''
    const shown = plan.basis === 'RUN_HOURS' ? Math.round(counter) : counter
    const title = `Đến hạn bảo trì ${EQUIPMENT_LABEL[plan.equipment]} — ${node.device_id}`
    const message = `${EQUIPMENT_LABEL[plan.equipment]} của ${node.device_id} (${zoneName}) đã ${shown} ${UNIT[plan.basis]} ` +
      `kể từ lần bảo trì trước (kế hoạch: mỗi ${plan.interval} ${UNIT[plan.basis]}).`
    const details = { plan_id: String(plan._id), load, counter: shown, interval: plan.interval, basis: plan.basis }
    const alert = await createAlert({
      farmId: String(plan.farm_id), zoneId: String(node.zone_id), nodeId: String(node._id), type: 'MAINTENANCE_DUE',
      title, message, details, metadata: details,
    }) ?? await Alert.findOne({
      type: 'MAINTENANCE_DUE', node_id: node._id, 'details.plan_id': String(plan._id), status: { $in: OPEN_ALERT_STATUSES },
    })
    if (await openPreventiveWorkOrder({
      plan, title, description: message, alertId: alert?._id, zoneId: node.zone_id, nodeId: node._id,
    })) opened++
  }
  return opened
}

/** Kế hoạch theo lịch: đến điểm đến hạn → cảnh báo của nhà + Work Order */
async function checkCalendarPlan(plan: IMaintenancePlan, now: Date): Promise<number> {
  if (!plan.next_due_at || plan.next_due_at > now) return 0
  if (await WorkOrder.exists({ plan_id: plan._id, is_open: true })) return 0
  await markDue(plan, now)
  const house = await House.findById(plan.house_id).select('name').lean()
  const title = `Đến hạn ${EQUIPMENT_LABEL[plan.equipment]} — ${house?.name ?? ''}`
  const message = `Kế hoạch ${EQUIPMENT_LABEL[plan.equipment]} của ${house?.name ?? 'nhà'} đến hạn (mỗi ${plan.interval} ngày).`
  const details = { plan_id: String(plan._id), interval: plan.interval, basis: plan.basis }
  const alert = await createAlert({
    farmId: String(plan.farm_id), houseId: String(plan.house_id), type: 'MAINTENANCE_DUE', title, message, details, metadata: details,
  }) ?? await Alert.findOne({ type: 'MAINTENANCE_DUE', 'details.plan_id': String(plan._id), status: { $in: OPEN_ALERT_STATUSES } })
  return (await openPreventiveWorkOrder({ plan, title, description: message, alertId: alert?._id })) ? 1 : 0
}

/** OPS-FR-006 — còn đến hạn quá MAINTENANCE_GRACE_DAYS: OVERDUE và báo Farm Owner đúng 1 lần */
async function escalateOverdue(now: Date): Promise<number> {
  const plans = await MaintenancePlan.find({
    state: 'DUE', due_since: { $lte: new Date(now.getTime() - MAINTENANCE_GRACE_DAYS * DAY_MS) }, overdue_notified_at: null,
  })
  let notified = 0
  for (const plan of plans) {
    const { modifiedCount } = await MaintenancePlan.updateOne(
      { _id: plan._id, state: 'DUE', overdue_notified_at: null }, { $set: { state: 'OVERDUE', overdue_notified_at: now } },
    )
    if (modifiedCount === 0) continue
    const owners = await findRecipients(String(plan.farm_id))
    await Promise.all(owners.map(o => notifyUser(String(o._id), {
      title: `Quá hạn bảo trì: ${EQUIPMENT_LABEL[plan.equipment]}`,
      body: `Đã quá ${MAINTENANCE_GRACE_DAYS} ngày từ lúc đến hạn mà chưa ghi bảo trì.`,
    })))
    notified++
  }
  return notified
}

/**
 * maintenanceDue.job — mỗi giờ: kế hoạch theo giờ chạy và số lần đóng cắt (bộ đếm do relayUsage.job cộng dồn, BR-45)
 * và kế hoạch quá hạn; `calendar` (07:00 giờ VN): kế hoạch theo lịch (Report 3 OPS-FR-006).
 */
export async function checkDuePlans(now = new Date(), opts: { calendar?: boolean } = {}) {
  const plans = await MaintenancePlan.find({
    state: { $in: ['SCHEDULED', 'DUE', 'OVERDUE'] },
    basis: opts.calendar ? 'CALENDAR' : { $in: ['RUN_HOURS', 'SWITCHES'] },
  })
  let opened = 0
  for (const plan of plans) {
    try {
      opened += plan.basis === 'CALENDAR' ? await checkCalendarPlan(plan, now) : await checkCountedPlan(plan, now)
    } catch (err) {
      logger.error('Kiểm tra kế hoạch bảo trì thất bại', { planId: String(plan._id), err })
    }
  }
  return { opened, overdue: await escalateOverdue(now) }
}

/**
 * BR-40 — tỷ lệ bảo trì đúng hạn: Work Order phòng ngừa mở trong [from, to) đã đóng trước lúc mở (điểm đến hạn) cộng
 * MAINTENANCE_GRACE_DAYS; null khi không có Work Order phòng ngừa nào.
 */
export async function onTimeMaintenanceRate(houseIds: Types.ObjectId[], from: Date, to: Date): Promise<number | null> {
  const orders = await WorkOrder.find({
    kind: 'PREVENTIVE', house_id: { $in: houseIds }, opened_at: { $gte: from, $lt: to },
  }).select('opened_at closed_at status').lean()
  if (orders.length === 0) return null
  const onTime = orders.filter(o => o.status === 'CLOSED' && o.closed_at
    && o.closed_at.getTime() <= o.opened_at.getTime() + MAINTENANCE_GRACE_DAYS * DAY_MS).length
  return Math.round((100 * onTime) / orders.length)
}
