import type { AlertSeverity, DeviceStatus } from '@/types'

const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  CRITICAL: 'Nghiêm trọng',
  HIGH: 'Cao',
  MEDIUM: 'Trung bình',
  LOW: 'Thấp',
}

const DEVICE_STATUS_LABELS: Record<DeviceStatus, string> = {
  ONLINE: 'Trực tuyến',
  OFFLINE: 'Mất kết nối',
  ERROR: 'Lỗi',
  DEGRADED: 'Suy giảm',
}

// Nhãn tiếng Việt của mức độ cảnh báo
export function getSeverityLabel(severity: AlertSeverity): string {
  return SEVERITY_LABELS[severity]
}

// Nhãn tiếng Việt của trạng thái thiết bị
export function getDeviceStatusLabel(status: DeviceStatus): string {
  return DEVICE_STATUS_LABELS[status]
}
