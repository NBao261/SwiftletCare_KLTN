import { Types } from 'mongoose'
import { Alert, IAlert, OPEN_ALERT_STATUSES } from '@/models/alert.model'
import { Farm } from '@/models/farm.model'
import { House } from '@/models/houseZone.model'
import {
  IWorkOrder, OPEN_WORK_ORDER_STATUSES, SiteCause, WorkOrder, WorkOrderOrigin, WorkOrderStatus,
} from '@/models/workOrder.model'
import { findAlertHouse, ESCALATION_MS } from '@/services/alertRouting.service'
import { logAction } from '@/services/auditLog.service'
import { findRecipients, notifyUser } from '@/services/notification.service'
import { presignedGetUrl, putObject } from '@/config/minio.config'
import { AppError, BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '@/utils/appError.util'
import {
  activeHouseTechnicianIds, activeTechnicianOnDuty, assertFarmAccess, assertHouseAccess, listAccessibleFarmIds,
  listAssignedHouseIds,
} from '@/utils/farmAccess.util'
import { paginate } from '@/utils/helpers.util'
import logger from '@/utils/logger.util'
import type { AlertType, CurrentUser } from '@/types'

/** BR-41, Report 3 §4.5 — dữ liệu phải giữ phục hồi chừng này sau "done" (5–60, mặc định 10) */
export const RECOVERY_VERIFY_MIN = 10
export const RECOVERY_VERIFY_MS = RECOVERY_VERIFY_MIN * 60_000
/** BR-39, Report 3 §4.5 — NODE_OFFLINE / EDGE_AI_DEGRADED còn mở sau chừng này thì mở Work Order */
export const WORK_ORDER_OFFLINE_DELAY_MIN = 30

/** BR-39 — cảnh báo thiết bị mở Work Order ngay; cũng là các loại phải có nguyên nhân khi đóng (ALERT-FR-018) */
export const AUTO_WORK_ORDER_TYPES: AlertType[] = [
  'MISTING_INEFFECTIVE', 'ACTUATOR_FAULT', 'SENSOR_FAULT', 'RS485_BUS_FAILURE', 'SPEAKER_FAILURE',
]
const OUTAGE_TYPES: AlertType[] = ['NODE_OFFLINE', 'EDGE_AI_DEGRADED']

/** Ảnh tại chỗ (ALERT-FR-018, EXPERT-FR-021) — Report 3 §4.5 */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024
export const MAX_WORK_ORDER_PHOTOS = 5
const PHOTO_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export interface UploadedPhoto { buffer: Buffer; mimetype: string; size: number }

/** Lưu ảnh lên MinIO, trả về khoá; ảnh sai định dạng hoặc quá cỡ → 400 trước khi lưu ảnh nào */
export async function storePhotos(files: UploadedPhoto[], prefix: string): Promise<string[]> {
  for (const file of files) {
    if (!PHOTO_TYPES[file.mimetype]) throw BadRequestError('Ảnh phải là JPEG, PNG hoặc WebP')
    if (file.size > MAX_PHOTO_BYTES) throw BadRequestError('Mỗi ảnh tối đa 5 MB')
  }
  const stamp = Date.now()
  return Promise.all(files.map(async (file, i) => {
    const key = `${prefix}/${stamp}-${i}.${PHOTO_TYPES[file.mimetype]}`
    await putObject(key, file.buffer, file.mimetype)
    return key
  }))
}

export const photoUrls = (keys: string[] | undefined): Promise<string[]> => Promise.all((keys ?? []).map(k => presignedGetUrl(k)))

// ── Thông báo ────────────────────────────────────────────────────────────────

async function ownerIdsOf(farmId: unknown): Promise<string[]> {
  return (await findRecipients(String(farmId))).map(u => String(u._id))
}

/** Người xử lý Work Order: thợ được giao, nhà không có thợ thì Farm Owner (ALERT-FR-017) */
async function handlerIds(wo: IWorkOrder): Promise<string[]> {
  return wo.assignee_id ? [String(wo.assignee_id)] : ownerIdsOf(wo.farm_id)
}

async function notifyAll(userIds: string[], wo: IWorkOrder, title: string, body: string): Promise<void> {
  await Promise.all(userIds.map(id => notifyUser(id, { title, body, ref: { kind: 'work_order', id: String(wo._id) } })))
}

// ── Chuyển trạng thái ────────────────────────────────────────────────────────

function historyEntry(from: WorkOrderStatus | undefined, to: WorkOrderStatus, by?: string, note?: string) {
  return { from, to, by: by as never, note, at: new Date() }
}

/**
 * Đổi trạng thái có điều kiện: chỉ khi Work Order còn ở 1 trong `from` (2 thao tác đồng thời không cùng qua
 * được); sai trạng thái → 409 (OPS-FR-004).
 */
async function transition(
  wo: IWorkOrder, from: WorkOrderStatus[], to: WorkOrderStatus, set: Record<string, unknown>, by?: string, note?: string,
): Promise<IWorkOrder> {
  if (!from.includes(wo.status)) throw ConflictError(`Work Order đang ở trạng thái ${wo.status}, không thể chuyển sang ${to}`)
  const updated = await WorkOrder.findOneAndUpdate(
    { _id: wo._id, status: wo.status },
    {
      $set: { ...set, status: to, is_open: OPEN_WORK_ORDER_STATUSES.includes(to) },
      $push: { history: historyEntry(wo.status, to, by, note) },
    },
    { new: true },
  )
  if (!updated) throw ConflictError('Work Order vừa được người khác cập nhật, hãy tải lại')
  return updated
}

// ── Mở Work Order (OPS-FR-001, BR-39) ───────────────────────────────────────

/** Work Order chưa đóng của cùng sự cố: cùng nhà, cùng loại cảnh báo, cùng thiết bị */
function findOpenForIncident(houseId: unknown, alert: Pick<IAlert, 'type' | 'node_id'>) {
  return WorkOrder.findOne({ house_id: houseId, alert_type: alert.type, node_id: alert.node_id ?? null, is_open: true })
}

/**
 * Mở Work Order sửa chữa cho 1 cảnh báo, giao thợ đang trực của nhà (nhà không có thợ thì để trống, Farm Owner
 * xử lý). Cùng sự cố đã có Work Order chưa đóng thì không mở thêm mà gắn cảnh báo mới vào Work Order đó (BR-39);
 * nếu nó đang VERIFYING thì sự cố quay lại → IN_PROGRESS (OPS-FR-003).
 */
export async function openWorkOrderForAlert(
  alert: IAlert, origin: Exclude<WorkOrderOrigin, 'MANUAL'>, openedBy?: string,
): Promise<IWorkOrder | null> {
  const house = await findAlertHouse(alert)
  if (!house) return null
  const existing = await findOpenForIncident(house._id, alert)
  if (existing) return relinkRecurringIncident(existing, alert)

  const farm = await Farm.findById(house.farm_id).select('members')
  if (!farm) return null
  const assignee = await activeTechnicianOnDuty(house, farm)
  try {
    const wo = await WorkOrder.create({
      farm_id: house.farm_id, house_id: house._id, zone_id: alert.zone_id, node_id: alert.node_id,
      alert_id: alert._id, alert_type: alert.type, origin, kind: 'REPAIR',
      title: `Sửa chữa: ${alert.title}`, description: alert.message,
      assignee_id: assignee ?? undefined, opened_by: openedBy,
      history: [historyEntry(undefined, 'OPEN', openedBy)],
    })
    await notifyAll(await handlerIds(wo), wo, `Work Order mới: ${alert.title}`, alert.message)
    return wo
  } catch (err) {
    // Hai lần mở đồng thời cho cùng cảnh báo: index unique một phần chặn lần sau (BR-39)
    if ((err as { code?: number }).code === 11000) return WorkOrder.findOne({ alert_id: alert._id, is_open: true })
    throw err
  }
}

async function relinkRecurringIncident(wo: IWorkOrder, alert: IAlert): Promise<IWorkOrder> {
  if (String(wo.alert_id) === String(alert._id)) return wo
  if (wo.status === 'VERIFYING') {
    const reopened = await transition(wo, ['VERIFYING'], 'IN_PROGRESS', { alert_id: alert._id }, undefined,
      'Sự cố quay lại trong lúc kiểm phục hồi (BR-41)')
    await notifyAll(await handlerIds(reopened), reopened, `Sự cố quay lại: ${alert.title}`,
      'Dữ liệu chưa phục hồi sau khi báo xong — Work Order trở lại "đang làm".')
    return reopened
  }
  await WorkOrder.updateOne({ _id: wo._id }, { $set: { alert_id: alert._id } })
  wo.alert_id = alert._id
  return wo
}

/**
 * Gọi từ createAlert sau khi có cảnh báo mới: cảnh báo thiết bị của BR-39 mở Work Order; loại khác chỉ gắn vào
 * Work Order chưa đóng của cùng sự cố nếu có (sự cố quay lại). Lỗi chỉ ghi log, không chặn việc ghi cảnh báo.
 */
export async function handleNewAlert(alert: IAlert): Promise<void> {
  try {
    if (AUTO_WORK_ORDER_TYPES.includes(alert.type)) {
      await openWorkOrderForAlert(alert, 'ALERT')
      return
    }
    const house = await findAlertHouse(alert)
    const existing = house ? await findOpenForIncident(house._id, alert) : null
    if (existing) await relinkRecurringIncident(existing, alert)
  } catch (err) {
    logger.error('Mở/gắn Work Order cho cảnh báo mới thất bại', { alertId: String(alert._id), err })
  }
}

/** BR-39 — NODE_OFFLINE / EDGE_AI_DEGRADED còn mở sau 30 phút; cảnh báo đã từng có Work Order (kể cả đã huỷ) thì thôi */
export async function openWorkOrdersForOutages(now = new Date()): Promise<number> {
  const alerts = await Alert.find({
    type: { $in: OUTAGE_TYPES },
    status: { $in: ['ACTIVE', 'ACKNOWLEDGED'] },
    created_at: { $lte: new Date(now.getTime() - WORK_ORDER_OFFLINE_DELAY_MIN * 60_000) },
  })
  if (alerts.length === 0) return 0
  const handled = new Set((await WorkOrder.distinct('alert_id', { alert_id: { $in: alerts.map(a => a._id) } })).map(String))
  let opened = 0
  for (const alert of alerts.filter(a => !handled.has(String(a._id)))) {
    if (await openWorkOrderForAlert(alert, 'OUTAGE')) opened++
  }
  return opened
}

/** OPS-FR-001 — Farm Owner mở tay (route chỉ FARM_OWNER) */
export async function createManualWorkOrder(
  user: CurrentUser, input: { house_id: string; title: string; description?: string; alert_id?: string },
): Promise<IWorkOrder> {
  const { house, farm } = await assertHouseAccess(input.house_id, user)
  let alert: IAlert | null = null
  if (input.alert_id) {
    alert = await Alert.findById(input.alert_id)
    if (!alert) throw NotFoundError('Không tìm thấy cảnh báo')
    const alertHouse = await findAlertHouse(alert)
    if (!alertHouse || String(alertHouse._id) !== String(house._id)) throw BadRequestError('Cảnh báo không thuộc nhà này')
    if (await WorkOrder.exists({ alert_id: alert._id, is_open: true })) throw ConflictError('Cảnh báo đã có Work Order đang mở')
  }
  const assignee = await activeTechnicianOnDuty(house, farm)
  let wo: IWorkOrder
  try {
    wo = await WorkOrder.create({
      farm_id: farm._id, house_id: house._id, origin: 'MANUAL', kind: 'REPAIR',
      title: input.title.trim(), description: input.description?.trim() || undefined,
      ...(alert && { alert_id: alert._id, alert_type: alert.type, zone_id: alert.zone_id, node_id: alert.node_id }),
      assignee_id: assignee ?? undefined, opened_by: user._id,
      history: [historyEntry(undefined, 'OPEN', user._id)],
    })
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw ConflictError('Cảnh báo đã có Work Order đang mở')
    throw err
  }
  await logAction(user._id, 'WORK_ORDER_OPENED', 'work_order', String(wo._id), {
    house_id: String(house._id), alert_id: input.alert_id, assignee_id: assignee ?? undefined,
  }, { farmId: String(farm._id) })
  if (assignee) await notifyAll([assignee], wo, `Work Order mới: ${wo.title}`, wo.description ?? '')
  return presentWorkOrder(wo, true)
}

// ── Đọc ──────────────────────────────────────────────────────────────────────

/** Quyền trên 1 Work Order: thợ theo nhà được giao, Farm Owner / Domain Expert theo farm; Administrator không */
async function findWorkOrderWithAccess(id: string, user: CurrentUser): Promise<IWorkOrder> {
  const wo = await WorkOrder.findById(id)
  if (!wo) throw NotFoundError('Không tìm thấy Work Order')
  if (user.role === 'FARM_TECHNICIAN') await assertHouseAccess(String(wo.house_id), user)
  else await assertFarmAccess(String(wo.farm_id), user)
  return wo
}

export async function presentWorkOrder(wo: IWorkOrder, withPhotos: boolean) {
  await wo.populate([{ path: 'assignee_id', select: 'full_name' }, { path: 'opened_by', select: 'full_name' }])
  const { assignee_id: assignee, opened_by: openedBy, photos, ...rest } = wo.toObject()
  return {
    ...rest,
    assignee: assignee ?? null,
    opened_by: openedBy ?? null,
    ...(withPhotos && { photo_urls: await photoUrls(photos) }),
  }
}

export interface ListWorkOrdersQuery {
  farmId?: string
  houseId?: string
  alertId?: string
  assigneeId?: string
  status?: WorkOrderStatus
  open?: boolean
  page?: number
  limit?: number
}

export async function listWorkOrders(user: CurrentUser, query: ListWorkOrdersQuery) {
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
  if (query.alertId) filter.alert_id = query.alertId
  if (query.assigneeId) filter.assignee_id = query.assigneeId === 'me' ? user._id : query.assigneeId
  if (query.status) filter.status = query.status
  if (query.open !== undefined) filter.is_open = query.open

  const { page, skip, limit } = paginate(query.page, query.limit)
  const [records, total] = await Promise.all([
    WorkOrder.find(filter).sort({ opened_at: -1 }).skip(skip).limit(limit),
    WorkOrder.countDocuments(filter),
  ])
  return { records: await Promise.all(records.map(r => presentWorkOrder(r, false))), total, page, limit }
}

export async function getWorkOrder(id: string, user: CurrentUser) {
  return presentWorkOrder(await findWorkOrderWithAccess(id, user), true)
}

// ── Thực hiện (OPS-FR-002) ──────────────────────────────────────────────────

export async function startWorkOrder(id: string, user: CurrentUser) {
  const wo = await findWorkOrderWithAccess(id, user)
  const updated = await transition(wo, ['OPEN'], 'IN_PROGRESS', { started_at: new Date() }, user._id)
  return presentWorkOrder(updated, true)
}

/**
 * IN_PROGRESS → VERIFYING (BR-41: hệ thống kiểm dữ liệu phục hồi); Work Order không gắn cảnh báo thì không có gì
 * để kiểm → AWAITING_APPROVAL. Cảnh báo thiết bị của BR-39 phải có nguyên nhân (ALERT-FR-018, 422); nguyên nhân
 * và ảnh lưu cả vào cảnh báo.
 */
export async function completeWorkOrder(
  id: string, user: CurrentUser, input: { cause?: SiteCause; work_note?: string }, files: UploadedPhoto[] = [],
) {
  const wo = await findWorkOrderWithAccess(id, user)
  if (wo.status !== 'IN_PROGRESS') throw ConflictError(`Work Order đang ở trạng thái ${wo.status}, chưa thể báo xong`)
  if (!input.cause && wo.alert_type && AUTO_WORK_ORDER_TYPES.includes(wo.alert_type)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Cần ghi nguyên nhân tìm thấy tại chỗ (ALERT-FR-018)')
  }
  if (files.length > MAX_WORK_ORDER_PHOTOS) throw BadRequestError(`Tối đa ${MAX_WORK_ORDER_PHOTOS} ảnh`)
  const photos = await storePhotos(files, `work-orders/${wo._id}`)
  const now = new Date()
  const to: WorkOrderStatus = wo.alert_id ? 'VERIFYING' : 'AWAITING_APPROVAL'
  const updated = await transition(wo, ['IN_PROGRESS'], to, {
    done_at: now, cause: input.cause, work_note: input.work_note?.trim() || undefined,
    photos: [...wo.photos, ...photos], ...(to === 'AWAITING_APPROVAL' && { verified_at: now }),
  }, user._id)
  if (wo.alert_id && input.cause) {
    await Alert.updateOne({ _id: wo.alert_id }, {
      $set: { site_cause: { cause: input.cause, photos, by: user._id, at: now } },
    })
  }
  if (to === 'AWAITING_APPROVAL') await notifyOwnersAwaitingApproval(updated)
  return presentWorkOrder(updated, true)
}

async function notifyOwnersAwaitingApproval(wo: IWorkOrder): Promise<void> {
  await notifyAll(await ownerIdsOf(wo.farm_id), wo, `Work Order chờ duyệt: ${wo.title}`,
    'Đã làm xong và dữ liệu đã phục hồi — cần Farm Owner duyệt để đóng.')
}

// ── Farm Owner (OPS-FR-004) ─────────────────────────────────────────────────

async function audit(user: CurrentUser, action: string, wo: IWorkOrder, metadata: Record<string, unknown> = {}) {
  await logAction(user._id, action, 'work_order', String(wo._id), { house_id: String(wo.house_id), ...metadata },
    { farmId: String(wo.farm_id) })
}

/** AWAITING_APPROVAL → CLOSED; cảnh báo còn mở được đóng (MTTR tính tới lúc này, BR-40) */
export async function approveWorkOrder(id: string, user: CurrentUser) {
  const wo = await findWorkOrderWithAccess(id, user)
  const now = new Date()
  const updated = await transition(wo, ['AWAITING_APPROVAL'], 'CLOSED', { closed_at: now, result: 'REPAIRED' }, user._id)
  if (wo.alert_id) {
    await Alert.updateOne(
      { _id: wo.alert_id, status: { $in: OPEN_ALERT_STATUSES } },
      { $set: { status: 'RESOLVED', resolved_at: now, acknowledgement_note: 'Đã sửa — Farm Owner duyệt Work Order' } },
    )
  }
  await audit(user, 'WORK_ORDER_APPROVED', updated)
  return presentWorkOrder(updated, true)
}

export async function reopenWorkOrder(id: string, user: CurrentUser, note: string) {
  const wo = await findWorkOrderWithAccess(id, user)
  const updated = await transition(wo, ['AWAITING_APPROVAL'], 'IN_PROGRESS', { verified_at: null, done_at: null }, user._id, note)
  await audit(user, 'WORK_ORDER_REOPENED', updated, { note })
  await notifyAll(await handlerIds(updated), updated, `Work Order bị mở lại: ${updated.title}`, note)
  return presentWorkOrder(updated, true)
}

export async function cancelWorkOrder(id: string, user: CurrentUser, reason: string) {
  const wo = await findWorkOrderWithAccess(id, user)
  const updated = await transition(wo, ['OPEN', 'IN_PROGRESS'], 'CANCELLED', { closed_at: new Date(), cancel_reason: reason }, user._id, reason)
  await audit(user, 'WORK_ORDER_CANCELLED', updated, { reason })
  return presentWorkOrder(updated, true)
}

export async function reassignWorkOrder(id: string, user: CurrentUser, assigneeId: string) {
  const wo = await findWorkOrderWithAccess(id, user)
  if (wo.status !== 'OPEN' && wo.status !== 'IN_PROGRESS') {
    throw ConflictError(`Work Order đang ở trạng thái ${wo.status}, không giao lại được`)
  }
  const house = await House.findById(wo.house_id)
  const farm = await Farm.findById(wo.farm_id).select('members')
  if (!house || !farm || !(await activeHouseTechnicianIds(house, farm)).includes(assigneeId)) {
    throw BadRequestError('Người nhận phải là Farm Technician đang được giao nhà này')
  }
  const updated = await WorkOrder.findOneAndUpdate(
    { _id: wo._id, status: wo.status },
    {
      $set: { assignee_id: assigneeId, escalated_at: null },
      $push: { history: historyEntry(wo.status, wo.status, user._id, 'Giao lại') },
    },
    { new: true },
  )
  if (!updated) throw ConflictError('Work Order vừa được người khác cập nhật, hãy tải lại')
  await audit(user, 'WORK_ORDER_REASSIGNED', updated, { from: wo.assignee_id ? String(wo.assignee_id) : null, to: assigneeId })
  await notifyAll([assigneeId], updated, `Work Order được giao cho bạn: ${updated.title}`, updated.description ?? '')
  return presentWorkOrder(updated, true)
}

// ── Kiểm phục hồi (OPS-FR-003, BR-41) và leo thang (BR-40) ──────────────────

/**
 * Lúc điều kiện của cảnh báo đã phục hồi; null = chưa. Cảnh báo đóng là điều kiện đã hết: thiết bị online lại
 * (NODE_OFFLINE), dòng tải bình thường (ACTUATOR_FAULT), sự cố không tái phát (loại khác). THRESHOLD_BREACH tự
 * đóng sau 5 phút không vượt (BR-16) nên chỉ số đã về ngưỡng từ lần vượt cuối (`last_seen_at`).
 */
function recoveredSince(alert: Pick<IAlert, 'type' | 'status' | 'resolved_at' | 'last_seen_at'> | undefined): Date | null {
  if (!alert || alert.status !== 'RESOLVED' || !alert.resolved_at) return null
  return alert.type === 'THRESHOLD_BREACH' ? alert.last_seen_at ?? alert.resolved_at : alert.resolved_at
}

/**
 * Chạy mỗi phút (recoveryCheck.job):
 * - VERIFYING mà dữ liệu giữ phục hồi RECOVERY_VERIFY_MIN kể từ lúc báo xong → AWAITING_APPROVAL, báo Farm Owner;
 * - OPEN mà cảnh báo tự hết và giữ phục hồi chừng đó trước khi ai bắt đầu → CLOSED, "self-recovered";
 * - OPEN có thợ mà chưa bắt đầu sau ESCALATION_MIN → báo Farm Owner 1 lần (BR-40, Report 3 §6.19).
 */
export async function verifyWorkOrders(now = new Date()): Promise<{ verified: number; selfRecovered: number; escalated: number }> {
  const result = { verified: 0, selfRecovered: 0, escalated: 0 }
  const pending = await WorkOrder.find({ status: { $in: ['OPEN', 'VERIFYING'] }, alert_id: { $exists: true } })
  const alerts = new Map((await Alert.find({ _id: { $in: pending.map(w => w.alert_id) } })
    .select('type status resolved_at last_seen_at').lean()).map(a => [String(a._id), a]))

  for (const wo of pending) {
    const since = recoveredSince(alerts.get(String(wo.alert_id)))
    if (!since) continue
    const from = wo.status === 'VERIFYING' && wo.done_at && wo.done_at > since ? wo.done_at : since
    if (now.getTime() - from.getTime() < RECOVERY_VERIFY_MS) continue
    try {
      if (wo.status === 'VERIFYING') {
        const updated = await transition(wo, ['VERIFYING'], 'AWAITING_APPROVAL', { verified_at: now }, undefined,
          `Dữ liệu giữ phục hồi ${RECOVERY_VERIFY_MIN} phút (BR-41)`)
        await notifyOwnersAwaitingApproval(updated)
        result.verified++
      } else {
        await transition(wo, ['OPEN'], 'CLOSED', { closed_at: now, result: 'SELF_RECOVERED' }, undefined,
          'Cảnh báo tự phục hồi trước khi bắt đầu làm (OPS-FR-003)')
        result.selfRecovered++
      }
    } catch (err) {
      // Người dùng vừa đổi trạng thái giữa lúc đọc và lúc ghi — lượt sau xét lại
      if (!(err instanceof AppError && err.statusCode === 409)) throw err
    }
  }

  const stale = await WorkOrder.find({
    status: 'OPEN', assignee_id: { $exists: true }, escalated_at: null,
    opened_at: { $lte: new Date(now.getTime() - ESCALATION_MS) },
  })
  for (const wo of stale) {
    const { modifiedCount } = await WorkOrder.updateOne({ _id: wo._id, status: 'OPEN', escalated_at: null }, { $set: { escalated_at: now } })
    if (modifiedCount === 0) continue
    await notifyAll(await ownerIdsOf(wo.farm_id), wo, `Work Order chưa ai bắt đầu: ${wo.title}`,
      `Đã quá ${ESCALATION_MS / 60_000} phút từ lúc mở mà thợ được giao chưa bắt đầu — có thể giao lại cho người khác.`)
    result.escalated++
  }
  return result
}
