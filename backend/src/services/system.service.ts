import { AuditLog } from '@/models/auditLog.model'
import { SystemSetting } from '@/models/systemSetting.model'
import { Farm } from '@/models/farm.model'
import { House, Zone } from '@/models/houseZone.model'
import { SensorNode, CameraNode } from '@/models/device.model'
import { Ticket } from '@/models/ticket.model'
import { User } from '@/models/user.model'
import { summarizeByStatus } from '@/services/device.service'
import { logAction } from '@/services/auditLog.service'
import { paginate } from '@/utils/helpers.util'
import { DEFAULT_THRESHOLDS, assertValidThresholds, pickThresholds } from '@/utils/thresholds.util'
import type { Thresholds, TicketPriority } from '@/types'

// ── SYSTEM-FR-001: Audit Log viewer ──────────────────────────────────────────

export interface ListAuditLogsQuery {
  actorId?: string
  action?: string
  targetType?: string
  targetId?: string
  from?: string
  to?: string
  page?: string | number
  limit?: string | number
}

export async function listAuditLogs(query: ListAuditLogsQuery) {
  const filter: Record<string, unknown> = {}
  if (query.actorId) filter.actor_id = query.actorId
  if (query.action) filter.action = query.action
  if (query.targetType) filter.target_type = query.targetType
  if (query.targetId) filter.target_id = query.targetId
  if (query.from || query.to) {
    filter.created_at = {
      ...(query.from ? { $gte: new Date(query.from) } : {}),
      ...(query.to ? { $lte: new Date(query.to) } : {}),
    }
  }

  const { page, skip, limit } = paginate(query.page, query.limit)
  const [records, total] = await Promise.all([
    AuditLog.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit)
      .populate('actor_id', 'full_name email role').lean(),
    AuditLog.countDocuments(filter),
  ])
  return { records, total, page, limit }
}

// ── SYSTEM-FR-002: ngưỡng mặc định hệ thống ─────────────────────────────────

/** Lọc theo khoá singleton để upsert bám vào unique index — xem systemSetting.model.ts */
const SINGLETON = { _singleton: true }
const DUPLICATE_KEY = 11000

/**
 * Chưa từng cấu hình thì trả giá trị gốc, không ghi DB lúc đọc — document chỉ
 * được tạo khi Admin thực sự lưu lần đầu (updateDefaultThresholds).
 */
export async function getDefaultThresholds(): Promise<Thresholds> {
  const setting = await SystemSetting.findOne(SINGLETON).lean()
  return setting?.default_thresholds ?? { ...DEFAULT_THRESHOLDS }
}

export async function updateDefaultThresholds(
  adminId: string, input: Record<string, unknown>,
): Promise<Thresholds> {
  const before = await getDefaultThresholds()
  const after: Thresholds = { ...before, ...pickThresholds(input) }
  assertValidThresholds(after)

  const write = () => SystemSetting.findOneAndUpdate(
    SINGLETON,
    { default_thresholds: after, updated_by: adminId },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  try {
    await write()
  } catch (err) {
    // Hai request cùng insert lần đầu: 1 thắng, request còn lại nhận E11000.
    // Chạy lại thì document đã tồn tại nên rơi vào nhánh update bình thường.
    if ((err as { code?: number }).code !== DUPLICATE_KEY) throw err
    await write()
  }

  await logAction(adminId, 'DEFAULT_THRESHOLDS_UPDATED', 'system_settings', undefined, { before, after })
  return after
}

// ── SYSTEM-FR-003: tổng quan sức khỏe hệ thống ──────────────────────────────

const PRIORITIES: TicketPriority[] = ['P1', 'P2', 'P3']

/** Zone thuộc farm chưa xoá mềm — nguồn chung để Farm, Zone và thiết bị đếm khớp nhau */
async function findActiveZoneIds() {
  const farmIds = await Farm.find({ is_deleted: false }).distinct('_id')
  const houseIds = await House.find({ farm_id: { $in: farmIds } }).distinct('_id')
  return Zone.find({ house_id: { $in: houseIds } }).distinct('_id')
}

export async function getHealthOverview() {
  const zoneIds = await findActiveZoneIds()
  const [farmCount, sensorStatuses, cameraStatuses, ticketGroups, userGroups] = await Promise.all([
    Farm.countDocuments({ is_deleted: false }),
    SensorNode.find({ zone_id: { $in: zoneIds } }).select('status').lean(),
    CameraNode.find({ zone_id: { $in: zoneIds } }).select('status').lean(),
    Ticket.aggregate<{ _id: TicketPriority; count: number }>([
      { $match: { status: { $ne: 'CLOSED' } } },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]),
    User.aggregate<{ _id: { role: string | null; is_active: boolean }; count: number }>([
      { $group: { _id: { role: '$role', is_active: '$is_active' }, count: { $sum: 1 } } },
    ]),
  ])

  const openTickets = { total: 0, P1: 0, P2: 0, P3: 0 }
  for (const g of ticketGroups) {
    if (PRIORITIES.includes(g._id)) openTickets[g._id] = g.count
    openTickets.total += g.count
  }

  const users = { total: 0, active: 0, inactive: 0, byRole: {} as Record<string, { active: number; inactive: number }> }
  for (const g of userGroups) {
    const role = g._id.role ?? 'NONE'
    users.byRole[role] ??= { active: 0, inactive: 0 }
    if (g._id.is_active) {
      users.byRole[role].active += g.count
      users.active += g.count
    } else {
      users.byRole[role].inactive += g.count
      users.inactive += g.count
    }
    users.total += g.count
  }

  return {
    farms: { total: farmCount },
    zones: { total: zoneIds.length },
    devices: summarizeByStatus([...sensorStatuses, ...cameraStatuses]),
    openTickets,
    users,
  }
}
