import { Types } from 'mongoose'
import { Ticket, ITicket } from '@/models/ticket.model'
import { Alert } from '@/models/alert.model'
import { CameraNode, IN_SERVICE } from '@/models/device.model'
import { House, Zone } from '@/models/houseZone.model'
import { User } from '@/models/user.model'
import { Farm } from '@/models/farm.model'
import {
  listAccessibleFarmIds, assertFarmAccess, assertZoneInFarm,
} from '@/utils/farmAccess.util'
import { assertValidVisitTime, formatVisitTime } from '@/utils/visitTime.util'
import { logAction } from '@/services/auditLog.service'
import { getSlaHours, getTicketRouting } from '@/services/system.service'
import { notifyAdmins, notifyUser } from '@/services/notification.service'
import { postSystemMessage } from '@/services/ticketChat.service'
import { emitTicketAssigneeChanged, removeUserFromTicketRoom } from '@/socket'
import { escapeRegex, paginate } from '@/utils/helpers.util'
import { assigneeIdOf } from '@/utils/ticket.util'
import { NotFoundError, ForbiddenError, BadRequestError, ConflictError } from '@/utils/appError.util'
import logger from '@/utils/logger.util'
import type { CurrentUser, TicketType, TicketPriority, TicketStatus } from '@/types'

/** TICKET-FR-003 — priority mặc định theo loại; Technician/Admin chỉnh tay được sau */
const DEFAULT_PRIORITY: Record<TicketType, TicketPriority> = {
  RS485_BUS_FAILURE: 'P1',
  PREDATOR_DETECTED: 'P1',
  POWER_OUTAGE:      'P1',
  NODE_OFFLINE:      'P2',
  SPEAKER_FAILURE:   'P2',
  ACTUATOR_FAILURE:  'P2',
  SENSOR_FAULT:      'P2',
  EDGE_AI_DEGRADED:  'P2',
  INSTALLATION:      'P3', // không khẩn cấp — TICKET-FR-003
  MAINTENANCE:       'P3',
  OTHER:             'P3',
}

/**
 * TICKET-FR-006, SLA-NFR-001 — SLA do Admin cấu hình (system_settings), không
 * hard-code. Chưa cấu hình thì rơi về DEFAULT_SLA trong sla.util.
 */
async function slaDueDates(priority: TicketPriority, from: Date, resolveFrom: Date = from) {
  const sla = await getSlaHours()
  return {
    sla_response_due_at: new Date(from.getTime() + sla[priority].response_hours * 3600_000),
    sla_resolve_due_at:  new Date(resolveFrom.getTime() + sla[priority].resolve_hours * 3600_000),
  }
}

/**
 * TICKET-FR-013 — ticket bảo trì được sinh TRƯỚC giờ hẹn (`MAINTENANCE_LEAD_DAYS`, mặc
 * định 3 ngày ≈ đúng 72h của SLA P3). Tính hạn xử lý từ lúc tạo thì hạn rơi ngay sau giờ
 * hẹn chưa tới 1 tiếng (job chạy mỗi giờ), Technician đến đúng hẹn vẫn gần như chắc chắn
 * bị tính vượt SLA. Nên hạn xử lý tính từ giờ hẹn — việc chỉ bắt đầu được từ đó; hạn phản
 * hồi (xác nhận tiếp nhận) vẫn tính từ lúc tạo. Dùng giờ hẹn lúc tạo ticket: Technician
 * tự dời lịch về sau không kéo dài được hạn của mình.
 */
function maintenanceResolveFrom(ticket: Pick<ITicket, 'type' | 'created_at' | 'scheduled_visit_at'>): Date {
  return ticket.type === 'MAINTENANCE' && ticket.scheduled_visit_at ? ticket.scheduled_visit_at : ticket.created_at
}

/**
 * Ticket chuyển sang người khác thì quay về NEW để người mới xác nhận tiếp nhận — hạn
 * phản hồi phải tính lại từ lúc giao cho họ. Giữ hạn cũ (tính từ lúc tạo) thì ticket tạo
 * từ hôm trước bị đánh dấu trễ phản hồi ngay khi vừa chuyển, và Admin nhận cảnh báo
 * "chưa được tiếp nhận" cho người vừa nhận việc. Hạn xử lý giữ nguyên: đó là cam kết với
 * khách, đổi người không làm khách phải đợi thêm.
 */
async function restartResponseSla(ticket: ITicket): Promise<void> {
  const { sla_response_due_at } = await slaDueDates(ticket.priority, ticket.assigned_at ?? new Date())
  ticket.sla_response_due_at = sla_response_due_at
  ticket.is_sla_response_breached = false
}

/**
 * TICKET-FR-005b — Admin đổi ưu tiên: tính lại cả hai hạn theo ưu tiên mới, mỗi hạn đúng
 * mốc của nó — phản hồi từ lúc giao cho người đang giữ (như restartResponseSla), xử lý từ
 * lúc tạo (bảo trì: từ giờ hẹn). Trước đây hạn phản hồi tính từ lúc tạo: ticket đã chuyển
 * người mà nâng P3→P1 thì người vừa nhận bị gắn trễ ngay.
 *
 * Cờ vi phạm: việc đã xong (đã tiếp nhận / đã đóng) thì tính lại đúng theo hạn mới; việc
 * còn dở thì hạn mới chưa tới → gỡ cờ (hạ ưu tiên sau khi đã trễ — job chỉ bật cờ, không
 * bao giờ gỡ), đã qua → để job bật như mọi ticket khác (kèm ghi chú và báo Admin).
 */
async function recomputeSlaForPriority(ticket: ITicket): Promise<void> {
  const responseDue = (await slaDueDates(ticket.priority, ticket.assigned_at ?? ticket.created_at)).sla_response_due_at
  const resolveDue = (await slaDueDates(ticket.priority, ticket.created_at, maintenanceResolveFrom(ticket))).sla_resolve_due_at
  ticket.sla_response_due_at = responseDue
  ticket.sla_resolve_due_at = resolveDue
  const now = Date.now()

  if (ticket.responded_at) ticket.is_sla_response_breached = ticket.responded_at.getTime() > responseDue.getTime()
  else if (responseDue.getTime() > now) ticket.is_sla_response_breached = false

  if (ticket.closed_at) {
    const breached = ticket.closed_at.getTime() > resolveDue.getTime()
    if (breached && !ticket.is_sla_breached) ticket.sla_breached_by = ticket.assigned_to ?? undefined
    if (!breached) ticket.sla_breached_by = undefined
    ticket.is_sla_breached = breached
  } else if (resolveDue.getTime() > now) {
    ticket.is_sla_breached = false
    ticket.sla_breached_by = undefined
  }
}

/** TICKET-FR-007 — chỉ cho đi tiến theo thứ tự, không nhảy cóc/lùi tuỳ tiện */
const ALLOWED_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  NEW:                         ['IN_PROGRESS', 'CLOSED'],
  IN_PROGRESS:                 ['AWAITING_FIELD_CONFIRMATION', 'CLOSED'],
  AWAITING_FIELD_CONFIRMATION: ['CLOSED', 'IN_PROGRESS'],
  CLOSED:                      [],
}

/**
 * Loại ticket mà bản chất là 1 buổi đến hiện trường nên có lịch hẹn ngay từ đầu
 * (TICKET-FR-004b). Ticket sự cố cũng có thể có lịch, nhưng chỉ khi Technician
 * đã chẩn đoán từ xa và quyết định phải xuống (Flow 9 bước 6b) — xem scheduleVisit.
 */
const VISIT_TYPES: TicketType[] = ['INSTALLATION', 'MAINTENANCE']

/** Đã (hoặc sẽ) có buổi đến hiện trường → phải nghiệm thu SAT trước khi đóng (TICKET-FR-010, Flow 9 bước 6b) */
function requiresFieldVisit(ticket: Pick<ITicket, 'type' | 'scheduled_visit_at'>): boolean {
  return VISIT_TYPES.includes(ticket.type) || Boolean(ticket.scheduled_visit_at)
}

type SatItem = 'modbus_addresses_ok' | 'camera_rtsp_ok' | 'lte_connection_ok' | 'relay_test_ok'
const SAT_ITEMS_ALWAYS: SatItem[] = ['modbus_addresses_ok', 'lte_connection_ok', 'relay_test_ok']

/**
 * TICKET-FR-010 — mục camera chỉ bắt buộc khi nơi của ticket thật sự có camera: nhà yến chứa
 * Zone của ticket (camera gắn House, SRS v2.1.8), hoặc cả farm nếu ticket cấp farm. Nhà yến chỉ lắp cảm biến mà vẫn đòi
 * "camera RTSP ổn định" thì Technician buộc phải tick một mục không có thật để đóng
 * ticket, và dữ liệu nghiệm thu nói sai về hiện trường.
 */
async function requiredSatItems(ticket: Pick<ITicket, 'farm_id' | 'zone_id'>): Promise<SatItem[]> {
  const houseIds = ticket.zone_id
    ? await Zone.find({ _id: ticket.zone_id }).distinct('house_id')
    : await House.find({ farm_id: ticket.farm_id }).distinct('_id')
  const hasCamera = await CameraNode.exists({ house_id: { $in: houseIds }, ...IN_SERVICE })
  return hasCamera ? [...SAT_ITEMS_ALWAYS, 'camera_rtsp_ok'] : SAT_ITEMS_ALWAYS
}

/**
 * TICKET-FR-004/005 — Ticket Router: gán Technician phụ trách khu vực của Farm.
 * Áp dụng cho MỌI loại ticket kể cả INSTALLATION (SRS v1.12.0 bỏ bước Admin
 * điều phối tay). Chọn người ít việc nhất, bỏ qua người đã quá tải (≥ ngưỡng
 * Admin cấu hình) và người trong `exclude` (Technician vừa xin gán lại — Flow 9
 * case 4a). Trả về null nếu không còn ai → ticket vào hàng đợi chung, Admin can thiệp.
 *
 * Bằng số ticket mở thì ưu tiên người LÂU CHƯA ĐƯỢC GIAO nhất (rồi tới `_id` để
 * thứ tự luôn xác định). Trước đây hoà điểm rơi vào thứ tự MongoDB trả về —
 * gần như luôn là tài khoản tạo sớm nhất, người đóng việc nhanh lại nhận thêm
 * mãi trong khi người tạo sau ngồi chờ.
 */
async function routeToTechnician(farmId: string, opts: { exclude?: string[] } = {}): Promise<string | null> {
  const farm = await Farm.findById(farmId)
  if (!farm?.region) return null

  const candidates = await User.find({
    role: 'TECHNICIAN',
    is_active: true,
    assigned_regions: farm.region,
    ...(opts.exclude?.length ? { _id: { $nin: opts.exclude } } : {}),
  }).lean()
  if (candidates.length === 0) return null

  const { max_open_tickets_per_technician: maxOpen } = await getTicketRouting()

  // Chọn người đang ít việc nhất để tránh dồn tải (TICKET-FR-005). 1 aggregate
  // cho cả batch thay vì 1 countDocuments/candidate (N+1).
  const candidateIds = candidates.map(c => c._id)
  const loads = await Ticket.aggregate<{ _id: Types.ObjectId; open: number; lastAssignedAt: Date | null }>([
    { $match: { assigned_to: { $in: candidateIds } } },
    {
      $group: {
        _id: '$assigned_to',
        open: { $sum: { $cond: [{ $ne: ['$status', 'CLOSED'] }, 1, 0] } },
        lastAssignedAt: { $max: '$assigned_at' },
      },
    },
  ])
  const loadMap = new Map(loads.map(l => [String(l._id), l]))

  const available = candidates
    .map(c => {
      const load = loadMap.get(String(c._id))
      return { id: String(c._id), open: load?.open ?? 0, lastAssignedMs: load?.lastAssignedAt?.getTime() ?? 0 }
    })
    .filter(c => c.open < maxOpen)
    .sort((a, b) => a.open - b.open || a.lastAssignedMs - b.lastAssignedMs || a.id.localeCompare(b.id))
  return available[0]?.id ?? null
}

/** TICKET-FR-005 — không ai nhận được thì Admin phải biết, không để ticket nằm im trong hàng đợi */
function notifyUnassigned(ticket: Pick<ITicket, '_id' | 'type' | 'priority'>, why: string): void {
  void notifyAdmins({
    title: `Ticket ${ticket.priority} chưa có Technician phụ trách`,
    body: `Ticket ${String(ticket._id)} (${ticket.type}) đang ở hàng đợi chung: ${why}`,
  })
}

export interface CreateTicketInput {
  farm_id: string
  zone_id?: string
  type: TicketType
  description?: string
  /** Chỉ và bắt buộc khi type=INSTALLATION (TICKET-FR-004b); loại khác gửi kèm → 400 */
  scheduled_visit_at?: string
  alert_id?: string
}

/** TICKET-FR-001 — Farm Owner tạo ticket báo lỗi hoặc yêu cầu lắp đặt (Flow 9/9b) */
export async function createTicket(user: CurrentUser, input: CreateTicketInput): Promise<ITicket> {
  await assertFarmAccess(input.farm_id, user)

  if (input.type === 'MAINTENANCE') {
    // TICKET-FR-013 — bảo trì định kỳ chỉ sinh từ lịch bảo trì, không tạo tay
    throw BadRequestError('Ticket bảo trì định kỳ được tạo tự động từ lịch bảo trì, không tạo tay')
  }
  let visitAt: Date | undefined
  if (input.type === 'INSTALLATION') {
    // Flow 9b bước 1: Farm Owner chọn thẳng ngày giờ hẹn, không có bước liên hệ
    if (!input.scheduled_visit_at) throw BadRequestError('Yêu cầu lắp đặt phải chọn ngày giờ hẹn (scheduled_visit_at)')
    visitAt = assertValidVisitTime(input.scheduled_visit_at)
  } else if (input.scheduled_visit_at) {
    // Flow 9 bước 5–6b: ticket sự cố — Technician chẩn đoán từ xa trước, cần xuống thì mới hẹn
    throw BadRequestError('Chỉ yêu cầu lắp đặt mới chọn giờ hẹn khi tạo; ticket sự cố do Technician hẹn sau khi chẩn đoán')
  }
  if (input.zone_id) await assertZoneInFarm(input.zone_id, input.farm_id)

  const priority = DEFAULT_PRIORITY[input.type]
  const sla = await slaDueDates(priority, new Date())

  const assignedTo = await routeToTechnician(input.farm_id)
  if (!assignedTo) {
    logger.warn('Không tìm thấy Technician phụ trách khu vực — ticket vào hàng đợi chung (TICKET-FR-005)', {
      farmId: input.farm_id,
    })
  }

  const ticket = await Ticket.create({
    farm_id:  input.farm_id,
    zone_id:  input.zone_id,
    alert_id: input.alert_id,
    created_by: user._id,
    type:     input.type,
    priority,
    status:   'NEW',
    assigned_to: assignedTo ?? undefined,
    assigned_at: assignedTo ? new Date() : undefined,
    scheduled_visit_at: visitAt,
    ...sla,
    notes: input.description
      ? [{ author_id: user._id, content: input.description, created_at: new Date() }]
      : [],
  })

  if (assignedTo) notifyNewAssignment(assignedTo, ticket)
  else notifyUnassigned(ticket, 'không có Technician rảnh trong khu vực của farm')
  return ticket
}

/** TICKET-FR-004 — Ticket Router gán xong thì Technician phải biết ngay, kèm giờ hẹn nếu có */
function notifyNewAssignment(assignedTo: string, ticket: Pick<ITicket, '_id' | 'type' | 'priority' | 'scheduled_visit_at'>): void {
  void notifyUser(assignedTo, {
    title: `Bạn được gán ticket ${ticket.priority}`,
    body: `Ticket ${String(ticket._id)} (${ticket.type})${ticket.scheduled_visit_at ? ` — hẹn ${formatVisitTime(ticket.scheduled_visit_at)}` : ''}`,
  })
}

/**
 * TICKET-FR-005 — chia lại ticket đang ở hàng đợi chung. Trước đây ticket chỉ được
 * gán đúng 1 lần lúc tạo/chuyển; người mới vào vùng, người được mở khoá, người vừa
 * đóng bớt việc hay Admin nâng ngưỡng quá tải đều không kéo được ticket đang chờ,
 * chỉ Admin gán tay. Thứ tự: khẩn trước (P1 → P3), cùng mức thì chờ lâu trước.
 * Người từng phụ trách ticket bị loại như `requestReassign` — kể cả người Admin vừa
 * trả ticket về hàng đợi, nếu không ticket quay lại ngay tay họ.
 * `regions` giới hạn theo vùng (VD vùng của Technician vừa có suất); bỏ trống = mọi vùng.
 */
export async function drainUnassignedQueue(opts: { regions?: string[] } = {}): Promise<string[]> {
  if (opts.regions && opts.regions.length === 0) return []
  const farmFilter = opts.regions ? { region: { $in: opts.regions } } : { region: { $nin: [null, ''] } }
  // Model Farm đã tự lọc farm xoá mềm — ticket của farm đã xoá không chia lại
  const farmIds = await Farm.find(farmFilter).distinct('_id')
  if (farmIds.length === 0) return []

  const queued = await Ticket.find({ farm_id: { $in: farmIds }, assigned_to: null, status: { $ne: 'CLOSED' } })
    .sort({ priority: 1, created_at: 1 })
  const assigned: string[] = []
  for (const ticket of queued) {
    const declined = ticket.previous_assignees.map(p => String(p.user_id))
    const to = await routeToTechnician(String(ticket.farm_id), { exclude: declined })
    if (!to) continue

    const now = new Date()
    const { sla_response_due_at } = await slaDueDates(ticket.priority, now)
    // Gán có điều kiện: 2 lượt chia chạy cùng lúc (job + thao tác Admin) chỉ 1 bên giành được
    const claimed = await Ticket.findOneAndUpdate(
      { _id: ticket._id, assigned_to: null, status: { $ne: 'CLOSED' } },
      {
        $set: { assigned_to: to, assigned_at: now, status: 'NEW', sla_response_due_at, is_sla_response_breached: false },
        $unset: { responded_at: 1 },
        $push: { notes: { content: 'Hệ thống tự phân công Technician từ hàng đợi chung', created_at: now } },
      },
      { new: true },
    )
    if (!claimed) continue

    await logAction(undefined, 'TICKET_AUTO_ASSIGNED', 'ticket', String(claimed._id), { to, from: 'QUEUE' })
    await announceAssigneeChange(claimed, null)
    notifyNewAssignment(to, claimed)
    assigned.push(String(claimed._id))
  }
  return assigned
}

/**
 * Gọi `drainUnassignedQueue` sau một thao tác khác (tạo Technician, đóng ticket...):
 * lỗi chia lại chỉ ghi log, không làm hỏng thao tác chính — job định kỳ sẽ thử lại.
 */
export async function drainUnassignedQueueSafely(opts: { regions?: string[] } = {}): Promise<string[]> {
  try {
    return await drainUnassignedQueue(opts)
  } catch (err) {
    logger.error('drainUnassignedQueue failed', { err, regions: opts.regions })
    return []
  }
}

/**
 * Farm Owner là người phải có mặt ở hiện trường nên LUÔN được báo khi lịch hẹn
 * đổi, kể cả khi ticket do Admin tạo hộ; người tạo (nếu khác) cũng nhận để nắm.
 * `exclude` là người vừa thao tác — họ không cần push cho việc chính mình bấm.
 */
async function notifyVisitChange(
  ticket: ITicket, message: { title: string; body: string }, extra: string[] = [], exclude?: string,
): Promise<void> {
  const farm = await Farm.findById(ticket.farm_id).select('owner_id').lean()
  const recipients = new Set([farm?.owner_id, ticket.created_by, ...extra].filter(Boolean).map(String))
  if (exclude) recipients.delete(String(exclude))
  for (const userId of recipients) void notifyUser(userId, message)
}

/**
 * TICKET-FR-013 — ticket MAINTENANCE do job lịch bảo trì tạo (không có người
 * dùng tạo nên không qua createTicket/assertFarmAccess). Đi qua đúng Ticket
 * Router + SLA như ticket thường.
 */
export async function createMaintenanceTicket(input: {
  farm_id: string; zone_id?: string; scheduled_visit_at: Date; description: string
}): Promise<ITicket> {
  const priority = DEFAULT_PRIORITY.MAINTENANCE
  // Hạn xử lý tính từ giờ hẹn, không phải lúc tạo — xem maintenanceResolveFrom
  const sla = await slaDueDates(priority, new Date(), input.scheduled_visit_at)
  const assignedTo = await routeToTechnician(input.farm_id)

  const ticket = await Ticket.create({
    farm_id: input.farm_id,
    zone_id: input.zone_id,
    type: 'MAINTENANCE',
    priority,
    status: 'NEW',
    assigned_to: assignedTo ?? undefined,
    assigned_at: assignedTo ? new Date() : undefined,
    scheduled_visit_at: input.scheduled_visit_at,
    ...sla,
    notes: [{ content: input.description, created_at: new Date() }],
  })

  if (assignedTo) {
    void notifyUser(assignedTo, {
      title: 'Ticket bảo trì định kỳ mới',
      body: `${input.description} — hẹn ${formatVisitTime(input.scheduled_visit_at)}`,
    })
  } else {
    notifyUnassigned(ticket, 'không có Technician rảnh trong khu vực của farm')
  }
  return ticket
}

// ── Truy vấn / cập nhật ──────────────────────────────────────────────────────

/** Cột sắp xếp của GET /tickets — `sla` là hạn xử lý `sla_resolve_due_at` */
export const TICKET_SORT_KEYS = ['created_at', 'sla', 'status', 'priority'] as const
export type TicketSortKey = typeof TICKET_SORT_KEYS[number]

export interface ListTicketsQuery {
  farmId?: string; status?: string; priority?: string; assignedToMe?: boolean
  /** TICKET-FR-005 — hàng đợi chung: ticket chưa ai nhận */
  unassigned?: boolean
  /** TICKET-FR-009 — chỉ ticket vượt hạn xử lý SLA (xem `slaBreachedCondition`) */
  slaBreached?: boolean
  /**
   * Ticket của 1 thiết bị (_id SensorNode/CameraNode): ticket không lưu node, nên lấy qua cảnh báo — ticket có
   * `alert_id` trỏ tới cảnh báo mà `node_id` là thiết bị này (VD NODE_OFFLINE leo thang). Ticket bảo trì/lắp đặt/tự
   * tạo gắn với phòng, không có trong danh sách này
   */
  nodeId?: string
  /** Tìm trong ghi chú (mô tả lúc tạo là ghi chú đầu tiên) và tên farm */
  search?: string
  sort?: TicketSortKey; order?: 'asc' | 'desc'
  page?: number; limit?: number
}

/**
 * TICKET-FR-009 — ticket vượt hạn xử lý: đã bị job slaBreach đánh dấu, hoặc
 * còn mở mà đã qua hạn (job quét 2 phút/lần nên ticket vừa quá hạn chưa kịp
 * được đánh dấu). Ticket đã đóng chỉ tính theo cờ — đóng trước hạn thì không.
 * Cùng quy tắc với `isSlaBreached()` của frontend để số đếm và danh sách khớp.
 */
function slaBreachedCondition(now: Date) {
  return {
    $or: [
      { is_sla_breached: true },
      { status: { $ne: 'CLOSED' }, sla_resolve_due_at: { $lt: now } },
    ],
  }
}

/**
 * Bộ lọc chung của danh sách ticket và thống kê — luôn giới hạn trong farm
 * user được quyền xem. Id được ép sẵn sang ObjectId vì `$match` của aggregate
 * (dùng khi sắp xếp theo trạng thái) không tự cast như `find()`.
 */
async function buildTicketFilter(user: CurrentUser, query: ListTicketsQuery) {
  const accessibleFarms = await listAccessibleFarmIds(user)
  const filter: Record<string, unknown> = { farm_id: { $in: accessibleFarms } }
  const conditions: Record<string, unknown>[] = []

  // Lọc theo 1 farm cụ thể phải kiểm quyền riêng: gán thẳng query.farmId vào
  // filter sẽ ghi đè danh sách farm được phép ở trên, cho phép đọc ticket của
  // farm bất kỳ chỉ bằng cách đoán id.
  if (query.farmId) {
    await assertFarmAccess(query.farmId, user)
    filter.farm_id = new Types.ObjectId(query.farmId)
  }
  if (query.status) filter.status = query.status
  if (query.priority) filter.priority = query.priority
  if (query.assignedToMe) filter.assigned_to = new Types.ObjectId(user._id)
  else if (query.unassigned) filter.assigned_to = null
  if (query.slaBreached) conditions.push(slaBreachedCondition(new Date()))
  if (query.nodeId) {
    // Chỉ xét cảnh báo ĐÃ có ticket trỏ tới (trong các farm user được xem) — số ticket nhỏ và chặn trên, còn toàn bộ
    // cảnh báo của 1 thiết bị chạy lâu thì tăng mãi; tra ngược sang alerts bằng _id (có index) để lọc đúng thiết bị
    const linkedAlertIds = await Ticket.distinct('alert_id', { farm_id: filter.farm_id, alert_id: { $ne: null } })
    const alertIds = await Alert.find({ _id: { $in: linkedAlertIds }, node_id: new Types.ObjectId(query.nodeId) }).distinct('_id')
    conditions.push({ alert_id: { $in: alertIds } })
  }

  const term = query.search?.trim()
  if (term) {
    const pattern = new RegExp(escapeRegex(term), 'i')
    // Chỉ tìm tên trong các farm đã lọc ở trên — không lộ farm ngoài quyền
    const farmIds = await Farm.find({ _id: filter.farm_id, name: pattern }).distinct('_id')
    conditions.push({ $or: [{ 'notes.content': pattern }, { farm_id: { $in: farmIds } }] })
  }

  if (conditions.length) filter.$and = conditions
  return filter
}

/** Thứ tự nghiệp vụ của trạng thái — sắp theo chữ cái sẽ đưa AWAITING lên trước NEW */
const STATUS_RANK = { $switch: {
  branches: [
    { case: { $eq: ['$status', 'NEW'] }, then: 0 },
    { case: { $eq: ['$status', 'IN_PROGRESS'] }, then: 1 },
    { case: { $eq: ['$status', 'AWAITING_FIELD_CONFIRMATION'] }, then: 2 },
  ],
  default: 3,
} }

export async function listTickets(user: CurrentUser, query: ListTicketsQuery) {
  const filter = await buildTicketFilter(user, query)
  const { page, skip, limit } = paginate(query.page, query.limit)

  const dir = query.order === 'asc' ? 1 : -1
  const sortField = {
    created_at: 'created_at', sla: 'sla_resolve_due_at', status: '_status_rank', priority: 'priority',
  }[query.sort ?? 'created_at']
  // Thêm created_at + _id làm khoá phụ để thứ tự ổn định giữa các trang. Khi
  // cột chính đã là created_at thì không thêm lại: key trùng trong object literal
  // lấy giá trị viết sau, `order=asc` sẽ bị ghi đè thành -1.
  const sort: Record<string, 1 | -1> = sortField === 'created_at'
    ? { created_at: dir, _id: dir }
    : { [sortField]: dir, created_at: -1, _id: -1 }

  const [rows, total] = await Promise.all([
    Ticket.aggregate([
      { $match: filter },
      ...(query.sort === 'status' ? [{ $addFields: { _status_rank: STATUS_RANK } }] : []),
      { $sort: sort },
      { $skip: skip },
      { $limit: limit },
      ...(query.sort === 'status' ? [{ $project: { _status_rank: 0 } }] : []),
    ]),
    Ticket.countDocuments(filter),
  ])
  const records = await Ticket.populate(rows, { path: 'assigned_to', select: 'full_name email' })
  return { records, total, page, limit }
}

/**
 * GET /tickets/stats/me — số liệu tổng quan cho Technician đang đăng nhập, đếm
 * thẳng trên DB thay vì frontend tự đếm trên vài chục ticket đã tải về. Cùng
 * phạm vi với `GET /tickets?assignedToMe=true` nên con số khớp với danh sách.
 */
export async function getMyTicketStats(user: CurrentUser) {
  const filter = await buildTicketFilter(user, { assignedToMe: true })
  const now = new Date()
  const count = (extra: Record<string, unknown>) => Ticket.countDocuments({ $and: [filter, extra] })

  const [total, newCount, inProgress, awaiting, closed, slaBreached, slaBreachedOpen] = await Promise.all([
    Ticket.countDocuments(filter),
    count({ status: 'NEW' }),
    count({ status: 'IN_PROGRESS' }),
    count({ status: 'AWAITING_FIELD_CONFIRMATION' }),
    count({ status: 'CLOSED' }),
    count(slaBreachedCondition(now)),
    count({ ...slaBreachedCondition(now), status: { $ne: 'CLOSED' } }),
  ])

  return {
    total,
    open: total - closed,
    by_status: { NEW: newCount, IN_PROGRESS: inProgress, AWAITING_FIELD_CONFIRMATION: awaiting, CLOSED: closed },
    sla_breached: slaBreached,
    sla_breached_open: slaBreachedOpen,
  }
}

export async function getTicket(ticketId: string, user: CurrentUser): Promise<ITicket> {
  const ticket = await Ticket.findById(ticketId).populate('assigned_to', 'full_name email')
  if (!ticket) throw NotFoundError('Không tìm thấy ticket')
  await assertFarmAccess(String(ticket.farm_id), user)
  return ticket
}

export type StintEndReason =
  | 'REASSIGN_REQUESTED' | 'ADMIN_REASSIGNED' | 'ADMIN_UNASSIGNED' | 'REOPENED'
  | `REROUTED_${CoverageChangeReason}`

/**
 * TICKET-FR-012 — chốt lượt phụ trách của người đang giữ ticket vào `assignment_history`.
 * Phải gọi TRƯỚC khi đổi assigned_to / assigned_at / responded_at: lượt cũ cần đúng các
 * mốc của chính nó, còn KPI của người mới bắt đầu từ lượt mới.
 */
function endCurrentStint(ticket: ITicket, reason: StintEndReason): void {
  const holder = assigneeIdOf(ticket)
  if (!holder) return
  ticket.assignment_history.push({
    user_id: holder as never,
    assigned_at: ticket.assigned_at ?? ticket.created_at,
    responded_at: ticket.responded_at,
    ended_at: new Date(),
    end_reason: reason,
    response_breached: ticket.is_sla_response_breached,
  })
}

/**
 * TICKET-FR-017 — sau khi đổi người phụ trách: người cũ vào `previous_assignees`
 * kèm mốc bị chuyển — chỉ xem lại lịch sử tới mốc đó, mất quyền gửi — và thread
 * chat nhận 1 tin hệ thống. Gọi TRƯỚC `ticket.save()` để lưu cùng lượt. Người
 * từng phụ trách 2 lần thì giữ mốc mới nhất.
 */
function trackAssigneeChange(ticket: ITicket, from: string | null): void {
  if (!from || from === assigneeIdOf(ticket)) return
  const existing = ticket.previous_assignees.find(p => String(p.user_id) === from)
  if (existing) existing.until = new Date()
  else ticket.previous_assignees.push({ user_id: from as never, until: new Date() })
}

async function announceAssigneeChange(ticket: ITicket, from: string | null): Promise<void> {
  const to = assigneeIdOf(ticket)
  if (from === to) return
  const technician = to ? await User.findById(to).select('full_name').lean() : null
  const handover = await postSystemMessage(
    String(ticket._id),
    technician ? `Đã chuyển xử lý sang ${technician.full_name}` : 'Ticket đang chờ Administrator gán Technician mới',
  )
  // Nới mốc `until` của người cũ tới đúng tin bàn giao: họ cần thấy lý do mình
  // bị chuyển, nhưng không thấy trao đổi phát sinh sau đó.
  if (from) {
    await Ticket.updateOne(
      { _id: ticket._id, 'previous_assignees.user_id': from },
      { $set: { 'previous_assignees.$.until': handover.created_at } },
    )
  }
  emitTicketAssigneeChanged(String(ticket._id), { from, to })
  // Người cũ phải rời room ngay, nếu không vẫn nhận realtime cuộc trao đổi sau khi mất quyền
  if (from) removeUserFromTicketRoom(from, String(ticket._id))
}

/**
 * Quyền xem ticket của Technician đi theo khu vực (assigned_regions), nên mọi
 * Technician cùng vùng đều mở được ticket. Nhưng thao tác xử lý (đổi trạng
 * thái, SAT, escalate, đổi lịch, xin gán lại) chỉ thuộc về người đang được gán
 * — nếu không, Technician A đóng được ticket của Technician B và KPI tính sai
 * người. Admin luôn được phép (TICKET-FR-005b).
 */
function assertAssignee(ticket: ITicket, user: CurrentUser): void {
  if (user.role === 'ADMIN') return
  if (assigneeIdOf(ticket) !== user._id) {
    throw ForbiddenError('Chỉ Technician đang được gán ticket này mới được xử lý')
  }
}

/** TICKET-FR-007 + TICKET-FR-010 (chặn đóng khi SAT chưa đạt — lắp đặt/bảo trì, hoặc ticket sự cố đã hẹn xuống hiện trường) */
export async function updateStatus(
  ticketId: string, user: CurrentUser, newStatus: TicketStatus, note?: string,
): Promise<ITicket> {
  const ticket = await getTicket(ticketId, user)
  assertAssignee(ticket, user)

  if (!ALLOWED_TRANSITIONS[ticket.status].includes(newStatus)) {
    throw BadRequestError(`Không thể chuyển ticket từ ${ticket.status} sang ${newStatus}`)
  }

  if (newStatus === 'CLOSED' && requiresFieldVisit(ticket)) {
    const required = await requiredSatItems(ticket)
    if (!required.every(item => ticket.sat_checklist[item])) {
      // Flow 9b case 6a / Flow 9 bước 6b — không bàn giao khi nghiệm thu tại hiện trường chưa đạt
      throw ConflictError(`Chưa thể đóng ticket: checklist nghiệm thu (SAT) tại hiện trường chưa đạt đủ ${required.length} mục`)
    }
  }

  ticket.status = newStatus
  if (newStatus === 'CLOSED') ticket.closed_at = new Date()
  // Mốc tiếp nhận chỉ ghi lần đầu — IN_PROGRESS lần 2 (quay lại từ AWAITING_FIELD_CONFIRMATION) không phải phản hồi mới.
  // Đóng thẳng từ NEW (sự cố tự hết — Flow 9 case 5a) cũng là đã phản hồi, nếu
  // không công xử lý đó biến mất khỏi KPI thời gian phản hồi.
  if (!ticket.responded_at && (newStatus === 'IN_PROGRESS' || newStatus === 'CLOSED')) ticket.responded_at = new Date()
  if (note) ticket.notes.push({ author_id: user._id as never, content: note, created_at: new Date() })
  await ticket.save()
  if (newStatus === 'CLOSED') await drainQueueOfFarmRegion(ticket.farm_id)
  return ticket
}

/** Đóng/huỷ ticket làm người phụ trách có thêm suất — chia ticket đang chờ của vùng đó */
async function drainQueueOfFarmRegion(farmId: unknown): Promise<void> {
  const farm = await Farm.findById(farmId).select('region').lean()
  if (farm?.region) await drainUnassignedQueueSafely({ regions: [farm.region] })
}

/**
 * TICKET-FR-004b + Flow 9 bước 6b — Technician được gán đặt hoặc dời giờ đến hiện trường.
 * - Lắp đặt/bảo trì: giờ hẹn có sẵn từ lúc tạo; Technician không sắp xếp được thì tự dời.
 * - Ticket sự cố: chỉ hẹn được sau khi đã tiếp nhận (IN_PROGRESS) — Technician chẩn
 *   đoán/xử lý từ xa trước (TICKET-FR-008), không được thì mới hẹn xuống.
 * Lý do bắt buộc, không có bước thương lượng lịch qua lại; Farm Owner luôn được báo.
 */
export async function scheduleVisit(
  ticketId: string, user: CurrentUser, scheduledVisitAt: string, reason: string,
): Promise<ITicket> {
  const ticket = await getTicket(ticketId, user)
  assertAssignee(ticket, user)
  if (ticket.status === 'CLOSED') throw ConflictError('Ticket đã đóng')
  // Chặn hẹn khi chưa tiếp nhận (NEW); đang chờ nghiệm thu tại hiện trường
  // (AWAITING_FIELD_CONFIRMATION) vẫn phải dời lịch được — đó chính là lúc hay
  // phát sinh dời hẹn nhất (thiếu vật tư, khách bận).
  const SCHEDULABLE: TicketStatus[] = ['IN_PROGRESS', 'AWAITING_FIELD_CONFIRMATION']
  if (!VISIT_TYPES.includes(ticket.type) && !SCHEDULABLE.includes(ticket.status)) {
    throw ConflictError('Ticket sự cố chỉ hẹn đến hiện trường được sau khi đã tiếp nhận và chẩn đoán từ xa (trạng thái Đang xử lý)')
  }
  const next = assertValidVisitTime(scheduledVisitAt)

  const before = ticket.scheduled_visit_at ?? null
  ticket.scheduled_visit_at = next
  ticket.notes.push({
    author_id: user._id as never,
    content: before
      ? `Dời lịch hẹn từ ${formatVisitTime(before)} sang ${formatVisitTime(next)}: ${reason}`
      : `Hẹn đến hiện trường lúc ${formatVisitTime(next)}: ${reason}`,
    created_at: new Date(),
  })
  await ticket.save()

  await logAction(user._id, before ? 'TICKET_RESCHEDULED' : 'TICKET_VISIT_SCHEDULED', 'ticket', ticketId, { before, after: next, reason })
  await notifyVisitChange(ticket, before
    ? { title: 'Lịch hẹn kỹ thuật đã thay đổi', body: `Technician dời lịch hẹn sang ${formatVisitTime(next)}. Lý do: ${reason}` }
    : { title: 'Technician hẹn đến hiện trường', body: `Technician sẽ đến lúc ${formatVisitTime(next)}. Lý do: ${reason}` })
  return ticket
}

/**
 * Flow 9 bước 6a — Technician đã hẹn xuống farm nhưng rồi xử lý được từ xa (hoặc
 * hẹn nhầm ticket). Không xoá được lịch thì `requiresFieldVisit()` vẫn đòi đủ 4
 * mục SAT cho một buổi không hề diễn ra, ticket kẹt không đóng nổi.
 * Ticket lắp đặt/bảo trì luôn phải có buổi đến hiện trường nên chỉ dời, không huỷ.
 */
export async function cancelVisit(ticketId: string, user: CurrentUser, reason: string): Promise<ITicket> {
  const ticket = await getTicket(ticketId, user)
  assertAssignee(ticket, user)
  if (ticket.status === 'CLOSED') throw ConflictError('Ticket đã đóng')
  if (VISIT_TYPES.includes(ticket.type)) {
    throw BadRequestError('Ticket lắp đặt/bảo trì bắt buộc có buổi đến hiện trường — chỉ dời lịch, không huỷ')
  }
  if (!ticket.scheduled_visit_at) throw ConflictError('Ticket này chưa hẹn đến hiện trường')

  const before = ticket.scheduled_visit_at
  ticket.scheduled_visit_at = undefined
  ticket.notes.push({
    author_id: user._id as never,
    content: `Huỷ lịch hẹn ${formatVisitTime(before)} — xử lý từ xa, không cần đến hiện trường: ${reason}`,
    created_at: new Date(),
  })
  await ticket.save()

  await logAction(user._id, 'TICKET_VISIT_CANCELLED', 'ticket', ticketId, { before, reason })
  await notifyVisitChange(ticket, {
    title: 'Lịch hẹn kỹ thuật đã huỷ',
    body: `Không cần đến hiện trường lúc ${formatVisitTime(before)} nữa. Lý do: ${reason}`,
  })
  return ticket
}

/**
 * Flow 9 case 4a — Technician bị gán nhầm (ngoài khu vực thật, đang nghỉ...)
 * xin gán lại kèm lý do. Router thử người khác trong vùng (loại người xin);
 * không còn ai thì ticket vào hàng đợi chung và Admin được báo (TICKET-FR-005).
 * Ticket về NEW để người mới phải xác nhận tiếp nhận lại từ đầu.
 */
export async function requestReassign(ticketId: string, user: CurrentUser, reason: string): Promise<ITicket> {
  const ticket = await getTicket(ticketId, user)
  assertAssignee(ticket, user)
  if (ticket.status === 'CLOSED') throw ConflictError('Ticket đã đóng')

  const from = assigneeIdOf(ticket)
  // Loại cả những người từng bị chuyển khỏi ticket này: gán lại cho người vừa
  // từ chối chỉ tạo vòng đá qua đá lại, không ai xử lý.
  const declined = [...(from ? [from] : []), ...ticket.previous_assignees.map(p => String(p.user_id))]
  const to = await routeToTechnician(String(ticket.farm_id), { exclude: declined })

  // Lịch hẹn là cam kết của riêng người cũ với Farm Owner — giữ lại thì Technician
  // mới thừa hưởng một cuộc hẹn chưa từng xác nhận, và ticket sự cố còn bị kẹt
  // ràng buộc SAT cho buổi mà người mới chưa hề đến (requiresFieldVisit).
  const droppedVisit = ticket.scheduled_visit_at
  const visitStillAhead = !!droppedVisit && droppedVisit.getTime() > Date.now()
  if (droppedVisit && !VISIT_TYPES.includes(ticket.type)) ticket.scheduled_visit_at = undefined

  endCurrentStint(ticket, 'REASSIGN_REQUESTED')
  ticket.assigned_to = (to ?? undefined) as never
  ticket.assigned_at = to ? new Date() : undefined
  trackAssigneeChange(ticket, from)
  ticket.status = 'NEW'
  ticket.responded_at = undefined
  await restartResponseSla(ticket)
  ticket.notes.push({
    author_id: user._id as never,
    content: `Yêu cầu gán lại: ${reason}. ${to ? 'Đã chuyển cho Technician khác.' : 'Không còn Technician phù hợp — chờ Administrator điều phối.'}`
      + (droppedVisit && !VISIT_TYPES.includes(ticket.type)
        ? ` Lịch hẹn ${formatVisitTime(droppedVisit)} đã huỷ, Technician mới sẽ hẹn lại.` : ''),
    created_at: new Date(),
  })
  await ticket.save()

  await logAction(user._id, 'TICKET_REASSIGN_REQUESTED', 'ticket', ticketId, {
    from, to, reason, cancelledVisit: droppedVisit ?? null,
  })
  if (visitStillAhead && !VISIT_TYPES.includes(ticket.type)) {
    await notifyVisitChange(ticket, {
      title: 'Lịch hẹn kỹ thuật đã huỷ',
      body: `Ticket được chuyển sang Technician khác nên buổi hẹn lúc ${formatVisitTime(droppedVisit!)} không còn hiệu lực. Technician mới sẽ hẹn lại.`,
    })
  }
  await announceAssigneeChange(ticket, from)
  if (to) {
    void notifyUser(to, {
      title: `Bạn được gán ticket ${ticket.priority}`,
      body: `Ticket ${ticketId} (${ticket.type}) được chuyển từ Technician khác. Lý do: ${reason}`,
    })
  } else {
    notifyUnassigned(ticket, `Technician phụ trách xin gán lại (${reason}) và không còn ai rảnh trong vùng`)
  }
  return ticket.populate('assigned_to', 'full_name email')
}

/**
 * Flow 9 case 6c / Flow 9b case 4a — Farm Owner tự huỷ ticket của mình (đã tự
 * khắc phục được, hoặc đổi ý không cần lắp nữa). Khác updateStatus ở chỗ không
 * đòi SAT checklist vì đây là huỷ chứ không phải hoàn thành.
 */
export async function cancelTicket(ticketId: string, user: CurrentUser, reason: string): Promise<ITicket> {
  const ticket = await getTicket(ticketId, user)
  if (ticket.status === 'CLOSED') throw ConflictError('Ticket đã đóng')

  ticket.status = 'CLOSED'
  ticket.closed_at = new Date()
  ticket.cancelled_at = new Date()
  ticket.notes.push({
    author_id: user._id as never,
    content: `Huỷ bởi ${CANCELLED_BY_LABEL[user.role] ?? user.role}: ${reason}`,
    created_at: new Date(),
  })
  await ticket.save()

  // Flow 9 case 6c / 9b case 4a — Technician đang giữ ticket phải biết để không
  // xuống farm theo lịch cũ; Farm Owner cũng phải biết khi người huỷ là Admin.
  const visit = ticket.scheduled_visit_at && ticket.scheduled_visit_at.getTime() > Date.now()
    ? ` — không cần đến hiện trường lúc ${formatVisitTime(ticket.scheduled_visit_at)}`
    : ''
  const message = {
    title: 'Ticket đã bị huỷ',
    body: `Ticket ${ticketId} (${ticket.type}) đã được huỷ${visit}. Lý do: ${reason}`,
  }
  const assignee = assigneeIdOf(ticket)
  await notifyVisitChange(ticket, message, assignee ? [assignee] : [], user._id)
  if (assignee) await drainQueueOfFarmRegion(ticket.farm_id)
  return ticket
}

export type CoverageChangeReason = 'REGION_UNASSIGNED' | 'FARM_REGION_CHANGED' | 'ACCOUNT_DELETED' | 'ACCOUNT_LOCKED'

const COVERAGE_NOTE: Record<CoverageChangeReason, string> = {
  REGION_UNASSIGNED: 'Technician đang phụ trách không còn phụ trách khu vực của farm này.',
  FARM_REGION_CHANGED: 'Farm đã chuyển sang khu vực khác, Technician cũ không còn phụ trách.',
  ACCOUNT_DELETED: 'Tài khoản Technician đang phụ trách đã bị xoá theo yêu cầu.',
  ACCOUNT_LOCKED: 'Tài khoản Technician đang phụ trách đã bị khoá.',
}

export interface CoverageRerouteResult {
  rerouted: Array<{ ticketId: string; from: string; to: string }>
  /** Không còn ai trong vùng — về hàng đợi chung, Admin phải điều phối tay */
  unassigned: string[]
}

/**
 * Quyền xem ticket của Technician đi theo `assigned_regions` (farmAccess.util),
 * nên khi Admin gỡ một vùng khỏi Technician (AUTH-FR-005c) hoặc khi `region` của
 * farm đổi (FARM-FR-001), người đang được gán **mất quyền trên chính ticket của
 * mình**: mọi endpoint của ticket trả 403 — xem, đổi trạng thái, hẹn lịch, chat —
 * trong khi ticket vẫn mở và đồng hồ SLA vẫn chạy. `adminOverrideTicket` đã chặn
 * đúng tình huống này ở đường gán tay (muốn gán người ngoài vùng phải `force`),
 * nên hai đường đổi vùng cũng không được để ticket mắc kẹt im lặng.
 *
 * Xử lý y như Technician xin gán lại (`requestReassign`): tìm người khác trong
 * vùng, trả ticket về `NEW` để người mới xác nhận tiếp nhận, huỷ lịch hẹn của
 * người cũ (trừ ticket lắp đặt/bảo trì — giờ hẹn đó là của Farm Owner), không
 * còn ai thì về hàng đợi chung và báo Admin.
 *
 * Tài khoản Technician bị khoá (AUTH-FR-011) cũng tính là không còn phụ trách:
 * họ vẫn giữ `assigned_regions` nhưng không đăng nhập được, còn thông báo bỏ qua
 * user bị khoá — để nguyên thì ticket nằm im tới khi Admin nhớ ra mà gán lại.
 */
export async function rerouteTicketsOutOfCoverage(
  scope: { farmId?: string; technicianId?: string },
  actorId: string,
  reason: CoverageChangeReason,
): Promise<CoverageRerouteResult> {
  const result: CoverageRerouteResult = { rerouted: [], unassigned: [] }
  const query: Record<string, unknown> = { status: { $ne: 'CLOSED' }, assigned_to: { $ne: null } }
  if (scope.farmId) query.farm_id = scope.farmId
  if (scope.technicianId) query.assigned_to = scope.technicianId

  for (const ticket of await Ticket.find(query)) {
    const from = assigneeIdOf(ticket)
    if (!from) continue
    // Farm đã xoá mềm thì ticket được đóng ở closeTicketsOfDeletedFarm, không gán lại
    const farm = await Farm.findById(ticket.farm_id).select('region').lean()
    if (!farm) continue

    // Cùng phép thử với `isAssignedTechnician` của farmAccess.util, thêm điều kiện
    // tài khoản còn hoạt động — người cũ còn phụ trách vùng thì không có gì phải làm.
    const assignee = await User.findById(from).select('role assigned_regions is_active').lean()
    const isActive = assignee?.is_active !== false
    const stillCovers = assignee?.role === 'TECHNICIAN' && isActive && !!farm.region
      && (assignee.assigned_regions ?? []).includes(farm.region)
    if (stillCovers) continue

    const to = await routeToTechnician(String(ticket.farm_id), { exclude: [from] })
    const droppedVisit = ticket.scheduled_visit_at
    const dropsVisit = !!droppedVisit && !VISIT_TYPES.includes(ticket.type)
    const visitStillAhead = !!droppedVisit && droppedVisit.getTime() > Date.now()
    if (dropsVisit) ticket.scheduled_visit_at = undefined

    endCurrentStint(ticket, `REROUTED_${reason}`)
    ticket.assigned_to = (to ?? undefined) as never
    ticket.assigned_at = to ? new Date() : undefined
    trackAssigneeChange(ticket, from)
    ticket.status = 'NEW'
    ticket.responded_at = undefined
    await restartResponseSla(ticket)
    ticket.notes.push({
      author_id: actorId as never,
      content: `${COVERAGE_NOTE[reason]} ${to ? 'Đã chuyển cho Technician phụ trách vùng.' : 'Không còn Technician phù hợp — chờ Administrator điều phối.'}`
        + (dropsVisit ? ` Lịch hẹn ${formatVisitTime(droppedVisit!)} đã huỷ, Technician mới sẽ hẹn lại.` : ''),
      created_at: new Date(),
    } as never)
    await ticket.save()

    await logAction(actorId, 'TICKET_REROUTED', 'ticket', String(ticket._id), {
      from, to, reason, cancelledVisit: dropsVisit ? droppedVisit : null,
    })
    if (dropsVisit && visitStillAhead) {
      await notifyVisitChange(ticket, {
        title: 'Lịch hẹn kỹ thuật đã huỷ',
        body: `Ticket ${String(ticket._id)} đã chuyển sang Technician khác nên buổi hẹn lúc ${formatVisitTime(droppedVisit!)} không còn hiệu lực. Technician mới sẽ hẹn lại.`,
      })
    }
    await announceAssigneeChange(ticket, from)
    // Người bị khoá không đăng nhập được để làm gì với tin này
    if (isActive) {
      void notifyUser(from, {
        title: 'Ticket đã chuyển khỏi bạn',
        body: `Ticket ${String(ticket._id)} (${ticket.type}) không còn thuộc khu vực bạn phụ trách nên đã được điều phối lại.`,
      })
    }

    if (to) {
      notifyNewAssignment(to, ticket)
      result.rerouted.push({ ticketId: String(ticket._id), from, to })
    } else {
      notifyUnassigned(ticket, COVERAGE_NOTE[reason] + ' Không còn Technician nào rảnh trong vùng')
      result.unassigned.push(String(ticket._id))
    }
  }
  return result
}

/**
 * Farm bị xoá mềm (Primary Owner xoá — FARM-FR-001, hoặc Admin hoàn tất yêu cầu
 * xoá tài khoản — AUTH-FR-012) thì ticket đang mở của farm đó thành ticket chết:
 * model Farm lọc sẵn farm đã xoá nên `getTicket` trả 404 cho CẢ Admin và ticket
 * biến mất khỏi mọi danh sách — không ai đóng được nữa. Nhưng các phép đếm lại
 * đi thẳng trên collection `tickets`: chúng vẫn chiếm suất trong ngưỡng quá tải
 * của Router (Technician bị ngừng nhận việc mới), vẫn cộng vào
 * `/system/health-overview` và vẫn bị `slaBreach.job` gắn cờ vi phạm. Nên đóng
 * hẳn tại thời điểm xoá farm — đúng cách `removeFarm` đã làm cho Alert đang mở.
 *
 * Đánh `cancelled_at` (không phải "đã xử lý"): KPI tính riêng ticket huỷ nên
 * thời gian xử lý trung bình và tỉ lệ đúng SLA không bị bóp méo.
 */
export async function closeTicketsOfDeletedFarm(farmId: string, actorId: string): Promise<number> {
  const tickets = await Ticket.find({ farm_id: farmId, status: { $ne: 'CLOSED' } })

  for (const ticket of tickets) {
    const now = new Date()
    const previousStatus = ticket.status
    const assignee = assigneeIdOf(ticket)
    ticket.status = 'CLOSED'
    ticket.closed_at = now
    ticket.cancelled_at = now
    ticket.notes.push({
      author_id: actorId as never,
      content: 'Đóng tự động: farm của ticket này đã bị xoá',
      created_at: now,
    } as never)
    await ticket.save()

    await logAction(actorId, 'TICKET_CLOSED_FARM_DELETED', 'ticket', String(ticket._id), {
      farmId, previousStatus, assignedTo: assignee,
    })

    // Technician đang giữ ticket có thể đã hẹn xuống hiện trường — phải biết để không đi
    if (assignee) {
      const visit = ticket.scheduled_visit_at && ticket.scheduled_visit_at.getTime() > now.getTime()
        ? ` — không cần đến hiện trường lúc ${formatVisitTime(ticket.scheduled_visit_at)}`
        : ''
      void notifyUser(assignee, {
        title: 'Ticket đã đóng vì farm bị xoá',
        body: `Ticket ${String(ticket._id)} (${ticket.type}) đã đóng vì farm của nó đã bị xoá${visit}.`,
      })
    }
  }
  return tickets.length
}

export async function addNote(ticketId: string, user: CurrentUser, content: string): Promise<ITicket> {
  const ticket = await getTicket(ticketId, user)
  ticket.notes.push({ author_id: user._id as never, content, created_at: new Date() })
  await ticket.save()
  return ticket
}

/** TICKET-FR-010 */
export async function updateSatChecklist(
  ticketId: string, user: CurrentUser, updates: Partial<ITicket['sat_checklist']>,
): Promise<ITicket> {
  const ticket = await getTicket(ticketId, user)
  assertAssignee(ticket, user)
  if (ticket.status === 'CLOSED') throw ConflictError('Ticket đã đóng, không sửa checklist nghiệm thu được nữa')
  if (!requiresFieldVisit(ticket)) {
    throw BadRequestError('Checklist nghiệm thu chỉ dùng cho ticket lắp đặt/bảo trì hoặc ticket đã hẹn đến hiện trường')
  }
  ticket.sat_checklist = { ...ticket.sat_checklist, ...updates }
  await ticket.save()
  return ticket
}

/** TICKET-FR-009 / SLA-NFR-002 — escalate thủ công (tự động do job xử lý) */
export async function escalateTicket(ticketId: string, user: CurrentUser, reason?: string): Promise<ITicket> {
  const ticket = await getTicket(ticketId, user)
  assertAssignee(ticket, user)
  if (ticket.status === 'CLOSED') throw ConflictError('Ticket đã đóng')

  // KHÔNG bật `is_sla_breached`: escalate là xin hỗ trợ (thiếu linh kiện, vượt
  // khả năng xử lý), ticket có thể vẫn còn trong hạn. Trộn 2 khái niệm làm KPI
  // phạt oan Technician chủ động báo sớm (TICKET-FR-009 vs TICKET-FR-012).
  ticket.escalated_at = new Date()
  ticket.escalation_reason = reason
  ticket.notes.push({
    author_id: user._id as never,
    content: `Escalate lên Administrator${reason ? `: ${reason}` : ''}`,
    created_at: new Date(),
  })
  await ticket.save()

  await logAction(user._id, 'TICKET_ESCALATED', 'ticket', ticketId, { reason: reason ?? null })
  // Flow 9 bước 7: escalate nghĩa là Admin phải biết — trước đây chỉ bật cờ, không ai được báo
  void notifyAdmins({
    title: `Ticket ${ticket.priority} được escalate`,
    body: `Ticket ${ticketId} (${ticket.type}) cần Administrator can thiệp${reason ? `: ${reason}` : ''}`,
  })
  return ticket
}

/**
 * TICKET-FR-009, SLA-NFR-002 — gọi định kỳ từ jobs/slaBreach.job.ts. Trước đây
 * `is_sla_breached` chỉ bật khi Technician bấm escalate tay, nên ticket quá hạn
 * mà không ai đụng tới vẫn được tính là đúng SLA trong KPI của Admin.
 */
export async function markBreachedTickets(): Promise<number> {
  const overdue = await Ticket.find({
    status: { $ne: 'CLOSED' },
    is_sla_breached: false,
    sla_resolve_due_at: { $lt: new Date() },
  })

  for (const ticket of overdue) {
    ticket.is_sla_breached = true
    // KPI tính vi phạm cho người đang giữ ticket lúc trễ, không phải người được gán cuối cùng
    ticket.sla_breached_by = ticket.assigned_to ?? undefined
    ticket.notes.push({
      content: `Tự động đánh dấu vượt hạn xử lý SLA (hạn ${ticket.sla_resolve_due_at?.toISOString()})`,
      created_at: new Date(),
    } as never)
    await ticket.save()

    await logAction(undefined, 'TICKET_SLA_BREACHED', 'ticket', String(ticket._id), {
      priority: ticket.priority,
      assigned_to: ticket.assigned_to ? String(ticket.assigned_to) : null,
      sla_resolve_due_at: ticket.sla_resolve_due_at,
    })
    // Flow 9 bước 7: tự động escalate = thông báo Administrator
    void notifyAdmins({
      title: `Ticket ${ticket.priority} vượt hạn xử lý SLA`,
      body: `Ticket ${String(ticket._id)} (${ticket.type}) chưa đóng dù đã quá hạn ${ticket.sla_resolve_due_at?.toISOString()}`,
    })
  }
  return overdue.length
}

/**
 * TICKET-FR-004b — ticket vẫn NEW (chưa ai xác nhận tiếp nhận) khi đã quá
 * `sla_response_due_at`. Tách riêng cờ `is_sla_response_breached` vì trễ phản
 * hồi khác trễ xử lý: ticket có thể nhận muộn nhưng vẫn xong đúng hạn.
 */
export async function markResponseBreachedTickets(): Promise<number> {
  const late = await Ticket.find({
    status: 'NEW',
    responded_at: null,
    is_sla_response_breached: false,
    sla_response_due_at: { $lt: new Date() },
  })

  for (const ticket of late) {
    ticket.is_sla_response_breached = true
    ticket.notes.push({
      content: `Tự động đánh dấu vượt hạn phản hồi SLA — chưa Technician nào xác nhận tiếp nhận (hạn ${ticket.sla_response_due_at?.toISOString()})`,
      created_at: new Date(),
    } as never)
    await ticket.save()

    await logAction(undefined, 'TICKET_SLA_RESPONSE_BREACHED', 'ticket', String(ticket._id), {
      priority: ticket.priority,
      assigned_to: assigneeIdOf(ticket),
      sla_response_due_at: ticket.sla_response_due_at,
    })
    void notifyAdmins({
      title: `Ticket ${ticket.priority} chưa được tiếp nhận`,
      body: `Ticket ${String(ticket._id)} (${ticket.type}) quá hạn phản hồi mà vẫn chưa có Technician xác nhận`,
    })
  }
  return late.length
}

/** TICKET-FR-011 — Farm Owner đánh giá sau khi ticket đóng */
export async function rateTicket(ticketId: string, user: CurrentUser, rating: number): Promise<ITicket> {
  const ticket = await getTicket(ticketId, user) // đã xác nhận user có quyền trên farm của ticket
  if (ticket.status !== 'CLOSED') throw ConflictError('Chỉ đánh giá được ticket đã đóng')
  // Ticket huỷ cũng chuyển CLOSED nhưng không có việc nào được làm — chấm sao ở
  // đây chỉ làm nhiễu dữ liệu hài lòng (TICKET-FR-011).
  if (ticket.cancelled_at) throw ConflictError('Ticket đã huỷ nên không có việc để đánh giá')
  // Chấm lại nhiều lần thì điểm cũ mất không dấu vết, KPI đọc được mỗi con số
  // cuối — sửa điểm phải qua Admin để còn ghi audit.
  if (ticket.satisfaction_rating !== undefined) {
    throw ConflictError(`Ticket này đã được đánh giá ${ticket.satisfaction_rating} sao — liên hệ Administrator nếu cần sửa`)
  }

  const isCreator = !!ticket.created_by && String(ticket.created_by) === user._id
  // Ticket tự tạo từ Alert (TICKET-FR-002 cũ, nay là ALERT-FR-015; ticket cũ còn trong DB) không
  // có created_by vì chạy trong cron job, không có user context — coi Farm
  // Owner của farm đó (đã qua check quyền ở getTicket) là người được đánh giá,
  // thay vì chỉ giới hạn cho ADMIN.
  const isSystemGeneratedRatableByOwner = !ticket.created_by && user.role === 'FARM_OWNER'
  if (!isCreator && !isSystemGeneratedRatableByOwner && user.role !== 'ADMIN') {
    throw ForbiddenError('Chỉ người tạo ticket hoặc Farm Owner mới được đánh giá')
  }

  ticket.satisfaction_rating = rating
  await ticket.save()
  return ticket
}

const CANCELLED_BY_LABEL: Partial<Record<CurrentUser['role'], string>> = {
  FARM_OWNER: 'Farm Owner', ADMIN: 'Administrator',
}

/** TICKET-FR-012 — KPI cho Administrator */
const percent = (part: number, whole: number) => (whole ? +((part / whole) * 100).toFixed(1) : null)
const toHours = (ms?: number | null) => (ms ? +(ms / 3600_000).toFixed(1) : null)

export interface KpiRange { from?: string; to?: string }
const KPI_DEFAULT_DAYS = 30
const KPI_MAX_DAYS = 366
const DAY_MS = 86_400_000

function resolveKpiRange(range: KpiRange): { from: Date; to: Date } {
  const to = range.to ? new Date(range.to) : new Date()
  const from = range.from ? new Date(range.from) : new Date(to.getTime() - KPI_DEFAULT_DAYS * DAY_MS)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw BadRequestError('from/to phải là thời điểm ISO-8601 hợp lệ')
  if (from >= to) throw BadRequestError('from phải trước to')
  if (to.getTime() - from.getTime() > KPI_MAX_DAYS * DAY_MS) throw BadRequestError(`Khoảng thời gian tối đa ${KPI_MAX_DAYS} ngày`)
  return { from, to }
}

interface TechnicianStats {
  stints: number; respondedCount: number; responseMsSum: number; responseBreaches: number; reassignRequests: number
  closed: number; cancelled: number; resolvedCount: number; resolveMsSum: number
  due: number; dueBreached: number; escalated: number; reopened: number; open: number; unaccepted: number
}

/**
 * TICKET-FR-012 — KPI cho Administrator, trong khoảng `from`–`to` (mặc định 30 ngày).
 *
 * - Ticket bị huỷ (`cancelled_at`) không phải việc đã xử lý: loại khỏi thời gian xử lý
 *   và tỉ lệ SLA.
 * - Tỉ lệ đúng SLA tính trên MỌI ticket đã tới hạn trong kỳ, gồm cả ticket đang treo
 *   quá hạn — chỉ đếm ticket đã đóng thì ticket trễ nhất lại bị loại khỏi mẫu số.
 * - Theo Technician, trách nhiệm đi theo NGƯỜI ĐANG GIỮ ticket lúc sự việc xảy ra:
 *   phản hồi / trễ phản hồi / xin gán lại tính theo từng lượt phụ trách (lượt hiện tại +
 *   `assignment_history`); xử lý tính cho người giữ ticket lúc đóng, từ lúc HỌ nhận
 *   việc; vi phạm hạn xử lý tính cho `sla_breached_by`. Trước đây mọi thứ dồn cho người
 *   được gán cuối và thời gian xử lý tính từ lúc tạo — người nhận lại ticket đã trễ bị phạt oan.
 * - Hệ thống (cam kết với khách) vẫn tính theo ticket: tạo → đóng.
 * Ticket cũ chưa có `assigned_at` / `sla_breached_by` dùng `created_at` / `assigned_to` thay.
 */
export async function getKpi(range: KpiRange = {}) {
  const now = new Date()
  const { from, to } = resolveKpiRange(range)
  const inRange = { $gte: from, $lte: to }
  const dueEnd = to < now ? to : now

  const stats = new Map<string, TechnicianStats>()
  const statsOf = (id: unknown): TechnicianStats => {
    const key = String(id)
    let row = stats.get(key)
    if (!row) {
      row = {
        stints: 0, respondedCount: 0, responseMsSum: 0, responseBreaches: 0, reassignRequests: 0,
        closed: 0, cancelled: 0, resolvedCount: 0, resolveMsSum: 0,
        due: 0, dueBreached: 0, escalated: 0, reopened: 0, open: 0, unaccepted: 0,
      }
      stats.set(key, row)
    }
    return row
  }
  type Stint = { user_id: unknown; assigned_at: Date; responded_at?: Date; response_breached?: boolean; end_reason?: string }
  const countStint = (s: Stint) => {
    const row = statsOf(s.user_id)
    row.stints += 1
    if (s.responded_at) {
      row.respondedCount += 1
      row.responseMsSum += s.responded_at.getTime() - s.assigned_at.getTime()
    }
    if (s.response_breached) row.responseBreaches += 1
    if (s.end_reason === 'REASSIGN_REQUESTED') row.reassignRequests += 1
  }

  const [byStatus, currentStints, pastStints, closedTickets, dueTickets, escalatedTickets, reopens, openLoads] = await Promise.all([
    Ticket.aggregate([{ $match: { created_at: inRange } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Ticket.find({ assigned_to: { $ne: null }, $or: [{ assigned_at: inRange }, { assigned_at: null, created_at: inRange }] })
      .select('assigned_to assigned_at created_at responded_at is_sla_response_breached').lean(),
    Ticket.aggregate<Stint>([
      { $match: { 'assignment_history.assigned_at': inRange } },
      { $unwind: '$assignment_history' },
      { $match: { 'assignment_history.assigned_at': inRange } },
      { $replaceRoot: { newRoot: '$assignment_history' } },
    ]),
    Ticket.find({ status: 'CLOSED', closed_at: inRange }).select('assigned_to assigned_at created_at closed_at cancelled_at').lean(),
    Ticket.find({ cancelled_at: null, sla_resolve_due_at: { $gte: from, $lte: dueEnd } })
      .select('assigned_to sla_breached_by is_sla_breached').lean(),
    Ticket.find({ escalated_at: inRange, assigned_to: { $ne: null } }).select('assigned_to').lean(),
    Ticket.aggregate<{ holder_at_close?: unknown }>([
      { $match: { 'reopen_history.reopened_at': inRange } },
      { $unwind: '$reopen_history' },
      { $match: { 'reopen_history.reopened_at': inRange } },
      { $replaceRoot: { newRoot: '$reopen_history' } },
    ]),
    // Ảnh chụp hiện tại, không theo kỳ — Admin cần biết ai đang ôm việc mà chưa nhận
    Ticket.aggregate<{ _id: unknown; open: number; unaccepted: number }>([
      { $match: { assigned_to: { $ne: null }, status: { $ne: 'CLOSED' } } },
      { $group: { _id: '$assigned_to', open: { $sum: 1 }, unaccepted: { $sum: { $cond: [{ $eq: ['$status', 'NEW'] }, 1, 0] } } } },
    ]),
  ])

  for (const t of currentStints) {
    countStint({
      user_id: t.assigned_to, assigned_at: t.assigned_at ?? t.created_at,
      responded_at: t.responded_at, response_breached: t.is_sla_response_breached,
    })
  }
  for (const s of pastStints) countStint(s)

  let resolvedTickets = 0
  let resolveMsSum = 0
  for (const t of closedTickets) {
    if (!t.cancelled_at) {
      resolvedTickets += 1
      resolveMsSum += t.closed_at!.getTime() - t.created_at.getTime()
    }
    if (!t.assigned_to) continue
    const row = statsOf(t.assigned_to)
    row.closed += 1
    if (t.cancelled_at) {
      row.cancelled += 1
    } else {
      row.resolvedCount += 1
      row.resolveMsSum += t.closed_at!.getTime() - (t.assigned_at ?? t.created_at).getTime()
    }
  }

  let breachedTickets = 0
  for (const t of dueTickets) {
    if (t.is_sla_breached) breachedTickets += 1
    const responsible = t.is_sla_breached ? (t.sla_breached_by ?? t.assigned_to) : t.assigned_to
    if (!responsible) continue
    const row = statsOf(responsible)
    row.due += 1
    if (t.is_sla_breached) row.dueBreached += 1
  }
  for (const t of escalatedTickets) statsOf(t.assigned_to).escalated += 1
  for (const r of reopens) if (r.holder_at_close) statsOf(r.holder_at_close).reopened += 1
  for (const l of openLoads) Object.assign(statsOf(l._id), { open: l.open, unaccepted: l.unaccepted })

  const users = await User.find({ _id: { $in: [...stats.keys()] } }).select('full_name email').lean()
  const userById = new Map(users.map(u => [String(u._id), u]))

  return {
    period: { from, to },
    byStatus,
    byTechnician: [...stats.entries()].map(([id, row]) => ({
      technician_id: id,
      full_name: userById.get(id)?.full_name ?? null,
      email: userById.get(id)?.email ?? null,
      /** Số lượt nhận việc trong kỳ (một ticket chuyển qua lại có thể là nhiều lượt) */
      total: row.stints,
      closed: row.closed,
      cancelled: row.cancelled,
      open: row.open,
      unaccepted: row.unaccepted,
      avgResolveHours: row.resolvedCount ? toHours(row.resolveMsSum / row.resolvedCount) : null,
      avgResponseHours: row.respondedCount ? toHours(row.responseMsSum / row.respondedCount) : null,
      responseBreaches: row.responseBreaches,
      reassignRequests: row.reassignRequests,
      escalated: row.escalated,
      reopened: row.reopened,
      reopenRate: percent(row.reopened, row.resolvedCount),
      slaComplianceRate: percent(row.due - row.dueBreached, row.due),
    })),
    resolvedTickets,
    avgResolveHours: resolvedTickets ? toHours(resolveMsSum / resolvedTickets) : null,
    ticketsPastDue: dueTickets.length,
    slaComplianceRate: percent(dueTickets.length - breachedTickets, dueTickets.length),
    reopenedTickets: reopens.length,
    reopenRate: percent(reopens.length, resolvedTickets),
  }
}

export interface AdminOverrideInput {
  /** `null` = trả ticket về hàng đợi chung */
  assigned_to?: string | null
  priority?: TicketPriority
  scheduled_visit_at?: string
  status?: TicketStatus
  reason: string
  /** Ép gán Technician ngoài khu vực phụ trách — xem ghi chú trong hàm */
  force?: boolean
}

/**
 * TICKET-FR-005b — Administrator có toàn quyền can thiệp bất kỳ ticket nào, bất
 * kỳ lúc nào, không giới hạn ở SLA breach hay không tìm được Technician phù
 * hợp (khác `escalateTicket`/`updateStatus` vốn theo đúng quy trình thường).
 * Cố tình KHÔNG áp `ALLOWED_TRANSITIONS`/SAT checklist — đây là lối thoát cho
 * ngoại lệ/khiếu nại mà quy trình chuẩn không xử lý được.
 */
export async function adminOverrideTicket(
  ticketId: string, adminUser: CurrentUser, updates: AdminOverrideInput,
): Promise<ITicket> {
  const ticket = await Ticket.findById(ticketId)
  if (!ticket) throw NotFoundError('Không tìm thấy ticket')
  const previousAssignee = assigneeIdOf(ticket)

  const changes: Record<string, unknown> = {}
  const wasClosed = ticket.status === 'CLOSED'
  let droppedVisit: Date | undefined
  if (updates.assigned_to === null) {
    // Trả về hàng đợi chung: y như nhánh "không còn ai nhận" của requestReassign.
    // Người cũ vào previous_assignees nên lượt chia hàng đợi sau không giao lại cho họ.
    if (ticket.status === 'CLOSED') throw ConflictError('Ticket đã đóng — không trả về hàng đợi được')
    if (!previousAssignee) throw BadRequestError('Ticket đang ở hàng đợi chung, chưa gán cho ai')
    if (updates.status !== undefined && updates.status !== 'NEW') {
      throw BadRequestError('Ticket trả về hàng đợi chỉ ở trạng thái NEW — chưa có ai để tiếp nhận')
    }
    changes.assigned_to = { before: previousAssignee, after: null }
    endCurrentStint(ticket, 'ADMIN_UNASSIGNED')
    ticket.assigned_to = undefined as never
    ticket.assigned_at = undefined
    ticket.responded_at = undefined
    if (ticket.scheduled_visit_at && !VISIT_TYPES.includes(ticket.type) && updates.scheduled_visit_at === undefined) {
      droppedVisit = ticket.scheduled_visit_at
      changes.scheduled_visit_at = { before: droppedVisit, after: null }
      ticket.scheduled_visit_at = undefined
    }
    trackAssigneeChange(ticket, previousAssignee)
    if (ticket.status !== 'NEW') changes.status = { before: ticket.status, after: 'NEW' }
    ticket.status = 'NEW'
  } else if (updates.assigned_to !== undefined) {
    const technician = await User.findById(updates.assigned_to).select('role is_active assigned_regions').lean()
    if (!technician || technician.role !== 'TECHNICIAN' || !technician.is_active) {
      throw BadRequestError('Chỉ gán được cho Technician đang hoạt động')
    }

    // Quyền xem ticket của Technician dựa trên assigned_regions (farmAccess.util).
    // Gán người ngoài vùng thì chính họ mở ticket lên cũng bị chặn 403 — ticket
    // thành mồ côi. Admin vẫn ép được bằng force (TICKET-FR-005b), nhưng phải
    // là quyết định có ý thức và được ghi lại.
    const farm = await Farm.findById(ticket.farm_id).select('region').lean()
    const coversRegion = !!farm?.region && (technician.assigned_regions ?? []).includes(farm.region)
    // Chỉ đúng `true` mới ép được — chuỗi "false" (truthy) từ 1 đường gọi không qua route không được bỏ qua kiểm tra
    if (!coversRegion && updates.force !== true) {
      const regions = (technician.assigned_regions ?? []).join(', ') || 'chưa gán vùng nào'
      throw BadRequestError(
        `Technician này phụ trách ${regions}, không khớp khu vực "${farm?.region ?? 'chưa đặt'}" của farm. ` +
        'Gửi kèm force=true nếu vẫn muốn gán.',
      )
    }

    const assigneeChanged = previousAssignee !== String(technician._id)
    // Ticket đã đóng mà gán lại không kèm `status` thì nhánh dưới sẽ mở nó về
    // NEW trong khi `closed_at`/`cancelled_at` vẫn còn — dữ liệu mâu thuẫn và
    // job SLA lập tức báo vi phạm cho một ticket đã xong. Bắt Admin nói rõ ý định.
    if (assigneeChanged && ticket.status === 'CLOSED' && updates.status === undefined) {
      throw ConflictError('Ticket đã đóng — muốn gán lại cho Technician khác thì phải gửi kèm status để mở lại')
    }

    changes.assigned_to = { before: ticket.assigned_to ? String(ticket.assigned_to) : null, after: updates.assigned_to }
    if (!coversRegion) changes.forcedOutOfRegion = true
    if (assigneeChanged) endCurrentStint(ticket, 'ADMIN_REASSIGNED')
    ticket.assigned_to = technician._id
    // [5] Chỉ làm mới mốc giao việc khi thật sự đổi người: gán lại đúng người cũ
    // mà dời `assigned_at` về hiện tại sẽ khiến `responded_at` cũ nằm TRƯỚC mốc
    // giao, và KPI thời gian phản hồi cộng vào một khoảng âm.
    if (assigneeChanged) {
      ticket.assigned_at = new Date()
      // Lịch hẹn của ticket sự cố là cam kết của người cũ — bỏ như requestReassign/
      // reroute, nếu không người mới thừa hưởng buổi hẹn chưa từng nhận và bị ràng
      // buộc SAT cho buổi đó. Admin muốn giữ lịch thì gửi kèm scheduled_visit_at.
      if (ticket.scheduled_visit_at && !VISIT_TYPES.includes(ticket.type) && updates.scheduled_visit_at === undefined) {
        droppedVisit = ticket.scheduled_visit_at
        changes.scheduled_visit_at = { before: droppedVisit, after: null }
        ticket.scheduled_visit_at = undefined
      }
      // Mốc tiếp nhận của người cũ không thuộc về người mới. Admin ép luôn trạng thái
      // đã tiếp nhận thì coi như tiếp nhận ngay lúc gán; còn lại người mới tự xác nhận
      // và hạn phản hồi tính từ lúc giao cho họ.
      const acceptedByAdmin = updates.status !== undefined && updates.status !== 'NEW'
      ticket.responded_at = acceptedByAdmin ? new Date() : undefined
      if (!acceptedByAdmin) await restartResponseSla(ticket)
    }
    trackAssigneeChange(ticket, previousAssignee)
    // Người mới phải tự xác nhận tiếp nhận, trừ khi Admin ép luôn trạng thái
    if (assigneeChanged && updates.status === undefined) {
      changes.status = { before: ticket.status, after: 'NEW' }
      ticket.status = 'NEW'
    }
  }
  // Admin ép rời NEW (tiếp nhận / đóng hộ) mà người đang giữ chưa từng tiếp nhận: coi như
  // tiếp nhận lúc Admin ép — giống nhánh đổi người ở trên. Không ghi thì ticket "đang xử lý"
  // mà "chưa phản hồi", và KPI thời gian phản hồi bỏ sót nó.
  if (updates.status !== undefined && updates.status !== 'NEW' && !ticket.responded_at && assigneeIdOf(ticket)) {
    ticket.responded_at = new Date()
    changes.responded_at = { before: null, after: ticket.responded_at }
  }
  if (updates.priority !== undefined && updates.priority !== ticket.priority) {
    changes.priority = { before: ticket.priority, after: updates.priority }
    ticket.priority = updates.priority
    await recomputeSlaForPriority(ticket)
    changes.sla_resolve_due_at = ticket.sla_resolve_due_at
    changes.sla_response_due_at = ticket.sla_response_due_at
  }
  let visitChanged = false
  if (updates.scheduled_visit_at !== undefined) {
    // Admin toàn quyền đổi lịch (TICKET-FR-005b) nhưng vẫn theo cùng quy tắc giờ hẹn
    const next = assertValidVisitTime(updates.scheduled_visit_at)
    changes.scheduled_visit_at = { before: ticket.scheduled_visit_at ?? null, after: next }
    visitChanged = ticket.scheduled_visit_at?.getTime() !== next.getTime()
    ticket.scheduled_visit_at = next
  }
  const reopening = wasClosed && updates.status !== undefined && updates.status !== 'CLOSED'
  if (updates.status !== undefined) {
    changes.status = { before: ticket.status, after: updates.status }
    ticket.status = updates.status
    // Mở lại ticket đã đóng thì gỡ closed_at, nếu không KPI thời gian xử lý
    // trung bình (getKpi) sẽ tính theo lần đóng cũ. Gỡ cả `cancelled_at`: ticket
    // huỷ nhầm rồi mở lại mà vẫn mang dấu huỷ thì KPI loại nó vĩnh viễn khỏi
    // thời gian xử lý và tỉ lệ đúng SLA, dù sau đó có người làm thật.
    const reopened = updates.status !== 'CLOSED'
    // Ép CLOSED cho ticket đã đóng sẵn thì giữ mốc đóng cũ — ghi đè làm thời gian xử lý
    // trong KPI đổi theo lần bấm sau, dù việc đã xong từ trước
    if (reopened) ticket.closed_at = undefined
    else if (!wasClosed) ticket.closed_at = new Date()
    if (reopened && ticket.cancelled_at) {
      changes.cancelled_at = { before: ticket.cancelled_at, after: null }
      ticket.cancelled_at = undefined
    }
  }
  if (reopening) {
    // Mở lại = tiếp tục CÙNG yêu cầu (khách chưa được xử lý xong), không phải việc mới:
    // giữ cờ vi phạm cũ (khách đã chịu ảnh hưởng thật) nhưng đặt hạn xử lý mới từ lúc
    // mở lại — giữ hạn cũ thì job gắn vi phạm ngay cho phần việc vừa mở.
    const now = new Date()
    ticket.reopen_history.push({ reopened_at: now, holder_at_close: (previousAssignee ?? undefined) as never, reason: updates.reason })
    ticket.sla_resolve_due_at = (await slaDueDates(ticket.priority, now)).sla_resolve_due_at
    changes.reopened = { holderAtClose: previousAssignee, sla_resolve_due_at: ticket.sla_resolve_due_at }
    // Cùng người mà Admin đưa về NEW: người đó phải tiếp nhận lại — mở lượt phụ trách mới
    if (updates.status === 'NEW' && assigneeIdOf(ticket) === previousAssignee && previousAssignee) {
      endCurrentStint(ticket, 'REOPENED')
      ticket.assigned_at = now
      ticket.responded_at = undefined
      await restartResponseSla(ticket)
    }
  }

  ticket.notes.push({
    author_id: adminUser._id as never,
    content: `Admin can thiệp: ${updates.reason}`,
    created_at: new Date(),
  })
  await ticket.save()

  const newAssignee = assigneeIdOf(ticket)
  const assigneeReplaced = newAssignee !== previousAssignee

  await logAction(adminUser._id, 'TICKET_ADMIN_OVERRIDE', 'ticket', ticketId, {
    ...changes, ...(assigneeReplaced ? { notifiedAssignee: newAssignee } : {}),
  })
  await announceAssigneeChange(ticket, previousAssignee)

  if (reopening) {
    const holder = assigneeIdOf(ticket)
    await notifyVisitChange(ticket, {
      title: 'Ticket được mở lại',
      body: `Administrator mở lại ticket ${ticketId} (${ticket.type}). Lý do: ${updates.reason}`,
    }, holder ? [holder] : [], adminUser._id)
  }

  // Tin hệ thống trong thread chat chỉ tới người đang mở kênh đó — Technician vừa
  // được gán chưa từng phụ trách ticket này nên không có lý do mở, trong khi đồng
  // hồ SLA đã chạy từ lúc gán. Phải báo thẳng như createTicket/requestReassign.
  if (assigneeReplaced) {
    if (newAssignee) notifyNewAssignment(newAssignee, ticket)
    if (previousAssignee) {
      void notifyUser(previousAssignee, newAssignee
        ? {
          title: 'Ticket đã chuyển cho người khác',
          body: `Administrator chuyển ticket ${ticketId} (${ticket.type}) sang Technician khác. Lý do: ${updates.reason}`,
        }
        : {
          title: 'Ticket đã được gỡ khỏi bạn',
          body: `Administrator trả ticket ${ticketId} (${ticket.type}) về hàng đợi chung. Lý do: ${updates.reason}`,
        })
    }
  }
  if (visitChanged && ticket.scheduled_visit_at) {
    const assignee = assigneeIdOf(ticket)
    await notifyVisitChange(ticket, {
      title: 'Lịch hẹn kỹ thuật đã thay đổi',
      body: `Administrator đổi lịch hẹn sang ${formatVisitTime(ticket.scheduled_visit_at)}. Lý do: ${updates.reason}`,
    }, assignee ? [assignee] : [])
  }
  // Farm Owner đang chờ buổi hẹn đó — phải biết nó không còn hiệu lực (như requestReassign)
  if (droppedVisit && droppedVisit.getTime() > Date.now()) {
    await notifyVisitChange(ticket, {
      title: 'Lịch hẹn kỹ thuật đã huỷ',
      body: `Ticket được chuyển sang Technician khác nên buổi hẹn lúc ${formatVisitTime(droppedVisit)} không còn hiệu lực. Technician mới sẽ hẹn lại.`,
    })
  }
  // Admin đóng hộ → người phụ trách có thêm suất; trả về hàng đợi → chia ngay cho người
  // khác trong vùng nếu có ai rảnh (người vừa bị gỡ đã bị loại), không thì chờ ở hàng đợi
  if (updates.status === 'CLOSED' || (previousAssignee && !newAssignee)) await drainQueueOfFarmRegion(ticket.farm_id)
  return ticket.populate('assigned_to', 'full_name email')
}
