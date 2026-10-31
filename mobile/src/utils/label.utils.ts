import type { AlertSeverity, AlertType, DeviceStatus, RelayName } from '@/types'
import type { ThresholdMetric } from '@/utils/threshold.utils'
import { t } from '@/utils/i18n.utils'

const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  CRITICAL: 'Nghiêm trọng',
  HIGH: 'Cao',
  MEDIUM: 'Trung bình',
  LOW: 'Thấp',
}

const DEVICE_STATUS_LABELS: Record<DeviceStatus, string> = {
  PENDING: 'Chờ kết nối',
  ONLINE: 'Trực tuyến',
  OFFLINE: 'Mất kết nối',
}

const METRIC_LABELS: Record<ThresholdMetric, string> = {
  temperature: 'Nhiệt độ',
  humidity: 'Độ ẩm',
  light: 'Ánh sáng',
  nh3: 'NH3',
  co2: 'CO2',
}

// Nhãn tiếng Việt của mức độ cảnh báo
export function getSeverityLabel(severity: AlertSeverity): string {
  return t(SEVERITY_LABELS[severity])
}

// Nhãn tiếng Việt của trạng thái thiết bị
export function getDeviceStatusLabel(status: DeviceStatus): string {
  return t(DEVICE_STATUS_LABELS[status])
}

// Nhãn tiếng Việt của chỉ số có ngưỡng
export function getMetricLabel(metric: ThresholdMetric): string {
  return t(METRIC_LABELS[metric])
}

const METRIC_UNITS: Record<ThresholdMetric, string> = {
  temperature: '°C',
  humidity: '%',
  light: ' lux',
  nh3: ' ppm',
  co2: ' ppm',
}

// Đơn vị viết liền sau số ("36.2°C", "7900 lux")
export function getMetricUnit(metric: ThresholdMetric): string {
  return METRIC_UNITS[metric]
}

const RELAY_LABELS: Record<RelayName, string> = {
  misting: 'Bơm phun sương',
  ventilation: 'Quạt',
  speaker: 'Loa',
}

// Tên hiển thị của relay
export function getRelayLabel(relay: RelayName): string {
  return t(RELAY_LABELS[relay])
}

const RELAY_SHORT_LABELS: Record<RelayName, string> = {
  misting: 'Bơm',
  ventilation: 'Quạt',
  speaker: 'Loa',
}

const METRIC_SHORT_LABELS: Record<ThresholdMetric, string> = {
  temperature: 'nhiệt',
  humidity: 'ẩm',
  light: 'sáng',
  nh3: 'NH3',
  co2: 'CO2',
}

// Tên sự cố ngắn, viết thường, đứng sau tên tầng: "Tầng 1 lỗi bus cảm biến"
const ALERT_TYPE_SHORT_LABELS: Record<AlertType, string> = {
  THRESHOLD_BREACH: 'vượt ngưỡng',
  NODE_OFFLINE: 'mất kết nối',
  SPEAKER_FAILURE: 'loa hỏng',
  MISTING_INEFFECTIVE: 'phun sương không hiệu quả',
  NOISE_ANOMALY: 'tiếng ồn bất thường',
  UNEXPECTED_RESTART: 'khởi động lại bất thường',
  LOW_RETURN_RATE: 'tỷ lệ về tổ giảm',
  EDGE_AI_DEGRADED: 'camera AI suy giảm',
  SENSOR_FAULT: 'lỗi cảm biến',
  RS485_BUS_FAILURE: 'lỗi bus cảm biến',
  SENSOR_ANOMALY: 'cảm biến bất thường',
  FORECAST_BREACH: 'dự báo vượt ngưỡng',
  MAINTENANCE_DUE: 'đến hạn bảo trì',
  ACTUATOR_FAULT: 'bơm/quạt không chạy đúng',
  CONFIG_MISMATCH: 'cấu hình chưa khớp',
}

// Tên ngắn của relay trong câu: "Bơm Tầng 2 chạy thủ công"
export function getRelayShortLabel(relay: RelayName): string {
  return t(RELAY_SHORT_LABELS[relay])
}

// Tên ngắn của chỉ số trong câu: "Tầng 2 nhiệt +1,8°C"
export function getMetricShortLabel(metric: ThresholdMetric): string {
  return t(METRIC_SHORT_LABELS[metric])
}

// Tên sự cố ngắn theo loại cảnh báo
export function getAlertTypeShortLabel(type: AlertType): string {
  return t(ALERT_TYPE_SHORT_LABELS[type])
}
