import type { BadgeTone } from '@/components/ui'
import { compareVersions } from '@/lib/firmwareFlasher'
import type { FirmwareRollout, RolloutStatus, RolloutTarget, SensorNode } from '@/types'

// Firmware trước bản này bỏ qua lệnh cập nhật từ xa: phải nạp qua USB
export const OTA_SUPPORT_SINCE = '1.4.0'

export const ROLLOUT_STATUS: Record<RolloutStatus, { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: 'Đang chạy', tone: 'info' },
  PAUSED: { label: 'Tạm dừng', tone: 'warning' },
  COMPLETED: { label: 'Đã xong', tone: 'positive' },
  CANCELLED: { label: 'Đã huỷ', tone: 'neutral' },
}

export const isOpenRollout = (rollout: FirmwareRollout) => rollout.status === 'ACTIVE' || rollout.status === 'PAUSED'

// Máy chờ vì đâu: offline, chưa tới lượt (chờ máy thử) hay đợt đang dừng
export function targetStatus(
  target: RolloutTarget, rollout: FirmwareRollout, online: boolean,
): { label: string; tone: BadgeTone } {
  switch (target.state) {
    case 'SUCCEEDED': return { label: 'Đã cập nhật', tone: 'positive' }
    case 'SENT': return { label: 'Đang cập nhật', tone: 'info' }
    case 'FAILED': return { label: 'Lỗi, đã quay về bản cũ', tone: 'critical' }
    case 'CANCELLED': return { label: 'Đã huỷ', tone: 'neutral' }
    case 'SKIPPED': return { label: 'Bỏ qua, thiết bị đã gỡ', tone: 'neutral' }
    default:
      if (rollout.status === 'CANCELLED') return { label: 'Đã huỷ', tone: 'neutral' }
      if (!online) return { label: 'Chờ máy kết nối lại', tone: 'warning' }
      if (rollout.status === 'PAUSED') return { label: 'Chờ đợt tiếp tục', tone: 'warning' }
      if (rollout.stage === 'CANARY' && !target.canary) return { label: 'Chờ máy thử xong', tone: 'neutral' }
      return { label: 'Đang gửi', tone: 'info' }
  }
}

export interface RolloutCounts { total: number; succeeded: number; sending: number; waiting: number; failed: number; closed: number }

export function rolloutCounts(rollout: FirmwareRollout): RolloutCounts {
  const counts: RolloutCounts = { total: rollout.targets.length, succeeded: 0, sending: 0, waiting: 0, failed: 0, closed: 0 }
  for (const target of rollout.targets) {
    if (target.state === 'SUCCEEDED') counts.succeeded++
    else if (target.state === 'SENT') counts.sending++
    else if (target.state === 'QUEUED') counts.waiting++
    else if (target.state === 'FAILED') counts.failed++
    else counts.closed++
  }
  return counts
}

// Máy đang có cập nhật chưa xong ở một đợt khác
export function busyNodeIds(rollouts: FirmwareRollout[]): Set<string> {
  return new Set(rollouts.filter(isOpenRollout).flatMap(r =>
    r.targets.filter(t => t.state === 'QUEUED' || t.state === 'SENT').map(t => t.node_id)))
}

// null = chọn được; còn lại là lý do hiện cạnh máy (cùng điều kiện backend kiểm)
export function ineligibleReason(node: SensorNode, version: string, busy: Set<string>): string | null {
  if (compareVersions(node.firmware_version ?? '0.0.0', OTA_SUPPORT_SINCE) < 0) return 'Firmware quá cũ, cần nạp qua USB'
  if (node.firmware_version === version) return 'Đã chạy bản này'
  if (node.ota_pending || busy.has(node._id)) return 'Đang có cập nhật chưa xong'
  return null
}
