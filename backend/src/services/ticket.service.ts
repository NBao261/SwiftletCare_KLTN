import { Ticket, ITicket } from '@/models/ticket.model'
import { Alert } from '@/models/alert.model'
import { User } from '@/models/user.model'
import { Farm } from '@/models/farm.model'
import { listAccessibleFarmIds, assertFarmAccess } from '@/utils/farmAccess.util'
import { logAction } from '@/services/auditLog.service'
import { getSlaHours } from '@/services/system.service'
import { paginate } from '@/utils/helpers.util'
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
 * TICKET-FR-004 — Ticket Router: gán Technician phụ trách khu vực của Farm.
 * Áp dụng cho MỌI loại ticket kể cả INSTALLATION (SRS v1.12.0 bỏ bước Admin
 * điều phối tay). Trả về null nếu không có ai phù hợp → TICKET-FR-005 để Admin
 * can thiệp.
 */
async function routeToTechnician(farmId: string): Promise<string | null> {
  const farm = await Farm.findById(farmId)
  if (!farm?.region) return null

  const candidates = await User.find({
    role: 'TECHNICIAN',
    is_active: true,
    assigned_regions: farm.region,
  }).lean()
  if (candidates.length === 0) return null

  // Chọn người đang ít việc nhất để tránh dồn tải (TICKET-FR-005)
  const openCounts = await Promise.all(
    candidates.map(async c => ({
      id: String(c._id),
      open: await Ticket.countDocuments({ assigned_to: c._id, status: { $ne: 'CLOSED' } }),
    })),
  )
  openCounts.sort((a, b) => a.open - b.open)
  return openCounts[0].id
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

  if (INSTALLATION_TYPES.includes(input.type) && !input.scheduled_visit_at) {
    // Flow 9b bước 1: Farm Owner chọn thẳng ngày giờ hẹn, không có bước liên hệ
    throw BadRequestError('Yêu cầu lắp đặt/bảo trì phải chọn ngày giờ hẹn (scheduled_visit_at)')
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
    scheduled_visit_at: input.scheduled_visit_at ? new Date(input.scheduled_visit_at) : undefined,
    ...sla,
    notes: input.description
      ? [{ author_id: user._id, content: input.description, created_at: new Date() }]
      : [],
  })

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
  const toProcess = staleAlerts.filter(a => !alreadyTicketed.has(String(a._id)))

  // Cache routeToTechnician theo farmId trong 1 lượt chạy job — nhiều alert
  // cùng farm (thường gặp) chỉ tính tải Technician 1 lần, không phải mỗi alert.
  const technicianCache = new Map<string, string | null>()
  async function routeToTechnicianCached(farmId: string): Promise<string | null> {
    if (!technicianCache.has(farmId)) {
      technicianCache.set(farmId, await routeToTechnician(farmId))
    }
    return technicianCache.get(farmId) ?? null
  }

  let created = 0
  for (const alert of toProcess) {
    try {
      const ticketType = ALERT_TYPE_TO_TICKET_TYPE[alert.type as AlertType] ?? 'OTHER'
      const priority = DEFAULT_PRIORITY[ticketType]
      const sla = await slaDueDates(priority, new Date())
      const assignedTo = await routeToTechnicianCached(String(alert.farm_id))

      await Ticket.create({
        farm_id:  alert.farm_id,
        zone_id:  alert.zone_id,
        alert_id: alert._id,
        type:     ticketType,
        priority,
        status:   'NEW',
        assigned_to: assignedTo ?? undefined,
        ...sla,
        notes: [{
          content: `Tự tạo từ cảnh báo "${alert.title}" chưa được xác nhận sau 15 phút (TICKET-FR-002)`,
          created_at: new Date(),
        }],
      })
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

/** TICKET-FR-007 + TICKET-FR-010 (chặn đóng ticket lắp đặt khi SAT chưa đạt) */
export async function updateStatus(
  ticketId: string, user: CurrentUser, newStatus: TicketStatus, note?: string,
): Promise<ITicket> {
  const ticket = await getTicket(ticketId, user)

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
  if (note) ticket.notes.push({ author_id: user._id as never, content: note, created_at: new Date() })
  await ticket.save()
  return ticket
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
  ticket.sat_checklist = { ...ticket.sat_checklist, ...updates }
  await ticket.save()
  return ticket
}

/** TICKET-FR-009 / SLA-NFR-002 — escalate thủ công (tự động do job xử lý) */
export async function escalateTicket(ticketId: string, user: CurrentUser, reason?: string): Promise<ITicket> {
  const ticket = await getTicket(ticketId, user)
  ticket.is_sla_breached = true
  ticket.notes.push({
    author_id: user._id as never,
    content: `Escalate lên Administrator${reason ? `: ${reason}` : ''}`,
    created_at: new Date(),
  })
  await ticket.save()
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
  }
  return overdue.length
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
export async function getKpi() {
  const [byStatus, byTechnician, slaStats] = await Promise.all([
    Ticket.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Ticket.aggregate([
      { $match: { assigned_to: { $ne: null } } },
      { $group: { _id: '$assigned_to', total: { $sum: 1 }, closed: { $sum: { $cond: [{ $eq: ['$status', 'CLOSED'] }, 1, 0] } } } },
    ]),
    Ticket.aggregate([
      { $match: { status: 'CLOSED', closed_at: { $ne: null } } },
      {
        $group: {
          _id: null,
          avgResolveMs: { $avg: { $subtract: ['$closed_at', '$created_at'] } },
          breached: { $sum: { $cond: ['$is_sla_breached', 1, 0] } },
          total: { $sum: 1 },
        },
      },
    ]),
  ])

  const sla = slaStats[0] as { avgResolveMs?: number; breached?: number; total?: number } | undefined
  return {
    byStatus,
    byTechnician,
    avgResolveHours: sla?.avgResolveMs ? +(sla.avgResolveMs / 3600_000).toFixed(1) : null,
    slaComplianceRate: sla?.total ? +(((sla.total - (sla.breached ?? 0)) / sla.total) * 100).toFixed(1) : null,
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
    if (!coversRegion && !updates.force) {
      const regions = (technician.assigned_regions ?? []).join(', ') || 'chưa gán vùng nào'
      throw BadRequestError(
        `Technician này phụ trách ${regions}, không khớp khu vực "${farm?.region ?? 'chưa đặt'}" của farm. ` +
        'Gửi kèm force=true nếu vẫn muốn gán.',
      )
    }

    changes.assigned_to = { before: ticket.assigned_to ? String(ticket.assigned_to) : null, after: updates.assigned_to }
    if (!coversRegion) changes.forcedOutOfRegion = true
    ticket.assigned_to = technician._id
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
  return ticket.populate('assigned_to', 'full_name email')
}
