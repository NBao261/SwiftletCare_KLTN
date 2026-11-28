import { randomUUID } from 'crypto'
import { Types } from 'mongoose'
import { Alert, IAlert, OPEN_ALERT_STATUSES } from '@/models/alert.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { Telemetry } from '@/models/telemetry.model'
import { User } from '@/models/user.model'
import {
  ChecklistItem, DeviceLeftKind, IWorkOrder, OPEN_WORK_ORDER_STATUSES, SiteCause, WorkOrder, WorkOrderHistoryEntry, WorkOrderOrigin,
  WorkOrderStatus,
} from '@/models/workOrder.model'
import { findAlertHouse, ESCALATION_MS } from '@/services/alertRouting.service'
import { logAction } from '@/services/auditLog.service'
import { findRecipients, notifyUser } from '@/services/notification.service'
import { recordMaintenance } from '@/services/maintenanceRecord.service'
import { presignedGetUrl, putObject, removeObject } from '@/config/minio.config'
import { AppError, BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '@/utils/appError.util'
import {
  activeHouseTechnicianIds, activeTechnicianOnDuty, assertFarmAccess, assertHouseAccess, assertNodeHouseAccess, listAccessibleFarmIds,
  listAssignedHouseIds,
} from '@/utils/farmAccess.util'
import { paginate } from '@/utils/helpers.util'
import logger from '@/utils/logger.util'
import type { AlertType, CurrentUser } from '@/types'
import { WORK_ORDER_STATUS_LABEL } from '@/utils/displayLabel.util'

export const RECOVERY_VERIFY_MIN = 10
export const RECOVERY_VERIFY_MS = RECOVERY_VERIFY_MIN * 60_000
export const WORK_ORDER_OFFLINE_DELAY_MIN = 30

// Cũng là các loại phải có nguyên nhân khi đóng
export const AUTO_WORK_ORDER_TYPES: AlertType[] = [
  'MISTING_INEFFECTIVE', 'ACTUATOR_FAULT', 'SENSOR_FAULT', 'RS485_BUS_FAILURE', 'SPEAKER_FAILURE',
]
const OUTAGE_TYPES: AlertType[] = ['NODE_OFFLINE', 'EDGE_AI_DEGRADED']

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024
export const MAX_WORK_ORDER_PHOTOS = 5
// Bảo trì phải có ảnh làm bằng chứng: ảnh của phiếu hoặc của một mục checklist
export const MIN_PREVENTIVE_PHOTOS = 1
const PHOTO_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export interface UploadedPhoto { buffer: Buffer; mimetype: string; size: number }

// Ảnh sai → 400 trước khi lưu ảnh nào
export async function storePhotos(files: UploadedPhoto[], prefix: string): Promise<string[]> {
  for (const file of files) {
    if (!PHOTO_TYPES[file.mimetype]) throw BadRequestError('Ảnh phải là JPEG, PNG hoặc WebP')
    if (file.size > MAX_PHOTO_BYTES) throw BadRequestError('Mỗi ảnh tối đa 5 MB')
  }
  // Khoá ngẫu nhiên: 2 request cùng mili giây không ghi đè nhau
  return Promise.all(files.map(async file => {
    const key = `${prefix}/${randomUUID()}.${PHOTO_TYPES[file.mimetype]}`
    await putObject(key, file.buffer, file.mimetype)
    return key
  }))
}

export const photoUrls = (keys: string[] | undefined): Promise<string[]> => Promise.all((keys ?? []).map(k => presignedGetUrl(k)))

// Ảnh đã lưu mà lần ghi bị từ chối (409) thì xoá, kẻo nằm lại kho không bản ghi nào trỏ tới. Xoá lỗi chỉ ghi log
export async function discardPhotos(keys: Array<string | undefined>): Promise<void> {
  await Promise.all(keys.filter((key): key is string => !!key).map(key => removeObject(key).catch((err: Error) =>
    logger.warn('Không xoá được ảnh của lần ghi bị từ chối', { key, err: err.message }))))
}

// Chạy lần ghi; lỗi thì xoá ảnh vừa lưu rồi ném lại
export async function withStoredPhotos<T>(keys: Array<string | undefined>, write: () => Promise<T>): Promise<T> {
  try {
    return await write()
  } catch (err) {
    await discardPhotos(keys)
    throw err
  }
}

async function ownerIdsOf(farmId: unknown): Promise<string[]> {
  return (await findRecipients(String(farmId))).map(u => String(u._id))
}

// Nhà không có thợ thì Farm Owner
async function handlerIds(wo: IWorkOrder): Promise<string[]> {
  return wo.assignee_id ? [String(wo.assignee_id)] : ownerIdsOf(wo.farm_id)
}

async function notifyAll(userIds: string[], wo: IWorkOrder, title: string, body: string): Promise<void> {
  await Promise.all(userIds.map(id => notifyUser(id, { title, body, ref: { kind: 'work_order', id: String(wo._id) } })))
}

// Nhắc phiếu bảo trì chưa làm: người đang giữ phiếu, thêm Farm Owner khi kế hoạch đã quá hạn
export async function remindPreventiveWorkOrder(wo: IWorkOrder, alsoOwners: boolean, title: string, body: string): Promise<void> {
  const recipients = new Set(await handlerIds(wo))
  if (alsoOwners) for (const id of await ownerIdsOf(wo.farm_id)) recipients.add(id)
  await notifyAll([...recipients], wo, title, body)
}

function historyEntry(from: WorkOrderStatus | undefined, to: WorkOrderStatus, by?: string, note?: string) {
  return { from, to, by: by as never, note, at: new Date() }
}

// Gọi trước khi lưu việc gỡ, thay, dời: lỗi ở đây thì thiết bị chưa đổi gì. Cảnh báo đóng theo việc đó không được job kiểm
// coi là đã phục hồi. Trạng thái phiếu giữ nguyên; một lệnh ghi cho mọi phiếu. Phiếu phòng ngừa đóng theo checklist nên không đụng
export async function markDeviceLeft(nodeId: unknown, kind: DeviceLeftKind, user: CurrentUser, note: string): Promise<IWorkOrder[]> {
  const ids = await WorkOrder.find({ node_id: nodeId, is_open: true, kind: 'REPAIR' }).distinct('_id')
  if (ids.length === 0) return []
  const at = new Date()
  await WorkOrder.updateMany({ _id: { $in: ids }, is_open: true }, [{
    $set: {
      device_left: { $literal: { kind, at } },
      history: { $concatArrays: ['$history', [{ from: '$status', to: '$status', by: new Types.ObjectId(user._id), note: { $literal: note }, at }]] },
    },
  }])
  return WorkOrder.find({ _id: { $in: ids }, 'device_left.at': at })
}

// Gọi sau khi thao tác thiết bị đã xong. Thông báo hỏng không được làm hỏng việc gỡ, thay, dời
export async function notifyDeviceLeft(orders: IWorkOrder[], kind: DeviceLeftKind, user: CurrentUser, note: string): Promise<void> {
  for (const wo of orders) {
    try {
      const recipients = new Set([...await handlerIds(wo), ...await ownerIdsOf(wo.farm_id)])
      recipients.delete(user._id)
      await notifyAll([...recipients], wo, `Thiết bị của phiếu công việc đã ${DEVICE_LEFT_LABEL[kind]}: ${wo.title}`,
        `${asSentence(note)} Phiếu không còn tự kiểm phục hồi bằng dữ liệu: chủ nhà yến kiểm tại nhà yến rồi duyệt, hoặc huỷ phiếu nếu không cần sửa nữa.`)
    } catch (err) {
      logger.warn('Báo việc thiết bị rời chỗ cho phiếu công việc thất bại', { workOrderId: String(wo._id), err })
    }
  }
}

// Lý do người dùng gõ có thể đã có dấu chấm
const asSentence = (text: string) => `${text.trim().replace(/[.\s]+$/, '')}.`

const DEVICE_LEFT_LABEL: Record<DeviceLeftKind, string> = { REMOVED: 'bị gỡ', REPLACED: 'được thay', MOVED: 'được dời' }

// Có điều kiện: 2 thao tác đồng thời không cùng qua được; sai trạng thái → 409
async function transition(
  wo: IWorkOrder, from: WorkOrderStatus[], to: WorkOrderStatus, set: Record<string, unknown>, by?: string, note?: string,
): Promise<IWorkOrder> {
  if (!from.includes(wo.status)) throw ConflictError(`Phiếu công việc đang ở trạng thái ${WORK_ORDER_STATUS_LABEL[wo.status]}, không chuyển sang ${WORK_ORDER_STATUS_LABEL[to]} được`)
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

async function findOpenForIncident(
  houseId: unknown, alert: Pick<IAlert, 'type' | 'node_id' | 'details'>,
): Promise<IWorkOrder | null> {
  const open = await WorkOrder.find({ house_id: houseId, alert_type: alert.type, node_id: alert.node_id ?? null, is_open: true })
  // Bơm và quạt cùng controller là hai sự cố
  const load = alert.type === 'ACTUATOR_FAULT' ? alert.details?.load : undefined
  if (typeof load !== 'string') return open[0] ?? null
  const sameLoad = new Set((await Alert.find({ _id: { $in: open.map(w => w.alert_id) }, 'details.load': load })
    .select('_id').lean()).map(a => String(a._id)))
  return open.find(w => sameLoad.has(String(w.alert_id))) ?? null
}

// Thử lại 1 lần; vẫn đổi liên tục thì gắn không điều kiện, không mở Work Order thứ hai
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

// Đang chờ kiểm hay chờ duyệt thì sự cố quay lại → IN_PROGRESS
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
      assignee_id: assignee ?? undefined, ...(assignee && { assigned_at: new Date() }), opened_by: openedBy,
      history: [historyEntry(undefined, 'OPEN', openedBy)],
    })
    await notifyAll(await handlerIds(wo), wo, `Phiếu công việc mới: ${alert.title}`, alert.message)
    return wo
  } catch (err) {
    // Unique index một phần chặn lần mở thứ hai
    if ((err as { code?: number }).code === 11000) return WorkOrder.findOne({ alert_id: alert._id, is_open: true })
    throw err
  }
}

const DONE_STATUSES: WorkOrderStatus[] = ['VERIFYING', 'AWAITING_APPROVAL']

async function backToInProgress(wo: IWorkOrder, set: Record<string, unknown>, title: string): Promise<IWorkOrder> {
  const reopened = await transition(wo, DONE_STATUSES, 'IN_PROGRESS', { ...set, done_at: null, verified_at: null },
    undefined, 'Sự cố còn hoặc quay lại sau khi báo xong (BR-41)')
  // Farm Owner đã nhận "chờ duyệt" cũng được báo, kẻo duyệt rồi gặp 409
  const recipients = new Set(await handlerIds(reopened))
  if (wo.status === 'AWAITING_APPROVAL') for (const id of await ownerIdsOf(wo.farm_id)) recipients.add(id)
  await notifyAll([...recipients], reopened, `Sự cố quay lại: ${title}`,
    'Dữ liệu chưa phục hồi sau khi báo xong. Phiếu công việc trở lại "Đang làm".')
  return reopened
}

// Kể cả lúc chờ duyệt, để không đóng nhầm cảnh báo còn chạy. null khi vừa đổi trạng thái
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

// Lỗi chỉ ghi log, không chặn ghi cảnh báo
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

// Cảnh báo đã từng có Work Order (kể cả đã huỷ) thì thôi
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

export interface PreventiveWorkOrderInput {
  plan: { _id: Types.ObjectId; farm_id: Types.ObjectId; house_id: Types.ObjectId; checklist_template: string[] }
  title: string
  description: string
  alertId?: Types.ObjectId
  zoneId?: Types.ObjectId
  nodeId?: Types.ObjectId
}

// Không gán alert_type để cảnh báo của kế hoạch khác không bị gộp vào
export async function openPreventiveWorkOrder(input: PreventiveWorkOrderInput): Promise<IWorkOrder | null> {
  const [house, farm] = await Promise.all([House.findById(input.plan.house_id), Farm.findById(input.plan.farm_id).select('members')])
  if (!house || !farm) return null
  const assignee = await activeTechnicianOnDuty(house, farm)
  try {
    const wo = await WorkOrder.create({
      farm_id: house.farm_id, house_id: house._id, zone_id: input.zoneId, node_id: input.nodeId, alert_id: input.alertId,
      kind: 'PREVENTIVE', origin: 'PLAN', plan_id: input.plan._id, title: input.title, description: input.description,
      checklist: input.plan.checklist_template.map(item => ({ item })),
      assignee_id: assignee ?? undefined, history: [historyEntry(undefined, 'OPEN')],
    })
    await notifyAll(await handlerIds(wo), wo, `Đến hạn bảo trì: ${input.title}`, input.description)
    return wo
  } catch (err) {
    // Unique index một phần
    if ((err as { code?: number }).code === 11000) return WorkOrder.findOne({ alert_id: input.alertId, is_open: true })
    throw err
  }
}

// cũng là đường chấp nhận khuyến nghị
export async function createManualWorkOrder(
  user: CurrentUser,
  input: { house_id: string; title: string; description?: string; alert_id?: string; recommendation_id?: string },
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
      farm_id: farm._id, house_id: house._id, origin: input.recommendation_id ? 'RECOMMENDATION' : 'MANUAL', kind: 'REPAIR',
      ...(input.recommendation_id && { recommendation_id: input.recommendation_id }),
      title: input.title.trim(), description: input.description?.trim() || undefined,
      ...(alert && { alert_id: alert._id, alert_type: alert.type, zone_id: alert.zone_id, node_id: alert.node_id }),
      assignee_id: assignee ?? undefined, ...(assignee && { assigned_at: new Date() }), opened_by: user._id,
      history: [historyEntry(undefined, 'OPEN', user._id)],
    })
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw ConflictError('Cảnh báo đã có Work Order đang mở')
    throw err
  }
  await logAction(user._id, 'WORK_ORDER_OPENED', 'work_order', String(wo._id), {
    house_id: String(house._id), alert_id: input.alert_id, recommendation_id: input.recommendation_id, assignee_id: assignee ?? undefined,
  }, { farmId: String(farm._id) })
  if (assignee) await notifyAll([assignee], wo, `Phiếu công việc mới: ${wo.title}`, wo.description ?? '')
  return presentWorkOrder(wo, true)
}

async function findWorkOrderWithAccess(id: string, user: CurrentUser): Promise<IWorkOrder> {
  const wo = await WorkOrder.findById(id)
  if (!wo) throw NotFoundError('Không tìm thấy Work Order')
  if (user.role === 'FARM_TECHNICIAN') await assertHouseAccess(String(wo.house_id), user)
  else await assertFarmAccess(String(wo.farm_id), user)
  return wo
}

// Tên người thao tác đi kèm phiếu: Kỹ thuật viên không đọc được danh sách thành viên trang trại để tra tên
async function actorNames(wo: IWorkOrder): Promise<Map<string, string>> {
  const ids = new Set<string>()
  for (const entry of [...wo.history, ...(wo.checklist ?? [])]) if (entry.by) ids.add(String(entry.by))
  if (ids.size === 0) return new Map()
  const users = await User.find({ _id: { $in: [...ids] } }).select('full_name').lean()
  return new Map(users.map(u => [String(u._id), u.full_name]))
}

export async function presentWorkOrder(wo: IWorkOrder, withPhotos: boolean) {
  const [names] = await Promise.all([
    actorNames(wo),
    wo.populate([{ path: 'assignee_id', select: 'full_name' }, { path: 'opened_by', select: 'full_name' }]),
  ])
  const nameOf = (by?: Types.ObjectId) => (by && names.get(String(by))) ?? null
  const { assignee_id: assignee, opened_by: openedBy, photos, checklist, history, ...rest } = wo.toObject()
  return {
    ...rest,
    assignee: assignee ?? null,
    opened_by: openedBy ?? null,
    history: (history ?? []).map((entry: WorkOrderHistoryEntry) => ({ ...entry, by_name: nameOf(entry.by) })),
    checklist: await Promise.all((checklist ?? []).map(async ({ photo, ...item }: ChecklistItem) => ({
      ...item, by_name: nameOf(item.by), photo_url: withPhotos && photo ? await presignedGetUrl(photo) : null,
    }))),
    ...(withPhotos && { photo_urls: await photoUrls(photos) }),
  }
}

export interface ListWorkOrdersQuery {
  farmId?: string
  houseId?: string
  // Phiếu của một thiết bị: bộ điều khiển hoặc camera
  nodeId?: string
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
  // Nhà không được giao: 403 như các route theo nhà khác, không phải danh sách rỗng
  if (query.houseId) filter.$and = [{ house_id: (await assertHouseAccess(query.houseId, user)).house._id }]
  if (query.nodeId) {
    // Nhà của thiết bị không được giao: 403; thiết bị không có: 404
    await assertNodeHouseAccess(query.nodeId, user)
    filter.node_id = query.nodeId
  }
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

interface TakeOver { set: Record<string, unknown>; note?: string; previousId?: string }

// Kỹ thuật viên làm phiếu của người khác, hay phiếu chưa giao ai, thì thành người nhận: thông báo sau đó tới đúng người đang làm.
// Farm Owner tự làm thì người nhận giữ nguyên
async function takeOverBy(wo: IWorkOrder, user: CurrentUser): Promise<TakeOver> {
  if (user.role !== 'FARM_TECHNICIAN' || (wo.assignee_id && String(wo.assignee_id) === user._id)) return { set: {} }
  const set = { assignee_id: user._id, assigned_at: new Date() }
  if (!wo.assignee_id) return { set, note: 'Nhận phiếu chưa giao ai' }
  const previous = await User.findById(wo.assignee_id).select('full_name').lean()
  return { set, note: `Nhận làm thay ${previous?.full_name ?? 'người được giao trước'}`, previousId: String(wo.assignee_id) }
}

async function afterTakeOver(wo: IWorkOrder, user: CurrentUser, claim: TakeOver): Promise<void> {
  if (!claim.note) return
  await audit(user, 'WORK_ORDER_REASSIGNED', wo, { from: claim.previousId ?? null, to: user._id, taken_over: true })
  if (claim.previousId) {
    const me = await User.findById(user._id).select('full_name').lean()
    await notifyAll([claim.previousId], wo, `Phiếu công việc đã có người nhận làm: ${wo.title}`,
      `${me?.full_name ?? 'Một kỹ thuật viên khác'} đã nhận làm phiếu này thay bạn.`)
  }
}

export async function startWorkOrder(id: string, user: CurrentUser) {
  const wo = await findWorkOrderWithAccess(id, user)
  const claim = await takeOverBy(wo, user)
  const updated = await transition(wo, ['OPEN'], 'IN_PROGRESS', { started_at: new Date(), ...claim.set }, user._id, claim.note)
  await afterTakeOver(updated, user, claim)
  return presentWorkOrder(updated, true)
}

// Mục DEFECT mở đúng một Work Order sửa chữa; ghi lại chỉ thay kết quả
export async function updateChecklistItem(
  id: string, user: CurrentUser, input: { item_index: number; result: 'OK' | 'DEFECT'; note?: string }, photo?: UploadedPhoto,
) {
  const wo = await findWorkOrderWithAccess(id, user)
  if (wo.kind !== 'PREVENTIVE' || wo.status !== 'IN_PROGRESS') {
    throw ConflictError('Chỉ ghi checklist của Work Order phòng ngừa đang làm')
  }
  const current = wo.checklist[input.item_index]
  if (!current) throw BadRequestError('Mục checklist không tồn tại')

  const prefix = `checklist.${input.item_index}`
  let repairId = current.repair_work_order_id
  if (input.result === 'DEFECT' && !repairId) {
    // Giữ chỗ id bằng cập nhật có điều kiện: bấm đúp chỉ tạo được một lần
    const claimedId = new Types.ObjectId()
    const claimed = await WorkOrder.findOneAndUpdate(
      // $not $type chứ không null: với mảng, null còn khớp khi phần tử khác thiếu trường
      { _id: wo._id, status: 'IN_PROGRESS', [`${prefix}.repair_work_order_id`]: { $not: { $type: 'objectId' } } },
      { $set: { [`${prefix}.repair_work_order_id`]: claimedId } },
      { new: true },
    )
    if (claimed) {
      try {
        const repair = await WorkOrder.create({
          _id: claimedId,
          farm_id: wo.farm_id, house_id: wo.house_id, zone_id: wo.zone_id, node_id: wo.node_id,
          kind: 'REPAIR', origin: 'CHECKLIST', title: `Sửa chữa: ${current.item}`,
          description: input.note?.trim() || `Kiểm tra theo checklist "${wo.title}" thấy hỏng`,
          assignee_id: wo.assignee_id, opened_by: user._id, history: [historyEntry(undefined, 'OPEN', user._id)],
        })
        await notifyAll(await handlerIds(repair), repair, `Phiếu công việc mới: ${repair.title}`, repair.description ?? '')
      } catch (err) {
        // Tạo lỗi thì trả chỗ giữ
        await WorkOrder.updateOne({ _id: wo._id, [`${prefix}.repair_work_order_id`]: claimedId },
          { $unset: { [`${prefix}.repair_work_order_id`]: 1 } })
        throw err
      }
      repairId = claimedId
    } else {
      // Lần ghi khác vừa giữ chỗ
      repairId = (await WorkOrder.findById(wo._id).select('checklist').lean())?.checklist[input.item_index]?.repair_work_order_id
    }
  }
  const note = input.note?.trim()
  // Lưu ảnh ngay trước lần ghi dùng nó: lỗi ở các bước trên không để lại ảnh
  const [photoKey] = photo ? await storePhotos([photo], `work-orders/${wo._id}/checklist`) : []
  const updated = await withStoredPhotos([photoKey], async () => {
    const result = await WorkOrder.findOneAndUpdate(
      { _id: wo._id, status: 'IN_PROGRESS' },
      {
        $set: {
          [`${prefix}.result`]: input.result,
          [`${prefix}.by`]: user._id,
          [`${prefix}.at`]: new Date(),
          ...(note && { [`${prefix}.note`]: note }),
          ...(photoKey && { [`${prefix}.photo`]: photoKey }),
          ...(repairId && { [`${prefix}.repair_work_order_id`]: repairId }),
        },
        // Mongoose bỏ qua key undefined trong $set
        ...(!note && { $unset: { [`${prefix}.note`]: 1 } }),
      },
      { new: true },
    )
    if (!result) throw ConflictError('Work Order vừa được người khác cập nhật, hãy tải lại')
    return result
  })
  return presentWorkOrder(updated, true)
}

// Không gắn cảnh báo thì → AWAITING_APPROVAL. Cảnh báo thiết bị phải có nguyên nhân (422)
export async function completeWorkOrder(
  id: string, user: CurrentUser, input: { cause?: SiteCause; work_note?: string }, files: UploadedPhoto[] = [],
) {
  const wo = await findWorkOrderWithAccess(id, user)
  if (wo.status !== 'IN_PROGRESS') throw ConflictError(`Phiếu công việc đang ở trạng thái ${WORK_ORDER_STATUS_LABEL[wo.status]}, chưa báo xong được`)
  if (!input.cause && wo.alert_type && AUTO_WORK_ORDER_TYPES.includes(wo.alert_type)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Cần ghi nguyên nhân tìm thấy tại chỗ')
  }
  // phòng ngừa kiểm bằng checklist đủ
  const preventive = wo.kind === 'PREVENTIVE'
  if (preventive && wo.checklist.some(i => !i.result)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Cần ghi kết quả mọi mục checklist trước khi báo xong')
  }
  const checklistPhotos = wo.checklist.filter(item => item.photo).length
  if (preventive && wo.photos.length + files.length + checklistPhotos < MIN_PREVENTIVE_PHOTOS) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Cần chụp ít nhất một ảnh bằng chứng trước khi báo xong bảo trì')
  }
  // tối đa 5 ảnh cả Work Order, gồm ảnh các lần trước
  if (wo.photos.length + files.length > MAX_WORK_ORDER_PHOTOS) {
    throw BadRequestError(`Mỗi Work Order tối đa ${MAX_WORK_ORDER_PHOTOS} ảnh (đã có ${wo.photos.length})`)
  }
  const photos = await storePhotos(files, `work-orders/${wo._id}`)
  const now = new Date()
  const to: WorkOrderStatus = wo.alert_id && !preventive ? 'VERIFYING' : 'AWAITING_APPROVAL'
  const claim = await takeOverBy(wo, user)
  // Diễn biến của bước này vẫn đọc là báo xong; nhận làm thay ghi kèm
  const doneNote = claim.note && `Báo xong, ${claim.note.charAt(0).toLowerCase()}${claim.note.slice(1)}`
  const updated = await withStoredPhotos(photos, () => transition(wo, ['IN_PROGRESS'], to, {
    done_at: now, cause: input.cause, work_note: input.work_note?.trim() || undefined,
    photos: [...wo.photos, ...photos], ...(to === 'AWAITING_APPROVAL' && { verified_at: now }), ...claim.set,
  }, user._id, doneNote))
  await afterTakeOver(updated, user, claim)
  if (wo.alert_id && input.cause) {
    await Alert.updateOne({ _id: wo.alert_id }, {
      $set: { site_cause: { cause: input.cause, photos, by: user._id, at: now } },
    })
  }
  if (to === 'AWAITING_APPROVAL') await notifyOwnersAwaitingApproval(updated)
  return presentWorkOrder(updated, true)
}

async function notifyOwnersAwaitingApproval(wo: IWorkOrder, unverified = false): Promise<void> {
  await notifyAll(await ownerIdsOf(wo.farm_id), wo, `Phiếu công việc chờ duyệt: ${wo.title}`, unverified
    ? 'Đã làm xong. Chưa có dữ liệu để kiểm phục hồi, chủ nhà yến kiểm tại nhà yến rồi duyệt để đóng phiếu.'
    : 'Đã làm xong và dữ liệu đã phục hồi. Chủ nhà yến duyệt để đóng phiếu.')
}

async function audit(user: CurrentUser, action: string, wo: IWorkOrder, metadata: Record<string, unknown> = {}) {
  await logAction(user._id, action, 'work_order', String(wo._id), { house_id: String(wo.house_id), ...metadata },
    { farmId: String(wo.farm_id) })
}

// MTTR tính tới lúc này
export async function approveWorkOrder(id: string, user: CurrentUser) {
  const wo = await findWorkOrderWithAccess(id, user)
  const now = new Date()
  const preventive = wo.kind === 'PREVENTIVE'
  const updated = await transition(wo, ['AWAITING_APPROVAL'], 'CLOSED', {
    closed_at: now, result: preventive ? 'DONE' : 'REPAIRED',
  }, user._id)
  if (wo.alert_id) {
    const closingNote = preventive ? 'Đã bảo trì, chủ nhà yến đã duyệt phiếu bảo trì' : 'Đã sửa, chủ nhà yến đã duyệt phiếu công việc'
    // Ghi chú người xác nhận đã viết thì giữ
    await Alert.updateOne({ _id: wo.alert_id, status: { $in: OPEN_ALERT_STATUSES } }, [{
      $set: {
        status: 'RESOLVED',
        resolved_at: now,
        acknowledgement_note: {
          $cond: [{ $gt: [{ $strLenCP: { $ifNull: ['$acknowledgement_note', ''] } }, 0] }, '$acknowledgement_note', { $literal: closingNote }],
        },
      },
    }])
  }
  if (preventive) await recordMaintenance(updated, user._id, now)
  await audit(user, 'WORK_ORDER_APPROVED', updated)
  return presentWorkOrder(updated, true)
}

export async function reopenWorkOrder(id: string, user: CurrentUser, note: string) {
  const wo = await findWorkOrderWithAccess(id, user)
  const updated = await transition(wo, ['AWAITING_APPROVAL'], 'IN_PROGRESS', { verified_at: null, done_at: null }, user._id, note)
  await audit(user, 'WORK_ORDER_REOPENED', updated, { note })
  await notifyAll(await handlerIds(updated), updated, `Phiếu công việc bị mở lại: ${updated.title}`, note)
  return presentWorkOrder(updated, true)
}

export async function cancelWorkOrder(id: string, user: CurrentUser, reason: string) {
  const wo = await findWorkOrderWithAccess(id, user)
  // huỷ phiếu phòng ngừa thì lượt kiểm sau lại mở phiếu mới; không cần thì xoá kế hoạch
  if (wo.kind === 'PREVENTIVE') {
    throw ConflictError('Work Order phòng ngừa không huỷ được; nếu không cần bảo trì nữa, hãy xoá kế hoạch bảo trì')
  }
  // VERIFYING huỷ được: lối ra khi không bao giờ phục hồi theo cách đo được
  const updated = await transition(wo, ['OPEN', 'IN_PROGRESS', 'VERIFYING'], 'CANCELLED', { closed_at: new Date(), cancel_reason: reason }, user._id, reason)
  await audit(user, 'WORK_ORDER_CANCELLED', updated, { reason })
  return presentWorkOrder(updated, true)
}

const VERDICT_CANCELLABLE: WorkOrderStatus[] = ['OPEN', 'IN_PROGRESS', 'VERIFYING']

// Cảnh báo bị bác bỏ: phiếu do chính lần "cần tới nhà" mở và chưa làm xong thì huỷ. Phiếu khác (thợ thấy hỏng tại chỗ,
// chủ nhà mở tay, đã làm xong chờ duyệt) có thể vẫn cần làm: ghi vào diễn biến, báo người giữ phiếu và chủ nhà yến quyết
export async function handleAlertRejected(alertId: unknown, user: CurrentUser, note: string): Promise<{ cancelled: number; noted: number }> {
  const result = { cancelled: 0, noted: 0 }
  const open = await WorkOrder.find({ alert_id: alertId, is_open: true, kind: 'REPAIR' })
  for (const wo of open) {
    const recipients = new Set(await handlerIds(wo))
    if (wo.origin === 'EXPERT' && VERDICT_CANCELLABLE.includes(wo.status)) {
      const reason = `Cảnh báo đã bị bác bỏ: ${note}`
      try {
        const updated = await transition(wo, VERDICT_CANCELLABLE, 'CANCELLED', { closed_at: new Date(), cancel_reason: reason }, user._id, reason)
        await audit(user, 'WORK_ORDER_CANCELLED', updated, { reason, alert_rejected: true })
        recipients.delete(user._id)
        await notifyAll([...recipients], updated, `Phiếu công việc đã huỷ: ${updated.title}`, reason)
        result.cancelled++
        continue
      } catch (err) {
        // Vừa đổi trạng thái (409): ghi chú như phiếu không huỷ được
        if (!(err instanceof AppError && err.statusCode === 409)) throw err
      }
    }
    const updated = await WorkOrder.findOneAndUpdate(
      { _id: wo._id, is_open: true },
      { $push: { history: historyEntry(wo.status, wo.status, user._id, `Cảnh báo của phiếu đã bị bác bỏ: ${note}`) } },
      { new: true },
    )
    if (!updated) continue
    for (const id of await ownerIdsOf(updated.farm_id)) recipients.add(id)
    recipients.delete(user._id)
    await notifyAll([...recipients], updated, `Cảnh báo của phiếu công việc đã bị bác bỏ: ${updated.title}`,
      `${asSentence(note)} Phiếu vẫn mở: chủ nhà yến quyết định làm tiếp hay huỷ phiếu.`)
    result.noted++
  }
  return result
}

// Vừa đổi trạng thái giữa lúc đọc và huỷ thì đọc lại
export async function cancelWorkOrdersOfPlace(
  place: { house_id: Types.ObjectId } | { zone_id: Types.ObjectId }, user: CurrentUser, reason: string,
): Promise<number> {
  const pending = await WorkOrder.find({ ...place, is_open: true })
  let cancelled = 0
  for (const found of pending) {
    let updated: IWorkOrder | null = null
    for (let attempt = 0; attempt < 2 && !updated; attempt++) {
      const wo = attempt === 0 ? found : await WorkOrder.findById(found._id)
      if (!wo?.is_open) break
      try {
        updated = await transition(wo, OPEN_WORK_ORDER_STATUSES, 'CANCELLED', { closed_at: new Date(), cancel_reason: reason }, user._id, reason)
      } catch (err) {
        if (!(err instanceof AppError) || attempt === 1) throw err
      }
    }
    if (!updated) continue
    await audit(user, 'WORK_ORDER_CANCELLED', updated, { reason })
    if (updated.assignee_id) {
      await notifyAll([String(updated.assignee_id)], updated, `Phiếu công việc đã huỷ: ${updated.title}`, reason)
    }
    cancelled++
  }
  return cancelled
}

// AWAITING_APPROVAL vẫn chờ duyệt như một lần ghi bảo trì
export async function cancelPlanWorkOrders(planId: Types.ObjectId, user: CurrentUser, reason: string): Promise<number> {
  const pending = await WorkOrder.find({ plan_id: planId, status: { $in: ['OPEN', 'IN_PROGRESS'] } })
  let cancelled = 0
  for (const wo of pending) {
    try {
      const updated = await transition(wo, ['OPEN', 'IN_PROGRESS'], 'CANCELLED', { closed_at: new Date(), cancel_reason: reason }, user._id, reason)
      await audit(user, 'WORK_ORDER_CANCELLED', updated, { reason })
      cancelled++
    } catch (err) {
      // Vừa có người đổi trạng thái (409)
      if (!(err instanceof AppError)) throw err
    }
  }
  return cancelled
}

export async function reassignWorkOrder(id: string, user: CurrentUser, assigneeId: string) {
  const wo = await findWorkOrderWithAccess(id, user)
  if (wo.status !== 'OPEN' && wo.status !== 'IN_PROGRESS') {
    throw ConflictError(`Phiếu công việc đang ở trạng thái ${WORK_ORDER_STATUS_LABEL[wo.status]}, không giao lại được`)
  }
  const house = await House.findById(wo.house_id)
  const farm = await Farm.findById(wo.farm_id).select('members')
  if (!house || !farm || !(await activeHouseTechnicianIds(house, farm)).includes(assigneeId)) {
    throw BadRequestError('Người nhận phải là kỹ thuật viên đang được giao nhà này')
  }
  // Không đặt lại escalated_at: chỉ báo trễ 1 lần mỗi Work Order
  const updated = await WorkOrder.findOneAndUpdate(
    { _id: wo._id, status: wo.status },
    {
      $set: { assignee_id: assigneeId, assigned_at: new Date() },
      $push: { history: historyEntry(wo.status, wo.status, user._id, 'Giao lại') },
    },
    { new: true },
  )
  if (!updated) throw ConflictError('Work Order vừa được người khác cập nhật, hãy tải lại')
  await audit(user, 'WORK_ORDER_REASSIGNED', updated, { from: wo.assignee_id ? String(wo.assignee_id) : null, to: assigneeId })
  await notifyAll([assigneeId], updated, `Phiếu công việc được giao cho bạn: ${updated.title}`, updated.description ?? '')
  return presentWorkOrder(updated, true)
}

// Firmware chỉ gửi khi sự cố xuất hiện: thấy lại sau "done" là quay lại. MISTING_INEFFECTIVE gửi lại nên dựa vào độ ẩm
const RERAISED_ON_RECURRENCE: AlertType[] = ['SENSOR_FAULT', 'RS485_BUS_FAILURE']
// Chưa có dữ liệu cho thấy phục hồi: chờ duyệt kèm ghi chú, Farm Owner kiểm tại chỗ
const UNVERIFIABLE_RECOVERY: AlertType[] = ['ACTUATOR_FAULT', 'SPEAKER_FAILURE', 'UNEXPECTED_RESTART']
// Cảm biến đọc lỗi thì telemetry bỏ trống trường đó
const RS485_FIELDS = ['temperature', 'humidity', 'light_lux', 'nh3_ppm', 'co2_ppm', 'sound_db'] as const

type VerifiedAlert = Pick<IAlert, 'type' | 'status' | 'resolved_at' | 'last_seen_at' | 'node_id' | 'zone_id'>

// null = chưa đóng. THRESHOLD_BREACH tự đóng sau 5 phút nên tính từ last_seen_at
function resolvedSince(alert: VerifiedAlert): Date | null {
  if (alert.status !== 'RESOLVED' || !alert.resolved_at) return null
  return alert.type === 'THRESHOLD_BREACH' ? alert.last_seen_at ?? alert.resolved_at : alert.resolved_at
}

// Không có telemetry thì chưa kết luận (mất kết nối là việc của NODE_OFFLINE)
async function telemetryStaysRecovered(nodeId: unknown, from: Date, isBad: Record<string, unknown>): Promise<boolean> {
  const [lastBad, latest] = await Promise.all([
    Telemetry.findOne({ node_id: nodeId, timestamp: { $gte: from }, ...isBad }).sort({ timestamp: -1 }).select('timestamp').lean(),
    Telemetry.findOne({ node_id: nodeId, timestamp: { $gte: from } }).sort({ timestamp: -1 }).select('timestamp').lean(),
  ])
  if (!latest) return false
  const recoveredFrom = lastBad ? lastBad.timestamp : from
  return latest.timestamp.getTime() - recoveredFrom.getTime() >= RECOVERY_VERIFY_MS
}

async function verificationOf(
  wo: IWorkOrder, alert: VerifiedAlert, now: Date,
): Promise<'RECOVERED' | 'RECURRED' | 'UNVERIFIABLE' | null> {
  const doneAt = wo.done_at
  if (!doneAt) return null
  if (RERAISED_ON_RECURRENCE.includes(alert.type) && alert.status !== 'RESOLVED' && alert.last_seen_at && alert.last_seen_at > doneAt) {
    return 'RECURRED'
  }
  // Cảnh báo đóng vì thiết bị rời chỗ, số đo sau đó cũng không còn của chỗ hỏng
  if (wo.device_left || UNVERIFIABLE_RECOVERY.includes(alert.type)) return 'UNVERIFIABLE'
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

// Mở tay hay chuyên gia mở trên cảnh báo đã đóng từ trước thì vẫn chờ người làm. Thiết bị rời chỗ thì chủ nhà yến quyết
function selfRecovered(wo: IWorkOrder, alert: VerifiedAlert, now: Date): boolean {
  if (wo.device_left) return false
  const since = resolvedSince(alert)
  return !!since && since > wo.opened_at && now.getTime() - since.getTime() >= RECOVERY_VERIFY_MS
}

export async function verifyWorkOrders(now = new Date()): Promise<{ verified: number; selfRecovered: number; escalated: number }> {
  const result = { verified: 0, selfRecovered: 0, escalated: 0 }
  const pending = await WorkOrder.find({ status: { $in: ['OPEN', 'VERIFYING'] }, alert_id: { $exists: true }, kind: { $ne: 'PREVENTIVE' } })
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
          const updated = await transition(wo, ['VERIFYING'], 'AWAITING_APPROVAL', { verified_at: now }, undefined, wo.device_left
            ? 'Thiết bị đã rời chỗ nên không kiểm phục hồi bằng dữ liệu được: chủ nhà yến kiểm tại nhà yến khi duyệt'
            : 'Chưa có dữ liệu để kiểm phục hồi: chủ nhà yến kiểm tại nhà yến khi duyệt')
          await notifyOwnersAwaitingApproval(updated, true)
          result.verified++
        }
      } else if (selfRecovered(wo, alert, now)) {
        await transition(wo, ['OPEN'], 'CLOSED', { closed_at: now, result: 'SELF_RECOVERED' }, undefined,
          'Cảnh báo tự phục hồi trước khi bắt đầu làm (OPS-FR-003)')
        result.selfRecovered++
      }
    } catch (err) {
      // 409: lượt sau xét lại. Lỗi khác chỉ ghi log để không dừng cả lượt
      if (!(err instanceof AppError && err.statusCode === 409)) {
        logger.error('Kiểm phục hồi Work Order thất bại', { workOrderId: String(wo._id), err })
      }
    }
  }

  // Work Order cũ chưa có assigned_at thì tính từ lúc mở
  const cutoff = new Date(now.getTime() - ESCALATION_MS)
  const stale = await WorkOrder.find({
    status: 'OPEN', assignee_id: { $exists: true }, escalated_at: null, kind: { $ne: 'PREVENTIVE' },
    $or: [{ assigned_at: { $lte: cutoff } }, { assigned_at: { $exists: false }, opened_at: { $lte: cutoff } }],
  })
  for (const wo of stale) {
    try {
      const { modifiedCount } = await WorkOrder.updateOne({ _id: wo._id, status: 'OPEN', escalated_at: null }, { $set: { escalated_at: now } })
      if (modifiedCount === 0) continue
      await notifyAll(await ownerIdsOf(wo.farm_id), wo, `Phiếu công việc chưa ai bắt đầu: ${wo.title}`,
        `Đã quá ${ESCALATION_MS / 60_000} phút từ lúc giao mà kỹ thuật viên chưa bắt đầu. Có thể giao lại cho người khác.`)
      result.escalated++
    } catch (err) {
      logger.error('Báo Work Order chưa ai bắt đầu thất bại', { workOrderId: String(wo._id), err })
    }
  }
  return result
}

export async function releaseTechnicianWorkOrders(
  technicianId: string, scope: { farmId?: unknown; houseId?: unknown }, by: string,
): Promise<number> {
  const orders = await WorkOrder.find({
    assignee_id: technicianId, is_open: true,
    ...(scope.farmId !== undefined && { farm_id: scope.farmId }), ...(scope.houseId !== undefined && { house_id: scope.houseId }),
  })
  for (const wo of orders) {
    const updated = await WorkOrder.findOneAndUpdate(
      { _id: wo._id, assignee_id: technicianId },
      {
        $unset: { assignee_id: 1, assigned_at: 1 },
        $push: { history: historyEntry(wo.status, wo.status, by, 'Kỹ thuật viên được giao đã rời nhà: chuyển cho chủ nhà yến') },
      },
      { new: true },
    )
    if (updated) {
      await notifyAll(await ownerIdsOf(updated.farm_id), updated, `Phiếu công việc chuyển cho bạn: ${updated.title}`,
        'Kỹ thuật viên được giao không còn ở nhà này. Giao lại cho người khác hoặc tự xử lý.')
    }
  }
  return orders.length
}
