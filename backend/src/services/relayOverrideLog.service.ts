import { Types } from 'mongoose'
import { RelayOverrideLog, IRelayOverrideLog, OverrideEndReason, OverrideRelay } from '@/models/relayOverrideLog.model'
import { SensorNode } from '@/models/device.model'
import { assertZoneAccess } from '@/utils/farmAccess.util'
import { NotFoundError } from '@/utils/appError.util'
import { paginate } from '@/utils/helpers.util'
import logger from '@/utils/logger.util'
import type { CurrentUser } from '@/types'

/** Hàm ghi không throw, và caller ghi SAU khi publish: ghi trước mà lỗi thì DB đổi mà thiết bị không nhận lệnh */

/** Bản ghi mở cũ của relay đó đóng với REPLACED */
export async function openOverrideLog(input: {
  nodeId: unknown; zoneId: unknown; farmId: unknown
  relay: OverrideRelay; state: boolean; user: CurrentUser; expiresAt: Date
  /** ENV-FR-016 */
  alertConfirmed?: boolean
}): Promise<IRelayOverrideLog | null> {
  try {
    const now = new Date()
    await RelayOverrideLog.updateMany(
      { node_id: input.nodeId, relay: input.relay, ended_at: null },
      { ended_at: now, end_reason: 'REPLACED' satisfies OverrideEndReason },
    )
    return await RelayOverrideLog.create({
      node_id: input.nodeId, zone_id: input.zoneId, farm_id: input.farmId,
      relay: input.relay, state: input.state,
      started_by: input.user._id, started_by_role: input.user.role,
      started_at: now, expires_at: input.expiresAt, alert_confirmed: input.alertConfirmed ?? false,
    })
  } catch (err) {
    logger.warn('Ghi lịch sử can thiệp tay thất bại (ENV-FR-019)', { err, nodeId: String(input.nodeId), relay: input.relay })
    return null
  }
}

export async function closeOverrideLogs(nodeIds: unknown[], reason: OverrideEndReason, at = new Date()): Promise<number> {
  if (nodeIds.length === 0) return 0
  try {
    const { modifiedCount } = await RelayOverrideLog.updateMany(
      // Override mới bật sau thời điểm đóng không bị đóng theo
      { node_id: { $in: nodeIds }, ended_at: null, started_at: { $lte: at } },
      { ended_at: at, end_reason: reason },
    )
    return modifiedCount
  } catch (err) {
    logger.warn('Đóng lịch sử can thiệp tay thất bại (ENV-FR-019)', { err, reason })
    return 0
  }
}

/** BR-20: các relay khác giữ nguyên */
export async function closeRelayOverrideLog(nodeId: unknown, relay: OverrideRelay, reason: OverrideEndReason, at = new Date()): Promise<number> {
  try {
    const { modifiedCount } = await RelayOverrideLog.updateMany(
      { node_id: nodeId, relay, ended_at: null, started_at: { $lte: at } },
      { ended_at: at, end_reason: reason },
    )
    return modifiedCount
  } catch (err) {
    logger.warn('Đóng lịch sử can thiệp tay thất bại (ENV-FR-019)', { err, relay, reason })
    return 0
  }
}

/** Chu kỳ điều khiển ESP32 là 10 s. ponytail: 30 s chọn tay */
export const DEVICE_CONFIRM_GRACE_MS = 30_000

/** fresh: tin AUTO lúc này nhiều khả năng là tin cũ. Không throw */
export async function openOverrideStates(nodeId: unknown, now = new Date()): Promise<Partial<Record<OverrideRelay, { fresh: boolean; expiry: Date }>>> {
  try {
    const open = await RelayOverrideLog.find({ node_id: nodeId, ended_at: null }).select('relay started_at expires_at').lean()
    const freshAfter = now.getTime() - DEVICE_CONFIRM_GRACE_MS
    return Object.fromEntries(open.map(l => [l.relay, { fresh: l.started_at.getTime() > freshAfter, expiry: l.expires_at }]))
  } catch (err) {
    logger.warn('Đọc lịch sử can thiệp tay thất bại (ENV-FR-019)', { err })
    return {}
  }
}

/** Quá hạn là EXPIRED, chưa tới hạn là CLEARED_EARLY */
export async function closeOverrideLogFromDevice(nodeId: unknown, relay: OverrideRelay, at = new Date()): Promise<void> {
  try {
    await RelayOverrideLog.updateMany(
      { node_id: nodeId, relay, ended_at: null, expires_at: { $lte: at } },
      { ended_at: at, end_reason: 'EXPIRED' satisfies OverrideEndReason },
    )
  } catch (err) {
    logger.warn('Đóng lịch sử can thiệp tay thất bại (ENV-FR-019)', { err })
  }
  await closeRelayOverrideLog(nodeId, relay, 'CLEARED_EARLY', at)
}

/** Lưới an toàn: bản ghi quá hạn mà relay không còn tay thì đóng đúng expires_at, không thì tỷ lệ tự động sai mãi */
export async function closeOrphanedOverrideLogs(now = new Date()): Promise<number> {
  try {
    const overdue = await RelayOverrideLog.find({ ended_at: null, expires_at: { $lt: now } }).select('node_id relay').lean()
    if (overdue.length === 0) return 0
    const nodes = await SensorNode.find({ _id: { $in: overdue.map(l => l.node_id) } }).select('relays').lean()
    const relaysOf = new Map(nodes.map(n => [String(n._id), n.relays]))
    const orphaned = overdue.filter(l => {
      const relay = relaysOf.get(String(l.node_id))?.[l.relay]
      return !(relay?.mode === 'MANUAL' && relay.override_expiry && relay.override_expiry > now)
    })
    const { modifiedCount } = await RelayOverrideLog.updateMany(
      { _id: { $in: orphaned.map(l => l._id) } },
      [{ $set: { ended_at: '$expires_at', end_reason: 'EXPIRED' satisfies OverrideEndReason } }],
    )
    return modifiedCount
  } catch (err) {
    logger.warn('Dọn lịch sử can thiệp tay quá hạn thất bại (ENV-FR-019)', { err })
    return 0
  }
}

export async function listOverrideLogs(nodeId: string, user: CurrentUser, query: { page?: number; limit?: number }) {
  const node = await SensorNode.findById(nodeId).select('zone_id').lean()
  if (!node) throw NotFoundError('Không tìm thấy thiết bị')
  await assertZoneAccess(String(node.zone_id), user)

  const { page, skip, limit } = paginate(query.page, query.limit)
  const filter = { node_id: node._id }
  const [records, total] = await Promise.all([
    RelayOverrideLog.find(filter).sort({ started_at: -1 }).skip(skip).limit(limit)
      // Chỉ tên: email thành viên cố ý giấu khỏi chuyên gia
      .populate('started_by', 'full_name').lean(),
    RelayOverrideLog.countDocuments(filter),
  ])
  return { records, total, page, limit }
}

/** Hợp các khoảng chồng nhau; bản ghi còn mở tính tới to */
export async function manualTimeInZone(zoneId: string, from: Date, to: Date): Promise<{ manualMs: number; overrideCount: number }> {
  const logs = await RelayOverrideLog.find({
    zone_id: new Types.ObjectId(zoneId),
    started_at: { $lt: to },
    $or: [{ ended_at: null }, { ended_at: { $gt: from } }],
  }).select('started_at ended_at').sort({ started_at: 1 }).lean()

  let manualMs = 0
  let curStart = 0
  let curEnd = 0
  for (const log of logs) {
    const start = Math.max(log.started_at.getTime(), from.getTime())
    const end = Math.min((log.ended_at ?? to).getTime(), to.getTime())
    if (end <= start) continue
    if (start > curEnd) {
      manualMs += curEnd - curStart
      curStart = start
      curEnd = end
    } else if (end > curEnd) {
      curEnd = end
    }
  }
  manualMs += curEnd - curStart
  return { manualMs, overrideCount: logs.length }
}
