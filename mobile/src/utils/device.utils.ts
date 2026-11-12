import type { ConfigSyncState, DeviceStatus } from '@/types'
import { formatElapsed } from '@/utils/date.utils'
import { formatDecimal } from '@/utils/number.utils'

export interface DeviceStatusSummary {
  total: number
  online: number
  offline: number
  pending: number
}

// Đếm thiết bị theo trạng thái kết nối trong một lượt duyệt
export function summarizeDeviceStatuses(statuses: DeviceStatus[]): DeviceStatusSummary {
  const summary: DeviceStatusSummary = { total: statuses.length, online: 0, offline: 0, pending: 0 }
  for (const status of statuses) {
    if (status === 'ONLINE') summary.online += 1
    else if (status === 'OFFLINE') summary.offline += 1
    else summary.pending += 1
  }
  return summary
}

// Bước "Đã áp cấu hình khu vực" khi setup controller (FARM-FR-012, ENV-FR-027)
export type ConfigApplyStep = 'waiting-connection' | 'waiting-config' | 'applied' | 'mismatch' | 'unknown'

// Đọc bước áp cấu hình từ trạng thái kết nối và config_sync: chưa kết nối thì chưa tới bước này; MISMATCH là đã quá
// 3 heartbeat vẫn báo bản cũ (BR-24); UNKNOWN là firmware trước 2.1.0 không báo phiên bản
export function getConfigApplyStep(
  status: DeviceStatus | null,
  configSync: ConfigSyncState | undefined,
): ConfigApplyStep {
  if (configSync === 'APPLIED') return 'applied'
  if (status === null || status === 'PENDING') return 'waiting-connection'
  if (configSync === 'MISMATCH') return 'mismatch'
  if (configSync === 'UNKNOWN') return 'unknown'
  return 'waiting-config'
}

// Thao tác Farm Owner làm trên một thiết bị đã lắp (SF-01): dời khu vực và thay chỉ có ở controller (FARM-FR-007b, 008),
// camera gắn nhà nên chỉ gỡ được
export type DeviceAction = 'move' | 'replace' | 'remove'

export function getDeviceActions(kind: 'controller' | 'camera'): DeviceAction[] {
  return kind === 'controller' ? ['move', 'replace', 'remove'] : ['remove']
}

// Backend chỉ dời controller đang trực tuyến (409 khi không ONLINE); Report 3 FARM-FR-007b muốn dời cả thiết bị offline khi nó
// kết nối lại, phần đó chờ backend
export function canReassignZone(status: DeviceStatus): boolean {
  return status === 'ONLINE'
}

// Thiết bị gỡ còn khôi phục được trong 24 giờ (FARM-FR-008, Report 3 §6.6); quá hạn backend trả 409
const RESTORE_WINDOW_MS = 24 * 60 * 60 * 1000

export function isWithinRestoreWindow(decommissionedAt: string, now: number = Date.now()): boolean {
  return now - new Date(decommissionedAt).getTime() <= RESTORE_WINDOW_MS
}

const BYTES_PER_KB = 1024

// Thời gian chạy từ lúc khởi động (FARM-FR-006): "3 giờ", "2 ngày"; chưa có thì "_"
export function formatUptime(bootedAt: string | undefined, now: number = Date.now()): string {
  if (!bootedAt) return '_'
  return formatElapsed(now - new Date(bootedAt).getTime())
}

// RAM còn trống, đổi byte sang KB: "142 KB"; chưa có thì "_"
export function formatFreeHeap(freeHeap: number | undefined): string {
  if (freeHeap === undefined) return '_'
  return `${formatDecimal(freeHeap / BYTES_PER_KB)} KB`
}
