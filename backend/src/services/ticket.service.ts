import { Ticket, ITicket } from '@/models/ticket.model'
import { Alert } from '@/models/alert.model'
import { User } from '@/models/user.model'
import { Farm } from '@/models/farm.model'
import { listAccessibleFarmIds, assertFarmAccess } from '@/services/alert.service'
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

/** TICKET-FR-006 — SLA mặc định (giờ) theo priority: [phản hồi, xử lý] */
const SLA_HOURS: Record<TicketPriority, [number, number]> = {
  P1: [0.5, 4],
  P2: [4, 24],
  P3: [24, 72],
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
  const [responseH, resolveH] = SLA_HOURS[priority]
  const now = Date.now()

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
    sla_response_due_at: new Date(now + responseH * 3600_000),
    sla_resolve_due_at:  new Date(now + resolveH * 3600_000),
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

  let created = 0
  for (const alert of staleAlerts) {
    // Đã có ticket gắn với alert này thì bỏ qua (tránh tạo trùng mỗi lần job chạy)
    const existing = await Ticket.findOne({ alert_id: alert._id })
    if (existing) continue

    const priority = DEFAULT_PRIORITY[(alert.type as TicketType)] ?? 'P2'
    const [responseH, resolveH] = SLA_HOURS[priority]
    const now = Date.now()
    const assignedTo = await routeToTechnician(String(alert.farm_id))

    await Ticket.create({
      farm_id:  alert.farm_id,
      zone_id:  alert.zone_id,
      alert_id: alert._id,
      type:     (alert.type as TicketType) ?? 'OTHER',
      priority,
      status:   'NEW',
      assigned_to: assignedTo ?? undefined,
      sla_response_due_at: new Date(now + responseH * 3600_000),
      sla_resolve_due_at:  new Date(now + resolveH * 3600_000),
      notes: [{
        content: `Tự tạo từ cảnh báo "${alert.title}" chưa được xác nhận sau 15 phút (TICKET-FR-002)`,
        created_at: new Date(),
      }],
    })
    created++
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

  if (query.farmId) filter.farm_id = query.farmId
  if (query.status) filter.status = query.status
  if (query.priority) filter.priority = query.priority
  if (query.assignedToMe) filter.assigned_to = user._id

  const page = query.page ?? 1
  const limit = Math.min(query.limit ?? 20, 100)

  const [records, total] = await Promise.all([
    Ticket.find(filter).sort({ created_at: -1 }).skip((page - 1) * limit).limit(limit)
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

/** TICKET-FR-011 — Farm Owner đánh giá sau khi ticket đóng */
export async function rateTicket(ticketId: string, user: CurrentUser, rating: number): Promise<ITicket> {
  const ticket = await getTicket(ticketId, user)
  if (ticket.status !== 'CLOSED') throw ConflictError('Chỉ đánh giá được ticket đã đóng')
  if (String(ticket.created_by) !== user._id && user.role !== 'ADMIN') {
    throw ForbiddenError('Chỉ người tạo ticket mới được đánh giá')
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
