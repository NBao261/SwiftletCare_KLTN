import type {
  AlertSeverity,
  AlertStatus,
  AlertType,
  BirdCountTuning,
  ControlMode,
  DetectionTuning,
  DeviceStatus,
  FuzzyTuning,
  NestType,
  OnsiteObservation,
  RelayName,
  Role,
  SiteCause,
  Thresholds,
  WorkOrderOrigin,
  WorkOrderStatus,
} from '@/types'
import type { SensorMetric, ThresholdMetric } from '@/utils/threshold.utils'
import { t } from '@/utils/i18n.utils'
import { getSeverityLevel, getSeverityLevelLabel } from '@/utils/severity.utils'

const DEVICE_STATUS_LABELS: Record<DeviceStatus, string> = {
  PENDING: 'Chờ kết nối',
  ONLINE: 'Trực tuyến',
  OFFLINE: 'Mất kết nối',
}

const METRIC_LABELS: Record<SensorMetric, string> = {
  temperature: 'Nhiệt độ',
  humidity: 'Độ ẩm',
  light: 'Ánh sáng',
  nh3: 'NH3',
  co2: 'CO2',
  sound: 'Tiếng ồn',
}

// Nhãn tiếng Việt của mức độ cảnh báo: 3 cấp Khẩn cấp · Cao · Thường như web (CRITICAL và HIGH cùng là Khẩn cấp)
export function getSeverityLabel(severity: AlertSeverity): string {
  return getSeverityLevelLabel(getSeverityLevel(severity))
}

// Nhãn tiếng Việt của trạng thái thiết bị
export function getDeviceStatusLabel(status: DeviceStatus): string {
  return t(DEVICE_STATUS_LABELS[status])
}

// Nhãn tiếng Việt của chỉ số cảm biến
export function getMetricLabel(metric: SensorMetric): string {
  return t(METRIC_LABELS[metric])
}

const METRIC_UNITS: Record<SensorMetric, string> = {
  temperature: '°C',
  humidity: '%',
  light: ' lux',
  nh3: ' ppm',
  co2: ' ppm',
  sound: ' dB',
}

// Đơn vị viết liền sau số ("36.2°C", "7900 lux")
export function getMetricUnit(metric: SensorMetric): string {
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

const CONTROL_MODE_LABELS: Record<ControlMode, string> = {
  AUTO: 'Tự động',
  MANUAL: 'Điều khiển tay',
}

// Chế độ của controller: AUTO theo bộ điều khiển fuzzy, MANUAL đang ép tay (ENV-FR-017)
export function getControlModeLabel(mode: ControlMode): string {
  return t(CONTROL_MODE_LABELS[mode])
}

// Tên và đơn vị hệ số bộ điều khiển fuzzy (ENV-FR-021), theo mô tả FuzzyTuning trong api-spec
const FUZZY_TUNING_LABELS: Record<keyof FuzzyTuning, { label: string; unit: string }> = {
  fuzzy_humidity_band: { label: 'Dải chuyển tiếp độ ẩm', unit: '%' },
  fuzzy_temp_band: { label: 'Dải nóng', unit: '°C' },
  fuzzy_fan_dry_level: { label: 'Mức quạt khi nóng mà khô', unit: '%' },
  fuzzy_window_sec: { label: 'Cửa sổ điều khiển', unit: ' giây' },
  fuzzy_input_filter: { label: 'Lọc nhiễu đầu vào', unit: '' },
}

export function getFuzzyTuningLabel(key: keyof FuzzyTuning): { label: string; unit: string } {
  const { label, unit } = FUZZY_TUNING_LABELS[key]
  return { label: t(label), unit: t(unit) }
}

// Tên và đơn vị tham số phát hiện theo Zone (EXPERT-FR-008), theo mô tả DetectionTuning trong api-spec
const DETECTION_TUNING_LABELS: Record<keyof DetectionTuning, { label: string; unit: string }> = {
  noise_margin_db: { label: 'Ồn vượt mức nền', unit: ' dB' },
  noise_min_sec: { label: 'Thời gian ồn tối thiểu', unit: ' giây' },
  pump_dry_on_sec: { label: 'Thời gian bơm trước khi xét', unit: ' giây' },
  pump_dry_min_rise_pct: { label: 'Độ ẩm phải tăng tối thiểu', unit: '%' },
  speaker_drop_pct: { label: 'Mức loa giảm so với nền', unit: '%' },
}

export function getDetectionTuningLabel(key: keyof DetectionTuning): { label: string; unit: string } {
  const { label, unit } = DETECTION_TUNING_LABELS[key]
  return { label: t(label), unit: t(unit) }
}

// Tên và đơn vị từng ngưỡng của zone (ENV-FR-006), cho lịch sử thay đổi: chỉ số + thấp nhất / cao nhất / tối đa
const THRESHOLD_KEY_LABELS: Record<keyof Thresholds, { metric: SensorMetric; label: string }> = {
  temp_min: { metric: 'temperature', label: 'Nhiệt độ thấp nhất' },
  temp_max: { metric: 'temperature', label: 'Nhiệt độ cao nhất' },
  humidity_min: { metric: 'humidity', label: 'Độ ẩm thấp nhất' },
  humidity_max: { metric: 'humidity', label: 'Độ ẩm cao nhất' },
  light_max: { metric: 'light', label: 'Ánh sáng tối đa' },
  nh3_max: { metric: 'nh3', label: 'NH3 tối đa' },
  co2_max: { metric: 'co2', label: 'CO2 tối đa' },
}

export function getThresholdKeyLabel(key: keyof Thresholds): { label: string; unit: string } {
  const { metric, label } = THRESHOLD_KEY_LABELS[key]
  return { label: t(label), unit: getMetricUnit(metric) }
}

// Tên và đơn vị tham số đếm chim của nhà (schema BirdCountTuning trong api-spec, EXPERT-FR-008)
const BIRD_COUNT_TUNING_LABELS: Record<keyof BirdCountTuning, { label: string; unit: string }> = {
  return_rate_drop_pct: { label: 'Tỷ lệ về tổ giảm', unit: '%' },
}

export function getBirdCountTuningLabel(key: keyof BirdCountTuning): { label: string; unit: string } {
  const { label, unit } = BIRD_COUNT_TUNING_LABELS[key]
  return { label: t(label), unit }
}

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Quản trị viên',
  FARM_OWNER: 'Chủ trại',
  DOMAIN_EXPERT: 'Chuyên gia',
  FARM_TECHNICIAN: 'Kỹ thuật viên nhà yến',
}

// Tên vai trò của người dùng
export function getRoleLabel(role: Role): string {
  return t(ROLE_LABELS[role])
}

// Tên loại tổ như web (harvest.i18n nestType.*)
const NEST_TYPE_LABELS: Record<NestType, string> = {
  RAW: 'Yến trắng',
  CLEANED: 'Yến hồng',
  PREMIUM: 'Yến huyết',
}

export function getNestTypeLabel(nestType: NestType): string {
  return t(NEST_TYPE_LABELS[nestType])
}

// Tên đầy đủ của loại cảnh báo (BR-15, đủ 15 loại của backend)
const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  THRESHOLD_BREACH: 'Vượt ngưỡng',
  NODE_OFFLINE: 'Thiết bị mất kết nối',
  SPEAKER_FAILURE: 'Loa không phát',
  MISTING_INEFFECTIVE: 'Phun sương không hiệu quả',
  NOISE_ANOMALY: 'Tiếng ồn bất thường',
  UNEXPECTED_RESTART: 'Khởi động lại bất thường',
  LOW_RETURN_RATE: 'Tỉ lệ về tổ giảm',
  EDGE_AI_DEGRADED: 'Camera đếm chim gián đoạn',
  SENSOR_FAULT: 'Lỗi cảm biến',
  RS485_BUS_FAILURE: 'Lỗi bus cảm biến',
  SENSOR_ANOMALY: 'Dữ liệu cảm biến bất thường',
  FORECAST_BREACH: 'Dự báo sắp vượt ngưỡng',
  MAINTENANCE_DUE: 'Đến hạn bảo trì bơm, quạt',
  ACTUATOR_FAULT: 'Bơm hoặc quạt không chạy đúng',
  CONFIG_MISMATCH: 'Thiết bị chưa nhận cấu hình mới',
}

// Đủ 15 loại cảnh báo theo thứ tự của bảng nhãn (màn chọn kênh theo loại, ALERT-FR-005)
export const ALERT_TYPES = Object.keys(ALERT_TYPE_LABELS) as AlertType[]

export function getAlertTypeLabel(type: AlertType): string {
  return t(ALERT_TYPE_LABELS[type])
}

// Trạng thái cảnh báo (Report 3 §6.1)
const ALERT_STATUS_LABELS: Record<AlertStatus, string> = {
  ACTIVE: 'Mới',
  ACKNOWLEDGED: 'Đã xác nhận',
  DISMISSED: 'Bị bác bỏ',
  RESOLVED: 'Đã tự hết',
}

export function getAlertStatusLabel(status: AlertStatus): string {
  return t(ALERT_STATUS_LABELS[status])
}

// Nguyên nhân tìm thấy tại chỗ (ALERT-FR-018), cùng chữ với todo G-21: nước, béc phun, bơm, quạt, cửa, cảm biến, loa, khác
const SITE_CAUSE_LABELS: Record<SiteCause, string> = {
  WATER: 'Nước',
  NOZZLE: 'Béc phun',
  PUMP: 'Bơm',
  FAN: 'Quạt',
  DOOR: 'Cửa',
  SENSOR: 'Cảm biến',
  SPEAKER: 'Loa',
  OTHER: 'Khác',
}

export function getSiteCauseLabel(cause: SiteCause): string {
  return t(SITE_CAUSE_LABELS[cause])
}

// Điều thợ quan sát được khi kiểm tra tại chỗ (EXPERT-FR-021)
const ONSITE_OBSERVATION_LABELS: Record<OnsiteObservation, string> = {
  BIRDS_DISTURBED: 'Chim bị động',
  WORK_OR_PEOPLE_NEARBY: 'Có người hoặc công việc gần đó',
  RAIN: 'Mưa',
  SENSOR_DIRTY_OR_FAULTY: 'Cảm biến bẩn hoặc hỏng',
  NOTHING_UNUSUAL: 'Không có gì lạ',
  OTHER: 'Khác',
}

// Thứ tự hiện trên form trả lời
export const ONSITE_OBSERVATIONS = Object.keys(ONSITE_OBSERVATION_LABELS) as OnsiteObservation[]

export function getOnsiteObservationLabel(observation: OnsiteObservation): string {
  return t(ONSITE_OBSERVATION_LABELS[observation])
}

// Trạng thái Work Order (Report 3 §6.19, SM-19)
const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  OPEN: 'Chờ bắt đầu',
  IN_PROGRESS: 'Đang làm',
  VERIFYING: 'Đang kiểm dữ liệu',
  AWAITING_APPROVAL: 'Chờ chủ trại duyệt',
  CLOSED: 'Đã đóng',
  CANCELLED: 'Đã huỷ',
}

export function getWorkOrderStatusLabel(status: WorkOrderStatus): string {
  return t(WORK_ORDER_STATUS_LABELS[status])
}

// Nguồn mở Work Order (BR-39)
const WORK_ORDER_ORIGIN_LABELS: Record<WorkOrderOrigin, string> = {
  ALERT: 'Mở tự động từ cảnh báo thiết bị',
  OUTAGE: 'Mở tự động: thiết bị mất kết nối quá 30 phút',
  EXPERT: 'Chuyên gia xác nhận cần tới nhà',
  ONSITE_CHECK: 'Kiểm tra tại chỗ thấy cảm biến hỏng',
  MANUAL: 'Chủ trại mở',
}

export function getWorkOrderOriginLabel(origin: WorkOrderOrigin): string {
  return t(WORK_ORDER_ORIGIN_LABELS[origin])
}
