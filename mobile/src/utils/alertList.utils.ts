import type { Alert, AlertSeverity, AlertType } from '@/types'
import { getSeverityLevel, type SeverityLevel } from '@/utils/severity.utils'

// Bốn loại cảnh báo suy luận cần chuyên gia phán quyết — khớp INFERRED_ALERT_TYPES của backend (alert.service.ts)
export const INFERRED_ALERT_TYPES: readonly AlertType[] = [
  'NOISE_ANOMALY',
  'SENSOR_ANOMALY',
  'FORECAST_BREACH',
  'LOW_RETURN_RATE',
]

// Cảnh báo về thiết bị — khớp danh sách loại Technician được xem ở backend (alert.service.ts)
export const DEVICE_ALERT_TYPES: readonly AlertType[] = [
  'NODE_OFFLINE',
  'EDGE_AI_DEGRADED',
  'SENSOR_FAULT',
  'RS485_BUS_FAILURE',
  'UNEXPECTED_RESTART',
  'SPEAKER_FAILURE',
  'MISTING_INEFFECTIVE',
  'ACTUATOR_FAULT',
  'CONFIG_MISMATCH',
  'MAINTENANCE_DUE',
]

const SEVERITY_RANK: Record<AlertSeverity, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }

// Nhắc lại cảnh báo chưa ai xác nhận (ALERT-FR-015): CRITICAL/HIGH sau 15 phút, NODE_OFFLINE sau 1 giờ —
// khớp RENOTIFY_AFTER_MS, NODE_OFFLINE_RENOTIFY_AFTER_MS của backend
const RENOTIFY_AFTER_MS = 15 * 60 * 1000
const NODE_OFFLINE_RENOTIFY_AFTER_MS = 60 * 60 * 1000
const MINUTE_MS = 60 * 1000

export type VerdictFilter = 'pending' | 'confirmed' | 'rejected'

export interface AlertFilter {
  // Nhà đang xem; null là mọi nhà của farm
  houseId: string | null
  // Các tầng của nhà đang xem: cảnh báo tầng không mang house_id nên lọc nhà theo tầng
  houseZoneIds: readonly string[]
  zoneId: string | null
  // Cấp hiển thị (Khẩn cấp · Cao · Thường), không phải 4 mức của backend
  severity: SeverityLevel | null
  type: AlertType | null
  verdict: VerdictFilter | null
}

export function isInferredAlert(alert: Pick<Alert, 'type'>): boolean {
  return INFERRED_ALERT_TYPES.includes(alert.type)
}

// Mốc thời gian gần nhất của cảnh báo: lần lặp gần nhất, chưa lặp thì lúc tạo
function getLatestTime(alert: Alert): string {
  return alert.last_seen_at ?? alert.created_at
}

// Thứ tự danh sách (đặc tả §2.5): mức nặng trước → chưa xác nhận trước đã xác nhận → mới nhất trước
export function sortAlerts(alerts: Alert[]): Alert[] {
  return [...alerts].sort((first, second) => {
    const bySeverity = SEVERITY_RANK[second.severity] - SEVERITY_RANK[first.severity]
    if (bySeverity !== 0) return bySeverity
    const byStatus = Number(second.status === 'ACTIVE') - Number(first.status === 'ACTIVE')
    if (byStatus !== 0) return byStatus
    return getLatestTime(second).localeCompare(getLatestTime(first))
  })
}

// Lọc trong app theo nhà, tầng, mức, loại, phán quyết. Phán quyết chỉ áp cho loại suy luận:
// đang lọc phán quyết thì loại khác bị bỏ, như GET /alerts?verdict của backend
export function filterAlerts(
  alerts: Alert[],
  filter: Omit<AlertFilter, 'severity'> & { severity?: SeverityLevel | null },
): Alert[] {
  const houseZoneIds = new Set(filter.houseZoneIds)
  return alerts.filter(alert => {
    if (filter.houseId && alert.house_id !== filter.houseId && !(alert.zone_id && houseZoneIds.has(alert.zone_id))) {
      return false
    }
    if (filter.zoneId && alert.zone_id !== filter.zoneId) return false
    if (filter.severity && getSeverityLevel(alert.severity) !== filter.severity) return false
    if (filter.type && alert.type !== filter.type) return false
    if (filter.verdict) {
      if (!isInferredAlert(alert)) return false
      const result = alert.expert_verdict?.result
      if (filter.verdict === 'pending' && result) return false
      if (filter.verdict === 'confirmed' && result !== 'CONFIRMED') return false
      if (filter.verdict === 'rejected' && result !== 'REJECTED') return false
    }
    return true
  })
}

// Bỏ cảnh báo trùng id khi ghép nhiều trang: backend chỉ sắp theo created_at nên các bản ghi cùng giờ tạo có thể nằm ở
// hai trang, và một cảnh báo đổi trạng thái giữa hai lần tải trang cũng có thể xuất hiện hai lần — trùng thì đếm sai
export function uniqueById(alerts: Alert[]): Alert[] {
  const seen = new Set<string>()
  return alerts.filter(alert => {
    if (seen.has(alert._id)) return false
    seen.add(alert._id)
    return true
  })
}

// Số cảnh báo theo từng cấp hiển thị (dải tóm tắt, đặc tả §2.2); CRITICAL và HIGH cùng tính vào Khẩn cấp
export function countBySeverityLevel(alerts: Alert[]): Record<SeverityLevel, number> {
  const counts: Record<SeverityLevel, number> = { P1: 0, P2: 0, P3: 0 }
  for (const alert of alerts) counts[getSeverityLevel(alert.severity)] += 1
  return counts
}

export type RenotifyState = { kind: 'countdown'; minutes: number } | { kind: 'sent' }

// Hàng cảnh báo hiện "Nhắc lại sau X phút" hoặc "Đã nhắc lại" (ALERT-FR-015); cảnh báo không được nhắc thì null
export function getRenotifyState(alert: Alert, now: number): RenotifyState | null {
  if (alert.status !== 'ACTIVE') return null
  const delay =
    alert.type === 'NODE_OFFLINE'
      ? NODE_OFFLINE_RENOTIFY_AFTER_MS
      : alert.severity === 'CRITICAL' || alert.severity === 'HIGH'
        ? RENOTIFY_AFTER_MS
        : null
  if (delay === null) return null
  if (alert.renotified_at) return { kind: 'sent' }
  const remaining = Date.parse(alert.created_at) + delay - now
  return { kind: 'countdown', minutes: Math.max(0, Math.ceil(remaining / MINUTE_MS)) }
}
