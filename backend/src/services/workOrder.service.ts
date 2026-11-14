import { randomUUID } from 'crypto'
import { Types } from 'mongoose'
import { Alert, IAlert, OPEN_ALERT_STATUSES } from '@/models/alert.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { Telemetry } from '@/models/telemetry.model'
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
  // Khoá ngẫu nhiên: 2 request cùng 1 mili giây không ghi đè ảnh của nhau
  return Promise.all(files.map(async file => {
    const key = `${prefix}/${randomUUID()}.${PHOTO_TYPES[file.mimetype]}`
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
async function findOpenForIncident(
  houseId: unknown, alert: Pick<IAlert, 'type' | 'node_id' | 'details'>,
): Promise<IWorkOrder | null> {
  const open = await WorkOrder.find({ house_id: houseId, alert_type: alert.type, node_id: alert.node_id ?? null, is_open: true })
  // THREAT-FR-014 — bơm và quạt của cùng controller là hai sự cố (createAlert gộp trùng theo `details.load`): chỉ gắn
  // vào Work Order của cảnh báo cùng tải
  const load = alert.type === 'ACTUATOR_FAULT' ? alert.details?.load : undefined
  if (typeof load !== 'string') return open[0] ?? null
  const sameLoad = new Set((await Alert.find({ _id: { $in: open.map(w => w.alert_id) }, 'details.load': load })
    .select('_id').lean()).map(a => String(a._id)))
  return open.find(w => sameLoad.has(String(w.alert_id))) ?? null
}

/**
 * Gắn cảnh báo mới vào Work Order chưa đóng của cùng sự cố; null = không có Work Order nào để gắn (hoặc nó vừa
 * đóng giữa lúc đọc và lúc ghi). Thử lại 1 lần khi Work Order vừa đổi trạng thái; vẫn đổi liên tục thì gắn không điều
 * kiện vào Work Order còn mở, không mở Work Order thứ hai cho cùng sự cố (BR-39).
 */
async function attachToOpenIncident(houseId: unknown, alert: IAlert): Promise<IWorkOrder | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const existing = await findOpenForIncident(houseId, alert)
    if (!existing) return null
    const linked = await relinkRecurringIncident(existing, alert)
    if (linked) return linked
  }
  const existing = await findOpenForIncident(houseId, alert)
  if (!existing) return null
  logger.warn('Work Order đổi trạng thái liên tục khi gắn cảnh báo mới; gắn không điều kiện', {
    workOrderId: String(existing._id), alertId: String(alert._id),
  })
  await WorkOrder.updateOne({ _id: existing._id }, { $set: { alert_id: alert._id } })
  existing.alert_id = alert._id
  return existing
}

/**
 * Mở Work Order sửa chữa cho 1 cảnh báo, giao thợ đang trực của nhà (nhà không có thợ thì để trống, Farm Owner
 * xử lý). Cùng sự cố đã có Work Order chưa đóng thì không mở thêm mà gắn cảnh báo mới vào Work Order đó (BR-39);
 * nếu nó đang chờ kiểm phục hồi hay chờ duyệt thì sự cố quay lại → IN_PROGRESS (OPS-FR-003).
 */
export async function openWorkOrderForAlert(
  alert: IAlert, origin: Exclude<WorkOrderOrigin, 'MANUAL'>, openedBy?: string,
): Promise<IWorkOrder | null> {
  const house = await findAlertHouse(alert)
  if (!house) return null
  const linked = await attachToOpenIncident(house._id, alert)
  if (linked) return linked

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

/** Đã báo xong (đang kiểm hay chờ duyệt) mà sự cố còn hoặc quay lại: trở lại "đang làm", báo người xử lý (OPS-FR-003) */
const DONE_STATUSES: WorkOrderStatus[] = ['VERIFYING', 'AWAITING_APPROVAL']

async function backToInProgress(wo: IWorkOrder, set: Record<string, unknown>, title: string): Promise<IWorkOrder> {
  const reopened = await transition(wo, DONE_STATUSES, 'IN_PROGRESS', { ...set, done_at: null, verified_at: null },
    undefined, 'Sự cố còn hoặc quay lại sau khi báo xong (BR-41)')
  // Farm Owner đã nhận "chờ duyệt" thì cũng được báo, kẻo bấm duyệt rồi gặp 409
  const recipients = new Set(await handlerIds(reopened))
  if (wo.status === 'AWAITING_APPROVAL') for (const id of await ownerIdsOf(wo.farm_id)) recipients.add(id)
  await notifyAll([...recipients], reopened, `Sự cố quay lại: ${title}`,
    'Dữ liệu chưa phục hồi sau khi báo xong — Work Order trở lại "đang làm".')
  return reopened
}

/**
 * Cảnh báo mới của sự cố đã có Work Order chưa đóng. Đã báo xong thì sự cố quay lại → IN_PROGRESS: kể cả lúc chờ
 * duyệt, để Farm Owner không duyệt và đóng nhầm cảnh báo còn đang chạy. Ghi có điều kiện theo trạng thái đã đọc:
 * Work Order vừa đóng hay đổi trạng thái thì trả null để nơi gọi đọc lại.
 */
async function relinkRecurringIncident(wo: IWorkOrder, alert: IAlert): Promise<IWorkOrder | null> {
  if (String(wo.alert_id) === String(alert._id)) return wo
  try {
    if (DONE_STATUSES.includes(wo.status)) return await backToInProgress(wo, { alert_id: alert._id }, alert.title)
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 409) return null
    throw err
  }
  return WorkOrder.findOneAndUpdate({ _id: wo._id, status: wo.status }, { $set: { alert_id: alert._id } }, { new: true })
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
    if (house) await attachToOpenIncident(house._id, alert)
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
  // Report 3 §4.5 — tối đa 5 ảnh cho cả Work Order: ảnh của các lần báo xong trước (trước khi bị mở lại) vẫn giữ
  if (wo.photos.length + files.length > MAX_WORK_ORDER_PHOTOS) {
    throw BadRequestError(`Mỗi Work Order tối đa ${MAX_WORK_ORDER_PHOTOS} ảnh (đã có ${wo.photos.length})`)
  }
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

async function notifyOwnersAwaitingApproval(wo: IWorkOrder, unverified = false): Promise<void> {
  await notifyAll(await ownerIdsOf(wo.farm_id), wo, `Work Order chờ duyệt: ${wo.title}`, unverified
    ? 'Đã làm xong; hệ thống chưa có dữ liệu để kiểm phục hồi — Farm Owner kiểm tại chỗ rồi duyệt để đóng.'
    : 'Đã làm xong và dữ liệu đã phục hồi — cần Farm Owner duyệt để đóng.')
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
  // Không đặt lại `escalated_at`: Farm Owner vừa tự giao lại nên đã biết, và BR-40 chỉ báo trễ 1 lần cho mỗi Work Order
  const updated = await WorkOrder.findOneAndUpdate(
    { _id: wo._id, status: wo.status },
    {
      $set: { assignee_id: assigneeId },
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
 * BR-41 — firmware chỉ gửi các cảnh báo này khi sự cố xuất hiện (không gửi lại khi sự cố còn): thấy lại sau lúc báo
 * xong là sự cố đã quay lại. `MISTING_INEFFECTIVE` không thuộc nhóm này: firmware gửi lại mỗi 15 phút suốt lúc còn
 * chốt ngừng phun (tới 30 phút sau khi sửa xong), nên dựa vào độ ẩm.
 */
const RERAISED_ON_RECURRENCE: AlertType[] = ['SENSOR_FAULT', 'RS485_BUS_FAILURE']
/**
 * BR-41 — chưa có dữ liệu nào cho thấy phục hồi: `ACTUATOR_FAULT` cần dòng bình thường mà backend chưa biết mức firmware
 * học được (board đo dòng chưa làm), `SPEAKER_FAILURE` chỉ được gửi một lần khi sự cố xuất hiện. Work Order chuyển
 * chờ duyệt kèm ghi chú, Farm Owner kiểm tại chỗ khi duyệt.
 */
const UNVERIFIABLE_RECOVERY: AlertType[] = ['ACTUATOR_FAULT', 'SPEAKER_FAILURE']
/** Số đo của 5 cảm biến RS485 (THREAT-FR-013): cảm biến đọc lỗi thì telemetry bỏ trống trường đó */
const RS485_FIELDS = ['temperature', 'humidity', 'light_lux', 'nh3_ppm', 'co2_ppm', 'sound_db'] as const

type VerifiedAlert = Pick<IAlert, 'type' | 'status' | 'resolved_at' | 'last_seen_at' | 'node_id' | 'zone_id'>

/**
 * Lúc cảnh báo đã đóng là điều kiện đã hết; null = chưa đóng. THRESHOLD_BREACH tự đóng sau 5 phút không vượt
 * (BR-16) nên chỉ số đã về ngưỡng từ lần vượt cuối (`last_seen_at`); NODE_OFFLINE đóng khi thiết bị online lại.
 */
function resolvedSince(alert: VerifiedAlert): Date | null {
  if (alert.status !== 'RESOLVED' || !alert.resolved_at) return null
  return alert.type === 'THRESHOLD_BREACH' ? alert.last_seen_at ?? alert.resolved_at : alert.resolved_at
}

/**
 * Telemetry của controller giữ đạt `isBad = false` liên tục ít nhất RECOVERY_VERIFY_MIN tính từ `from` (hoặc từ mẫu
 * xấu cuối cùng sau `from`). Không có telemetry thì chưa kết luận được (thiết bị mất kết nối là chuyện của NODE_OFFLINE).
 */
async function telemetryStaysRecovered(nodeId: unknown, from: Date, isBad: Record<string, unknown>): Promise<boolean> {
  const [lastBad, latest] = await Promise.all([
    Telemetry.findOne({ node_id: nodeId, timestamp: { $gte: from }, ...isBad }).sort({ timestamp: -1 }).select('timestamp').lean(),
    Telemetry.findOne({ node_id: nodeId, timestamp: { $gte: from } }).sort({ timestamp: -1 }).select('timestamp').lean(),
  ])
  if (!latest) return false
  const recoveredFrom = lastBad ? lastBad.timestamp : from
  return latest.timestamp.getTime() - recoveredFrom.getTime() >= RECOVERY_VERIFY_MS
}

/**
 * BR-41 — sau "done", điều kiện của cảnh báo có giữ phục hồi RECOVERY_VERIFY_MIN không:
 * - `SENSOR_FAULT`, `RS485_BUS_FAILURE` được controller báo lại sau lúc báo xong (cảnh báo gộp trùng nên chỉ
 *   `last_seen_at` tăng) → sự cố quay lại;
 * - `ACTUATOR_FAULT`, `SPEAKER_FAILURE`: chưa có dữ liệu để kiểm → chờ duyệt kèm ghi chú (UNVERIFIABLE_RECOVERY);
 * - cảnh báo đã đóng → tính từ lúc đóng;
 * - `MISTING_INEFFECTIVE`: độ ẩm về trên `humidity_min` của zone (OPS-FR-003);
 * - `SENSOR_FAULT`, `RS485_BUS_FAILURE`: đủ số đo của cả 5 cảm biến;
 * - loại khác: chờ cảnh báo đóng.
 */
async function verificationOf(
  wo: IWorkOrder, alert: VerifiedAlert, now: Date,
): Promise<'RECOVERED' | 'RECURRED' | 'UNVERIFIABLE' | null> {
  const doneAt = wo.done_at
  if (!doneAt) return null
  if (RERAISED_ON_RECURRENCE.includes(alert.type) && alert.status !== 'RESOLVED' && alert.last_seen_at && alert.last_seen_at > doneAt) {
    return 'RECURRED'
  }
  if (UNVERIFIABLE_RECOVERY.includes(alert.type)) return 'UNVERIFIABLE'
  const elapsedSince = (from: Date) => now.getTime() - from.getTime() >= RECOVERY_VERIFY_MS
  const since = resolvedSince(alert)
  if (since) return elapsedSince(since > doneAt ? since : doneAt) ? 'RECOVERED' : null

  switch (alert.type) {
    case 'MISTING_INEFFECTIVE': {
      const zone = alert.zone_id ? await Zone.findById(alert.zone_id).select('thresholds').lean() : null
      const humidityMin = zone?.thresholds?.humidity_min
      if (!alert.node_id || humidityMin === undefined) return null
      const dry = { $or: [{ humidity: { $lt: humidityMin } }, { humidity: { $exists: false } }] }
      return await telemetryStaysRecovered(alert.node_id, doneAt, dry) ? 'RECOVERED' : null
    }
    case 'SENSOR_FAULT':
    case 'RS485_BUS_FAILURE': {
      if (!alert.node_id) return null
      const missing = { $or: RS485_FIELDS.map(field => ({ [field]: { $exists: false } })) }
      return await telemetryStaysRecovered(alert.node_id, doneAt, missing) ? 'RECOVERED' : null
    }
    default:
      return null
  }
}

/**
 * OPEN tự đóng "self-recovered" chỉ khi cảnh báo phục hồi sau lúc mở Work Order và giữ RECOVERY_VERIFY_MIN: Work
 * Order mở tay hay do chuyên gia xác nhận "cần tới nhà" trên cảnh báo đã đóng từ trước thì vẫn chờ người làm.
 */
function selfRecovered(wo: IWorkOrder, alert: VerifiedAlert, now: Date): boolean {
  const since = resolvedSince(alert)
  return !!since && since > wo.opened_at && now.getTime() - since.getTime() >= RECOVERY_VERIFY_MS
}

/**
 * Chạy mỗi phút (recoveryCheck.job):
 * - VERIFYING mà điều kiện giữ phục hồi RECOVERY_VERIFY_MIN sau lúc báo xong → AWAITING_APPROVAL, báo Farm Owner;
 *   controller báo lại sự cố → IN_PROGRESS, báo người xử lý (OPS-FR-003);
 * - OPEN mà cảnh báo tự hết và giữ phục hồi chừng đó trước khi ai bắt đầu → CLOSED, "self-recovered";
 * - OPEN có thợ mà chưa bắt đầu sau ESCALATION_MIN → báo Farm Owner 1 lần (BR-40, Report 3 §6.19).
 */
export async function verifyWorkOrders(now = new Date()): Promise<{ verified: number; selfRecovered: number; escalated: number }> {
  const result = { verified: 0, selfRecovered: 0, escalated: 0 }
  const pending = await WorkOrder.find({ status: { $in: ['OPEN', 'VERIFYING'] }, alert_id: { $exists: true } })
  const alerts = new Map((await Alert.find({ _id: { $in: pending.map(w => w.alert_id) } })
    .select('type status resolved_at last_seen_at node_id zone_id title').lean()).map(a => [String(a._id), a]))

  for (const wo of pending) {
    const alert = alerts.get(String(wo.alert_id))
    if (!alert) continue
    try {
      if (wo.status === 'VERIFYING') {
        const outcome = await verificationOf(wo, alert, now)
        if (outcome === 'RECURRED') {
          await backToInProgress(wo, {}, alert.title)
        } else if (outcome === 'RECOVERED') {
          const updated = await transition(wo, ['VERIFYING'], 'AWAITING_APPROVAL', { verified_at: now }, undefined,
            `Dữ liệu giữ phục hồi ${RECOVERY_VERIFY_MIN} phút (BR-41)`)
          await notifyOwnersAwaitingApproval(updated)
          result.verified++
        } else if (outcome === 'UNVERIFIABLE') {
          const updated = await transition(wo, ['VERIFYING'], 'AWAITING_APPROVAL', { verified_at: now }, undefined,
            'Chưa có dữ liệu để kiểm phục hồi (BR-41): Farm Owner kiểm tại chỗ khi duyệt')
          await notifyOwnersAwaitingApproval(updated, true)
          result.verified++
        }
      } else if (selfRecovered(wo, alert, now)) {
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
