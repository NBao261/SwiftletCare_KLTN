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
  /** ENV-FR-016 — bật bơm lúc Zone có cảnh báo cảm biến/phun sương và đã xác nhận */
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

/** Đóng mọi bản ghi còn mở của các thiết bị (thiết bị về AUTO thì mọi relay cùng về AUTO) */
export async function closeOverrideLogs(nodeIds: unknown[], reason: OverrideEndReason, at = new Date()): Promise<number> {
  if (nodeIds.length === 0) return 0
  try {
    const { modifiedCount } = await RelayOverrideLog.updateMany(
      // started_at ≤ at: override mới bật sau thời điểm đóng (job hết hạn đang chạy dở) không bị đóng theo
      { node_id: { $in: nodeIds }, ended_at: null, started_at: { $lte: at } },
      { ended_at: at, end_reason: reason },
    )
    return modifiedCount
  } catch (err) {
    logger.warn('Đóng lịch sử can thiệp tay thất bại (ENV-FR-019)', { err, reason })
    return 0
  }
}

/** ENV-FR-018, BR-20 — huỷ sớm 1 relay: đóng bản ghi còn mở của relay đó, các relay khác giữ nguyên */
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

/**
 * Thiết bị (hoặc 1 relay của nó khi có `relay`) còn đang can thiệp tay (bản ghi còn mở) — đọc lỗi thì coi
 * như còn, để không trả về AUTO nhầm và không bỏ qua lệnh huỷ
 */
export async function hasOpenOverride(nodeId: unknown, relay?: OverrideRelay): Promise<boolean> {
  try {
    return !!(await RelayOverrideLog.exists({ node_id: nodeId, ended_at: null, ...(relay && { relay }) }))
  } catch (err) {
    logger.warn('Đọc lịch sử can thiệp tay thất bại (ENV-FR-019)', { err })
    return true
  }
}

/**
 * Lệnh relay tới thiết bị và trạng thái báo ngược lại mất vài giây (chu kỳ điều khiển
 * của ESP32 là 10 giây). ponytail: 30 giây là biên chọn tay cho độ trễ đó.
 */
export const DEVICE_CONFIRM_GRACE_MS = 30_000

/**
 * Trạng thái các bản ghi còn mở của 1 thiết bị — cho confirmRelayStatus quyết định:
 * `fresh` = có override vừa mở trong DEVICE_CONFIRM_GRACE_MS (bản tin AUTO lúc này nhiều
 * khả năng là bản tin cũ đang trên đường tới); `latestExpiry` = hạn muộn nhất còn hiệu lực.
 * Không throw: đọc lỗi thì coi như không có gì đặc biệt.
 */
export async function openOverrideState(nodeId: unknown, now = new Date()): Promise<{ fresh: boolean; latestExpiry: Date | null }> {
  try {
    const open = await RelayOverrideLog.find({ node_id: nodeId, ended_at: null }).select('started_at expires_at').lean()
    const freshAfter = now.getTime() - DEVICE_CONFIRM_GRACE_MS
    const latest = open.reduce((max, l) => Math.max(max, l.expires_at.getTime()), 0)
    return { fresh: open.some(l => l.started_at.getTime() > freshAfter), latestExpiry: latest > 0 ? new Date(latest) : null }
  } catch (err) {
    logger.warn('Đọc lịch sử can thiệp tay thất bại (ENV-FR-019)', { err })
    return { fresh: false, latestExpiry: null }
  }
}

/**
 * Thiết bị tự báo đã về AUTO (relay/status): đóng bản ghi còn mở — quá hạn thì là
 * EXPIRED, chưa tới hạn (thiết bị khởi động lại, mất override) thì là CLEARED_EARLY.
 * Caller (confirmRelayStatus) đã loại trường hợp bản tin AUTO cũ tới ngay sau khi bật tay.
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

/**
 * Lưới an toàn: đóng mọi bản ghi còn mở đã QUÁ HẠN mà thiết bị của nó không còn đang
 * được can thiệp tay. Các đường đóng thông thường đều dựa vào trạng thái node; nếu node
 * về AUTO bằng đường nào đó mà bản ghi không được đóng theo (ghi lịch sử là best-effort,
 * có thể lỗi đúng lúc đóng), nó sẽ mở mãi và tỷ lệ thời gian tự động sai mãi. Đóng tại
 * đúng `expires_at` của bản ghi.
 * Node vẫn MANUAL và còn hạn (relay khác vừa gia hạn chung) thì để job hết hạn lo.
 */
export async function closeOrphanedOverrideLogs(now = new Date()): Promise<number> {
  try {
    const overdueNodeIds = await RelayOverrideLog.distinct('node_id', { ended_at: null, expires_at: { $lt: now } })
    if (overdueNodeIds.length === 0) return 0
    const stillManual = await SensorNode.distinct('_id', {
      _id: { $in: overdueNodeIds }, control_mode: 'MANUAL', override_expiry: { $gt: now },
    })
    const { modifiedCount } = await RelayOverrideLog.updateMany(
      { ended_at: null, expires_at: { $lt: now }, node_id: { $nin: stillManual } },
      [{ $set: { ended_at: '$expires_at', end_reason: 'EXPIRED' satisfies OverrideEndReason } }],
    )
    return modifiedCount
  } catch (err) {
    logger.warn('Dọn lịch sử can thiệp tay quá hạn thất bại (ENV-FR-019)', { err })
    return 0
  }
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
      // Chỉ tên: Domain Expert đọc được route này, mà email thành viên thì cố ý giấu khỏi
      // chuyên gia ở GET /farms (onlyOwnMembership)
      .populate('started_by', 'full_name').lean(),
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
