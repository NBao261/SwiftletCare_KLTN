import { Types } from 'mongoose'
import { RelayOverrideLog, IRelayOverrideLog, OverrideEndReason, OverrideRelay } from '@/models/relayOverrideLog.model'
import { SensorNode } from '@/models/device.model'
import { assertZoneAccess } from '@/utils/farmAccess.util'
import { NotFoundError } from '@/utils/appError.util'
import { paginate } from '@/utils/helpers.util'
import logger from '@/utils/logger.util'
import type { CurrentUser } from '@/types'

/**
 * Các hàm GHI ở đây không throw (cùng triết lý với `logAction`): lịch sử hỏng không
 * được làm hỏng lệnh điều khiển. Caller ghi lịch sử SAU khi đã publish lệnh — nếu ghi
 * trước mà lỗi thì DB đã đổi trạng thái nhưng thiết bị không bao giờ nhận lệnh.
 */

/**
 * ENV-FR-019 — mở 1 bản ghi can thiệp tay. Relay đó đang có bản ghi mở (người dùng
 * bấm lại trước khi hết hạn) thì bản cũ đóng với lý do REPLACED.
 */
export async function openOverrideLog(input: {
  nodeId: unknown; zoneId: unknown; farmId: unknown
  relay: OverrideRelay; state: boolean; user: CurrentUser; expiresAt: Date
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
      started_at: now, expires_at: input.expiresAt,
    })
  } catch (err) {
    logger.warn('Ghi lịch sử can thiệp tay thất bại (ENV-FR-019)', { err, nodeId: String(input.nodeId), relay: input.relay })
    return null
  }
}

/** Đóng mọi bản ghi còn mở của các thiết bị (thiết bị về AUTO thì mọi relay cùng về AUTO) */
export async function closeOverrideLogs(nodeIds: unknown[], reason: OverrideEndReason, at = new Date()): Promise<number> {
  if (nodeIds.length === 0) return 0
  try {
    const { modifiedCount } = await RelayOverrideLog.updateMany(
      { node_id: { $in: nodeIds }, ended_at: null },
      { ended_at: at, end_reason: reason },
    )
    return modifiedCount
  } catch (err) {
    logger.warn('Đóng lịch sử can thiệp tay thất bại (ENV-FR-019)', { err, reason })
    return 0
  }
}

/**
 * Thiết bị tự báo đã về AUTO (relay/status): đóng bản ghi còn mở — quá hạn thì là
 * EXPIRED, chưa tới hạn (thiết bị khởi động lại, mất override) thì là CLEARED_EARLY.
 */
export async function closeOverrideLogsFromDevice(nodeId: unknown, at = new Date()): Promise<void> {
  try {
    await RelayOverrideLog.updateMany(
      { node_id: nodeId, ended_at: null, expires_at: { $lte: at } },
      { ended_at: at, end_reason: 'EXPIRED' satisfies OverrideEndReason },
    )
  } catch (err) {
    logger.warn('Đóng lịch sử can thiệp tay thất bại (ENV-FR-019)', { err })
  }
  await closeOverrideLogs([nodeId], 'CLEARED_EARLY', at)
}

/** ENV-FR-019 — lịch sử can thiệp tay của 1 thiết bị, mới nhất trước */
export async function listOverrideLogs(nodeId: string, user: CurrentUser, query: { page?: number; limit?: number }) {
  const node = await SensorNode.findById(nodeId).select('zone_id').lean()
  if (!node) throw NotFoundError('Không tìm thấy thiết bị')
  await assertZoneAccess(String(node.zone_id), user)

  const { page, skip, limit } = paginate(query.page, query.limit)
  const filter = { node_id: node._id }
  const [records, total] = await Promise.all([
    RelayOverrideLog.find(filter).sort({ started_at: -1 }).skip(skip).limit(limit)
      .populate('started_by', 'full_name email').lean(),
    RelayOverrideLog.countDocuments(filter),
  ])
  return { records, total, page, limit }
}

/**
 * ANALYTICS-FR-011 — tổng thời gian (ms) trong [from, to] mà Zone có ít nhất 1 relay
 * đang bị can thiệp tay. Hợp các khoảng chồng nhau (2 relay cùng bị ép chỉ tính 1 lần);
 * bản ghi còn mở tính tới `to`. Bản ghi đã đóng không bao giờ dài hơn thực tế vì
 * `ended_at` ghi đúng lúc thiết bị về AUTO.
 */
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
