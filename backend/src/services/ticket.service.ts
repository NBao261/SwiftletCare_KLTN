import { Ticket, ITicket } from '@/models/ticket.model'
import { Alert } from '@/models/alert.model'
import { SensorNode } from '@/models/device.model'
import { User } from '@/models/user.model'
import { Farm } from '@/models/farm.model'
import { listAccessibleFarmIds, assertFarmAccess, findZoneChainOrThrow } from '@/utils/farmAccess.util'
import { logAction } from '@/services/auditLog.service'
import { getSlaHours, getTicketRouting } from '@/services/system.service'
import { notifyAdmins, notifyUser } from '@/services/notification.service'
import { postSystemMessage } from '@/services/ticketChat.service'
import { emitTicketAssigneeChanged, removeUserFromTicketRoom } from '@/socket'
import { paginate } from '@/utils/helpers.util'
import { assigneeIdOf } from '@/utils/ticket.util'
import { NotFoundError, ForbiddenError, BadRequestError, ConflictError } from '@/utils/appError.util'
import logger from '@/utils/logger.util'
import type { CurrentUser, AlertType, TicketType, TicketPriority, TicketStatus } from '@/types'

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
async function slaDueDates(priority: TicketPriority, from: Date) {
  const sla = await getSlaHours()
  const base = from.getTime()
  return {
    sla_response_due_at: new Date(base + sla[priority].response_hours * 3600_000),
    sla_resolve_due_at:  new Date(base + sla[priority].resolve_hours * 3600_000),
  }
}

/** TICKET-FR-007 — chỉ cho đi tiến theo thứ tự, không nhảy cóc/lùi tuỳ tiện */
const ALLOWED_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  NEW:                         ['IN_PROGRESS', 'CLOSED'],
  IN_PROGRESS:                 ['AWAITING_FIELD_CONFIRMATION', 'CLOSED'],
  AWAITING_FIELD_CONFIRMATION: ['CLOSED', 'IN_PROGRESS'],
  CLOSED:                      [],
}

const INSTALLATION_TYPES: TicketType[] = ['INSTALLATION', 'MAINTENANCE']

/**
 * Alert Engine phát nhiều loại cảnh báo hơn TicketType hỗ trợ — ép kiểu trực
 * tiếp (`alert.type as TicketType`) tạo ra giá trị enum không hợp lệ cho
 * BIRD_PANIC/THRESHOLD_BREACH/PUMP_DRY/LOW_RETURN_RATE, làm `Ticket.create`
 * throw ValidationError và crash cả batch xử lý stale alert. Map rõ ràng
 * từng giá trị, loại không có ticket type tương ứng thì dùng OTHER.
 */
const ALERT_TYPE_TO_TICKET_TYPE: Record<AlertType, TicketType> = {
  SENSOR_FAULT:      'SENSOR_FAULT',
  RS485_BUS_FAILURE: 'RS485_BUS_FAILURE',
  NODE_OFFLINE:      'NODE_OFFLINE',
  POWER_OUTAGE:      'POWER_OUTAGE',
  SPEAKER_FAILURE:   'SPEAKER_FAILURE',
  PREDATOR_DETECTED: 'PREDATOR_DETECTED',
  EDGE_AI_DEGRADED:  'EDGE_AI_DEGRADED',
  THRESHOLD_BREACH:  'OTHER',
  BIRD_PANIC:        'OTHER',
  PUMP_DRY:          'OTHER',
  LOW_RETURN_RATE:   'OTHER',
}

/**
 * TICKET-FR-004/005 — Ticket Router: gán Technician phụ trách khu vực của Farm.
 * Áp dụng cho MỌI loại ticket kể cả INSTALLATION (SRS v1.12.0 bỏ bước Admin
 * điều phối tay). Chọn người ít việc nhất, bỏ qua người đã quá tải (≥ ngưỡng
 * Admin cấu hình) và người trong `exclude` (Technician vừa xin gán lại — Flow 9
 * case 4a). Trả về null nếu không còn ai → ticket vào hàng đợi chung, Admin can thiệp.
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
  // cho cả batch thay vì 1 countDocuments/candidate (N+1) — cùng idiom "$in theo
  // batch" mà createTicketsFromStaleAlerts bên dưới đã dùng cho bước dedup.
  const candidateIds = candidates.map(c => c._id)
  const counts = await Ticket.aggregate([
    { $match: { assigned_to: { $in: candidateIds }, status: { $ne: 'CLOSED' } } },
    { $group: { _id: '$assigned_to', count: { $sum: 1 } } },
  ])
  const countMap = new Map(counts.map(c => [String(c._id), c.count as number]))

  const available = candidates
    .map(c => ({ id: String(c._id), open: countMap.get(String(c._id)) ?? 0 }))
    .filter(c => c.open < maxOpen)
    .sort((a, b) => a.open - b.open)
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
  scheduled_visit_at?: string // chỉ dùng cho INSTALLATION/MAINTENANCE (TICKET-FR-004b)
  alert_id?: string
}

/** TICKET-FR-001 — Farm Owner tạo ticket báo lỗi hoặc yêu cầu lắp đặt (Flow 9/9b) */
export async function createTicket(user: CurrentUser, input: CreateTicketInput): Promise<ITicket> {
  await assertFarmAccess(input.farm_id, user)

  // Zone phải thuộc đúng farm của ticket: `zone_id` lạ làm Technician tới nhầm
  // khu vực và mọi đối chiếu telemetry/cảnh báo sau đó đều trỏ sai chỗ.
  if (input.zone_id) {
    const chain = await findZoneChainOrThrow(input.zone_id)
    if (String(chain.farm._id) !== input.farm_id) throw BadRequestError('zone_id không thuộc farm này')
  }

  if (INSTALLATION_TYPES.includes(input.type) && !input.scheduled_visit_at) {
    // Flow 9b bước 1: Farm Owner chọn thẳng ngày giờ hẹn, không có bước liên hệ
    throw BadRequestError('Yêu cầu lắp đặt/bảo trì phải chọn ngày giờ hẹn (scheduled_visit_at)')
  }
  // Cùng ràng buộc với `rescheduleVisit`: hẹn trong quá khứ thì ticket vừa tạo đã trễ hẹn
  if (input.scheduled_visit_at) {
    const visitAt = new Date(input.scheduled_visit_at)
    if (Number.isNaN(visitAt.getTime()) || visitAt.getTime() <= Date.now()) {
      throw BadRequestError('Ngày hẹn phải ở tương lai')
    }
  }

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
    scheduled_visit_at: input.scheduled_visit_at ? new Date(input.scheduled_visit_at) : undefined,
    ...sla,
    notes: input.description
      ? [{ author_id: user._id, content: input.description, created_at: new Date() }]
      : [],
  })

  if (!assignedTo) notifyUnassigned(ticket, 'không có Technician rảnh trong khu vực của farm')
  return ticket
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
  const sla = await slaDueDates(priority, new Date())
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
      body: `${input.description} — hẹn ${input.scheduled_visit_at.toLocaleString('vi-VN')}`,
    })
  } else {
    notifyUnassigned(ticket, 'không có Technician rảnh trong khu vực của farm')
  }
  return ticket
}

/**
 * TICKET-FR-002 — tự tạo ticket từ Alert CRITICAL/HIGH chưa acknowledge sau 15
 * phút. Gọi định kỳ từ jobs/alertEscalation.job.ts.
 */
export const UNACKED_ALERT_THRESHOLD_MS = 15 * 60 * 1000

export async function createTicketsFromStaleAlerts(): Promise<number> {
  const staleBefore = new Date(Date.now() - UNACKED_ALERT_THRESHOLD_MS)
  const staleAlerts = await Alert.find({
    status: 'ACTIVE',
    severity: { $in: ['CRITICAL', 'HIGH'] },
    created_at: { $lt: staleBefore },
  })
  if (staleAlerts.length === 0) return 0

  // Batch dedup: 1 query cho cả batch thay vì findOne từng alert.
  const alreadyTicketed = new Set(
    (await Ticket.find({ alert_id: { $in: staleAlerts.map(a => a._id) } }).select('alert_id').lean())
      .map(t => String(t.alert_id)),
  )
  // Cảnh báo cũ của thiết bị đã gỡ (FARM-FR-008) không được biến thành ticket:
  // không còn gì ở hiện trường để sửa. 1 truy vấn cho cả batch, cùng idiom dedup ở trên.
  const nodeIds = [...new Set(staleAlerts.map(a => a.node_id).filter(Boolean))]
  const removedNodeIds = new Set(
    (await SensorNode.find({ _id: { $in: nodeIds }, decommissioned_at: { $ne: null } }).select('_id').lean())
      .map(n => String(n._id)),
  )

  const toProcess = staleAlerts.filter(a =>
    !alreadyTicketed.has(String(a._id)) && !(a.node_id && removedNodeIds.has(String(a.node_id))),
  )

  let created = 0
  for (const alert of toProcess) {
    try {
      const ticketType = ALERT_TYPE_TO_TICKET_TYPE[alert.type as AlertType] ?? 'OTHER'
      const priority = DEFAULT_PRIORITY[ticketType]
      const sla = await slaDueDates(priority, new Date())
      // Không cache theo farm: mỗi ticket vừa tạo làm tăng tải của người được gán,
      // cache sẽ dồn cả loạt alert của 1 farm cho cùng 1 người, vượt ngưỡng quá tải.
      const assignedTo = await routeToTechnician(String(alert.farm_id))

      const ticket = await Ticket.create({
        farm_id:  alert.farm_id,
        zone_id:  alert.zone_id,
        alert_id: alert._id,
        type:     ticketType,
        priority,
        status:   'NEW',
        assigned_to: assignedTo ?? undefined,
        assigned_at: assignedTo ? new Date() : undefined,
        ...sla,
        notes: [{
          content: `Tự tạo từ cảnh báo "${alert.title}" chưa được xác nhận sau 15 phút (TICKET-FR-002)`,
          created_at: new Date(),
        }],
      })
      if (!assignedTo) notifyUnassigned(ticket, 'không có Technician rảnh trong khu vực của farm')
      created++
    } catch (err) {
      // 1 alert lỗi không được chặn các alert khác trong cùng batch — trước
      // đây throw ở đây làm abort cả for loop, không tạo được ticket nào khác.
      logger.error('Tạo ticket tự động từ alert thất bại', { alertId: String(alert._id), err })
    }
  }
  return created
}

// ── Truy vấn / cập nhật ──────────────────────────────────────────────────────

export interface ListTicketsQuery {
  farmId?: string; status?: string; priority?: string; assignedToMe?: boolean
  /** TICKET-FR-005 — hàng đợi chung: ticket chưa ai nhận */
  unassigned?: boolean
  page?: number; limit?: number
}

export async function listTickets(user: CurrentUser, query: ListTicketsQuery) {
  const accessibleFarms = await listAccessibleFarmIds(user)
  const filter: Record<string, unknown> = { farm_id: { $in: accessibleFarms } }

  // Lọc theo 1 farm cụ thể phải kiểm quyền riêng: gán thẳng query.farmId vào
  // filter sẽ ghi đè danh sách farm được phép ở trên, cho phép đọc ticket của
  // farm bất kỳ chỉ bằng cách đoán id.
  if (query.farmId) {
    await assertFarmAccess(query.farmId, user)
    filter.farm_id = query.farmId
  }
  if (query.status) filter.status = query.status
  if (query.priority) filter.priority = query.priority
  if (query.assignedToMe) filter.assigned_to = user._id
  else if (query.unassigned) filter.assigned_to = null

  const { page, skip, limit } = paginate(query.page, query.limit)

  const [records, total] = await Promise.all([
    Ticket.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit)
      .populate('assigned_to', 'full_name email').lean(),
    Ticket.countDocuments(filter),
  ])
  return { records, total, page, limit }
}

export async function getTicket(ticketId: string, user: CurrentUser): Promise<ITicket> {
  const ticket = await Ticket.findById(ticketId).populate('assigned_to', 'full_name email')
  if (!ticket) throw NotFoundError('Không tìm thấy ticket')
  await assertFarmAccess(String(ticket.farm_id), user)
  return ticket
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

/** TICKET-FR-007 + TICKET-FR-010 (chặn đóng ticket lắp đặt khi SAT chưa đạt) */
export async function updateStatus(
  ticketId: string, user: CurrentUser, newStatus: TicketStatus, note?: string,
): Promise<ITicket> {
  const ticket = await getTicket(ticketId, user)
  assertAssignee(ticket, user)

  if (!ALLOWED_TRANSITIONS[ticket.status].includes(newStatus)) {
    throw BadRequestError(`Không thể chuyển ticket từ ${ticket.status} sang ${newStatus}`)
  }

  if (newStatus === 'CLOSED' && INSTALLATION_TYPES.includes(ticket.type)) {
    const sat = ticket.sat_checklist
    const allPassed = sat.modbus_addresses_ok && sat.camera_rtsp_ok && sat.lte_connection_ok && sat.relay_test_ok
    if (!allPassed) {
      // Flow 9b case 6a — không cho bàn giao khi nghiệm thu chưa đạt
      throw ConflictError('Chưa thể đóng ticket lắp đặt: checklist nghiệm thu (SAT) chưa đạt đủ 4 mục')
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
  return ticket
}

/**
 * TICKET-FR-004b — ngày hẹn do Farm Owner chọn lúc tạo ticket; Technician không
 * sắp xếp được thì tự dời, nhưng bắt buộc nêu lý do và Farm Owner phải được báo
 * (không có bước thương lượng lịch qua lại).
 */
export async function rescheduleVisit(
  ticketId: string, user: CurrentUser, scheduledVisitAt: string, reason: string,
): Promise<ITicket> {
  const ticket = await getTicket(ticketId, user)
  assertAssignee(ticket, user)
  if (!INSTALLATION_TYPES.includes(ticket.type)) {
    throw BadRequestError('Chỉ ticket lắp đặt/bảo trì mới có lịch hẹn')
  }
  if (ticket.status === 'CLOSED') throw ConflictError('Ticket đã đóng')

  const next = new Date(scheduledVisitAt)
  if (Number.isNaN(next.getTime()) || next.getTime() <= Date.now()) {
    throw BadRequestError('Ngày hẹn mới phải ở tương lai')
  }

  const before = ticket.scheduled_visit_at ?? null
  ticket.scheduled_visit_at = next
  ticket.notes.push({
    author_id: user._id as never,
    content: `Đổi lịch hẹn ${before ? `từ ${before.toISOString()} ` : ''}sang ${next.toISOString()}: ${reason}`,
    created_at: new Date(),
  })
  await ticket.save()

  await logAction(user._id, 'TICKET_RESCHEDULED', 'ticket', ticketId, { before, after: next, reason })
  // Farm Owner là người phải có mặt ở hiện trường (TICKET-FR-004b) nên LUÔN được
  // báo, kể cả khi ticket do Admin tạo hộ; người tạo (nếu khác) cũng nhận để nắm.
  const farm = await Farm.findById(ticket.farm_id).select('owner_id').lean()
  const recipients = new Set([farm?.owner_id, ticket.created_by].filter(Boolean).map(String))
  for (const userId of recipients) {
    void notifyUser(userId, {
      title: 'Lịch hẹn kỹ thuật đã thay đổi',
      body: `Technician dời lịch hẹn sang ${next.toLocaleString('vi-VN')}. Lý do: ${reason}`,
    })
  }
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

  ticket.assigned_to = (to ?? undefined) as never
  ticket.assigned_at = to ? new Date() : undefined
  trackAssigneeChange(ticket, from)
  ticket.status = 'NEW'
  ticket.responded_at = undefined
  ticket.notes.push({
    author_id: user._id as never,
    content: `Yêu cầu gán lại: ${reason}. ${to ? 'Đã chuyển cho Technician khác.' : 'Không còn Technician phù hợp — chờ Administrator điều phối.'}`,
    created_at: new Date(),
  })
  await ticket.save()

  await logAction(user._id, 'TICKET_REASSIGN_REQUESTED', 'ticket', ticketId, { from, to, reason })
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
    content: `Huỷ bởi ${user.role === 'FARM_OWNER' ? 'Farm Owner' : user.role}: ${reason}`,
    created_at: new Date(),
  })
  await ticket.save()
  return ticket
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
  // Chỉ ticket lắp đặt/bảo trì mới có nghiệm thu (TICKET-FR-010); tick checklist
  // trên ticket sự cố chỉ tạo dữ liệu vô nghĩa và không ảnh hưởng điều kiện đóng.
  if (!INSTALLATION_TYPES.includes(ticket.type)) {
    throw BadRequestError('Chỉ ticket lắp đặt/bảo trì mới có checklist nghiệm thu')
  }
  if (ticket.status === 'CLOSED') throw ConflictError('Ticket đã đóng, không sửa checklist nghiệm thu được nữa')
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

  const isCreator = !!ticket.created_by && String(ticket.created_by) === user._id
  // Ticket tự tạo từ Alert (TICKET-FR-002, createTicketsFromStaleAlerts) không
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

/** TICKET-FR-012 — KPI cho Administrator */
const percent = (part: number, whole: number) => (whole ? +((part / whole) * 100).toFixed(1) : null)
const toHours = (ms?: number | null) => (ms ? +(ms / 3600_000).toFixed(1) : null)

interface TechnicianKpiRow {
  _id: unknown
  total: number
  closed: number
  cancelled: number
  resolveMsSum: number
  resolvedCount: number
  due: number
  dueBreached: number
  responseMsSum: number
  respondedCount: number
  escalated: number
  technician?: { full_name?: string; email?: string }
}

/**
 * TICKET-FR-012 — KPI cho Administrator.
 *
 * Hai điểm quan trọng về cách tính, vì bản trước cho ra số liệu đẹp giả tạo:
 * - Ticket bị huỷ (`cancelled_at`) không phải việc đã xử lý, nên loại khỏi
 *   thời gian xử lý trung bình và khỏi tỉ lệ SLA.
 * - Tỉ lệ đúng SLA tính trên MỌI ticket đã tới hạn, gồm cả ticket đang treo
 *   quá hạn — nếu chỉ đếm ticket đã đóng thì ticket trễ nhất (chưa ai đóng)
 *   lại bị loại khỏi mẫu số, làm tỉ lệ luôn gần 100%.
 */
export async function getKpi() {
  const now = new Date()
  const resolvedMatch = { status: 'CLOSED', closed_at: { $ne: null }, cancelled_at: null }
  const dueMatch = { cancelled_at: null, sla_resolve_due_at: { $ne: null, $lt: now } }

  const [byStatus, byTechnician, resolveStats, slaStats] = await Promise.all([
    Ticket.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Ticket.aggregate<TechnicianKpiRow>([
      { $match: { assigned_to: { $ne: null } } },
      {
        $group: {
          _id: '$assigned_to',
          total: { $sum: 1 },
          closed: { $sum: { $cond: [{ $eq: ['$status', 'CLOSED'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $ne: [{ $ifNull: ['$cancelled_at', null] }, null] }, 1, 0] } },
          resolveMsSum: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'CLOSED'] }, { $eq: [{ $ifNull: ['$cancelled_at', null] }, null] }] }, { $subtract: ['$closed_at', '$created_at'] }, 0] } },
          resolvedCount: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'CLOSED'] }, { $eq: [{ $ifNull: ['$cancelled_at', null] }, null] }] }, 1, 0] } },
          due: { $sum: { $cond: [{ $and: [{ $eq: [{ $ifNull: ['$cancelled_at', null] }, null] }, { $lt: ['$sla_resolve_due_at', now] }] }, 1, 0] } },
          dueBreached: { $sum: { $cond: [{ $and: [{ $eq: [{ $ifNull: ['$cancelled_at', null] }, null] }, { $lt: ['$sla_resolve_due_at', now] }, '$is_sla_breached'] }, 1, 0] } },
          // TICKET-FR-004b — từ lúc ticket được giao (không phải lúc tạo) tới lúc Technician xác nhận tiếp nhận
          responseMsSum: { $sum: { $cond: [{ $ne: [{ $ifNull: ['$responded_at', null] }, null] }, { $subtract: ['$responded_at', { $ifNull: ['$assigned_at', '$created_at'] }] }, 0] } },
          respondedCount: { $sum: { $cond: [{ $ne: [{ $ifNull: ['$responded_at', null] }, null] }, 1, 0] } },
          escalated: { $sum: { $cond: [{ $ne: [{ $ifNull: ['$escalated_at', null] }, null] }, 1, 0] } },
        },
      },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'technician' } },
      { $unwind: { path: '$technician', preserveNullAndEmptyArrays: true } },
    ]),
    Ticket.aggregate([
      { $match: resolvedMatch },
      { $group: { _id: null, avgResolveMs: { $avg: { $subtract: ['$closed_at', '$created_at'] } }, total: { $sum: 1 } } },
    ]),
    Ticket.aggregate([
      { $match: dueMatch },
      { $group: { _id: null, total: { $sum: 1 }, breached: { $sum: { $cond: ['$is_sla_breached', 1, 0] } } } },
    ]),
  ])

  const resolved = resolveStats[0] as { avgResolveMs?: number; total?: number } | undefined
  const sla = slaStats[0] as { total?: number; breached?: number } | undefined

  return {
    byStatus,
    byTechnician: byTechnician.map(row => ({
      technician_id: String(row._id),
      full_name: row.technician?.full_name ?? null,
      email: row.technician?.email ?? null,
      total: row.total,
      closed: row.closed,
      cancelled: row.cancelled,
      avgResolveHours: row.resolvedCount ? toHours(row.resolveMsSum / row.resolvedCount) : null,
      avgResponseHours: row.respondedCount ? toHours(row.responseMsSum / row.respondedCount) : null,
      escalated: row.escalated,
      slaComplianceRate: percent(row.due - row.dueBreached, row.due),
    })),
    resolvedTickets: resolved?.total ?? 0,
    avgResolveHours: toHours(resolved?.avgResolveMs),
    ticketsPastDue: sla?.total ?? 0,
    slaComplianceRate: percent((sla?.total ?? 0) - (sla?.breached ?? 0), sla?.total ?? 0),
  }
}

export interface AdminOverrideInput {
  assigned_to?: string
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
  if (updates.assigned_to !== undefined) {
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
    ticket.assigned_to = technician._id
    // [5] Chỉ làm mới mốc giao việc khi thật sự đổi người: gán lại đúng người cũ
    // mà dời `assigned_at` về hiện tại sẽ khiến `responded_at` cũ nằm TRƯỚC mốc
    // giao, và KPI thời gian phản hồi cộng vào một khoảng âm.
    if (assigneeChanged) ticket.assigned_at = new Date()
    trackAssigneeChange(ticket, previousAssignee)
    // Người mới phải tự xác nhận tiếp nhận, trừ khi Admin ép luôn trạng thái
    if (assigneeChanged && updates.status === undefined) {
      changes.status = { before: ticket.status, after: 'NEW' }
      ticket.status = 'NEW'
      ticket.responded_at = undefined
    }
  }
  if (updates.priority !== undefined && updates.priority !== ticket.priority) {
    // SLA tính theo priority (TICKET-FR-006) và mốc là lúc tạo ticket, không
    // phải lúc Admin sửa — nếu không, nâng P3→P1 vẫn giữ hạn 72h cũ.
    const sla = await slaDueDates(updates.priority, ticket.created_at)
    changes.priority = { before: ticket.priority, after: updates.priority }
    ticket.priority = updates.priority
    ticket.sla_response_due_at = sla.sla_response_due_at
    ticket.sla_resolve_due_at  = sla.sla_resolve_due_at
    changes.sla_resolve_due_at = ticket.sla_resolve_due_at
  }
  if (updates.scheduled_visit_at !== undefined) {
    ticket.scheduled_visit_at = new Date(updates.scheduled_visit_at)
    changes.scheduled_visit_at = updates.scheduled_visit_at
  }
  if (updates.status !== undefined) {
    changes.status = { before: ticket.status, after: updates.status }
    ticket.status = updates.status
    // Mở lại ticket đã đóng thì gỡ closed_at, nếu không KPI thời gian xử lý
    // trung bình (getKpi) sẽ tính theo lần đóng cũ.
    ticket.closed_at = updates.status === 'CLOSED' ? new Date() : undefined
  }

  ticket.notes.push({
    author_id: adminUser._id as never,
    content: `Admin can thiệp: ${updates.reason}`,
    created_at: new Date(),
  })
  await ticket.save()

  await logAction(adminUser._id, 'TICKET_ADMIN_OVERRIDE', 'ticket', ticketId, changes)
  await announceAssigneeChange(ticket, previousAssignee)
  return ticket.populate('assigned_to', 'full_name email')
}
