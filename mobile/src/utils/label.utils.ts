import type {
  AlertSeverity,
  AlertStatus,
  AlertType,
  BirdCountTuning,
  ControlMode,
  DetectionTuning,
  DeviceStatus,
  CountingWindowSource,
  FuzzyTuning,
  HarvestCycleStatus,
  HealthLevels,
  HouseStage,
  WeatherMetric,
  ChecklistResult,
  MaintenanceBasis,
  MaintenanceEquipment,
  MaintenancePlanState,
  NestType,
  RecommendationIndicator,
  RecommendationStatus,
  OnsiteObservation,
  ParameterReviewGroup,
  RelayName,
  Role,
  SiteCause,
  Thresholds,
  WorkOrderOrigin,
  WorkOrderStatus,
} from '@/types'
import type { ConfigApplyStep } from '@/utils/device.utils'
import type { SensorMetric, ThresholdMetric } from '@/utils/threshold.utils'
import { t } from '@/utils/i18n.utils'
import { getSeverityLevel, getSeverityLevelLabel } from '@/utils/severity.utils'

const DEVICE_STATUS_LABELS: Record<DeviceStatus, string> = {
  PENDING: 'Chờ kết nối',
  ONLINE: 'Trực tuyến',
  OFFLINE: 'Mất kết nối',
}

// Bước áp cấu hình khu vực của controller (ENV-FR-027, Report 3 §6.12), đọc qua getConfigApplyStep
const CONFIG_APPLY_LABELS: Record<ConfigApplyStep, string> = {
  'waiting-connection': 'Chờ kết nối để nhận cấu hình',
  'waiting-config': 'Đang gửi cấu hình',
  applied: 'Đã áp cấu hình',
  mismatch: 'Chưa áp cấu hình mới',
  unknown: 'Không rõ phiên bản cấu hình',
}

// Nhãn tiếng Việt của bước áp cấu hình khu vực
export function getConfigApplyLabel(step: ConfigApplyStep): string {
  return t(CONFIG_APPLY_LABELS[step])
}

// Giai đoạn nhà (FARM-FR-014)
const HOUSE_STAGE_LABELS: Record<HouseStage, string> = {
  ATTRACTING: 'Đang dẫn dụ',
  OCCUPIED: 'Đã có chim ở',
}

// Nhãn tiếng Việt của giai đoạn nhà
export function getHouseStageLabel(stage: HouseStage): string {
  return t(HOUSE_STAGE_LABELS[stage])
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
  PLAN: 'Mở tự động: kế hoạch bảo trì đến hạn',
  CHECKLIST: 'Mục checklist bảo trì ghi hỏng',
  RECOMMENDATION: 'Chủ trại chấp nhận khuyến nghị',
}

export function getWorkOrderOriginLabel(origin: WorkOrderOrigin): string {
  return t(WORK_ORDER_ORIGIN_LABELS[origin])
}

// Thiết bị của kế hoạch bảo trì (OPS-FR-005), cùng chữ với web (maintenance.i18n.ts)
const MAINTENANCE_EQUIPMENT_LABELS: Record<MaintenanceEquipment, string> = {
  PUMP: 'Bảo trì bơm phun sương',
  FAN: 'Bảo trì quạt thông gió',
  SENSOR: 'Vệ sinh cảm biến',
  NOZZLE: 'Vệ sinh béc phun',
  CALIBRATION: 'Hiệu chuẩn cảm biến',
}

export function getMaintenanceEquipmentLabel(equipment: MaintenanceEquipment): string {
  return t(MAINTENANCE_EQUIPMENT_LABELS[equipment])
}

// Chu kỳ của kế hoạch kèm đơn vị theo cách tính: giờ chạy, số lần đóng cắt, số ngày
export function formatMaintenanceInterval(basis: MaintenanceBasis, value: number): string {
  if (basis === 'RUN_HOURS') return t('{n} giờ chạy', { n: value })
  if (basis === 'SWITCHES') return t('{n} lần đóng cắt', { n: value })
  return t('{n} ngày', { n: value })
}

// Trạng thái kế hoạch bảo trì (Report 3 §6.20, SM-20), cùng chữ với web
const MAINTENANCE_PLAN_STATE_LABELS: Record<MaintenancePlanState, string> = {
  SCHEDULED: 'Đã lên lịch',
  DUE: 'Đến hạn',
  OVERDUE: 'Quá hạn',
  RETIRED: 'Đã xoá',
}

export function getMaintenancePlanStateLabel(state: MaintenancePlanState): string {
  return t(MAINTENANCE_PLAN_STATE_LABELS[state])
}

// Kết quả một mục checklist (OPS-FR-007)
const CHECKLIST_RESULT_LABELS: Record<ChecklistResult, string> = {
  OK: 'Đạt',
  DEFECT: 'Hỏng',
}

export function getChecklistResultLabel(result: ChecklistResult): string {
  return t(CHECKLIST_RESULT_LABELS[result])
}

// Chỉ số theo ngày mà luật khuyến nghị xét (EXPERT-FR-016) kèm đơn vị
const RECOMMENDATION_INDICATOR_LABELS: Record<RecommendationIndicator, { label: string; unit: string }> = {
  TIME_IN_RANGE: { label: 'Thời gian trong ngưỡng', unit: '%' },
  AIR_HOURS_OVER: { label: 'Số giờ NH3, CO2 vượt ngưỡng', unit: 'giờ' },
  RETURN_RATE: { label: 'Tỷ lệ về tổ', unit: '%' },
  NOISE_EPISODES: { label: 'Số đợt tiếng ồn bất thường', unit: 'đợt' },
  MISTING_INEFFECTIVE: { label: 'Số lần phun sương không hiệu quả', unit: 'lần' },
}

export function getRecommendationIndicatorLabel(indicator: RecommendationIndicator): { label: string; unit: string } {
  const { label, unit } = RECOMMENDATION_INDICATOR_LABELS[indicator]
  return { label: t(label), unit: t(unit) }
}

// Trạng thái khuyến nghị (Report 3 §6.21)
const RECOMMENDATION_STATUS_LABELS: Record<RecommendationStatus, string> = {
  OPEN: 'Chờ quyết định',
  ACCEPTED: 'Đã chấp nhận',
  REJECTED: 'Đã từ chối',
  EXPIRED: 'Hết hạn',
  MEASURED: 'Đã đo hiệu quả',
}

export function getRecommendationStatusLabel(status: RecommendationStatus): string {
  return t(RECOMMENDATION_STATUS_LABELS[status])
}

// Chỉ số dự báo mà luật bù thời tiết xét (ENV-FR-030, dự báo 2 giờ tới) kèm đơn vị
const WEATHER_METRIC_LABELS: Record<WeatherMetric, { label: string; unit: string }> = {
  temperature: { label: 'Nhiệt độ cao nhất dự báo', unit: '°C' },
  humidity: { label: 'Độ ẩm ngoài trời cao nhất', unit: '%' },
  rain: { label: 'Tổng mưa dự báo', unit: 'mm' },
}

export function getWeatherMetricLabel(metric: WeatherMetric): { label: string; unit: string } {
  const { label, unit } = WEATHER_METRIC_LABELS[metric]
  return { label: t(label), unit }
}

// Mức chỉ số sức khỏe của nhà (BR-28) kèm đơn vị
const HEALTH_LEVEL_LABELS: Record<keyof HealthLevels, { label: string; unit: string }> = {
  in_range_slight_pct: { label: 'Trong ngưỡng: nhẹ khi dưới', unit: '%' },
  in_range_clear_pct: { label: 'Trong ngưỡng: rõ khi dưới', unit: '%' },
  air_slight_h: { label: 'Không khí vượt ngưỡng: nhẹ từ', unit: 'giờ' },
  air_clear_h: { label: 'Không khí vượt ngưỡng: rõ từ', unit: 'giờ' },
  noise_slight: { label: 'Tiếng ồn bất thường: nhẹ từ', unit: 'đợt' },
  noise_clear: { label: 'Tiếng ồn bất thường: rõ từ', unit: 'đợt' },
}

export function getHealthLevelLabel(key: keyof HealthLevels): { label: string; unit: string } {
  const { label, unit } = HEALTH_LEVEL_LABELS[key]
  return { label: t(label), unit: t(unit) }
}

// Nhóm tham số của mục chờ chuyên gia duyệt (BR-22, EXPERT-FR-010), cùng tên với màn cài đặt nhà trên mobile
const PARAMETER_REVIEW_GROUP_LABELS: Record<ParameterReviewGroup, string> = {
  thresholds: 'Ngưỡng',
  fuzzy: 'Hệ số điều khiển',
  detection: 'Tham số phát hiện',
  return_rate_drop: 'Mức giảm tỷ lệ về tổ',
  health_levels: 'Mức chỉ số sức khỏe',
  counting_schedule: 'Lịch đếm chim',
  counting_ring: 'Vòng đếm',
}

export function getParameterReviewGroupLabel(group: ParameterReviewGroup): string {
  return t(PARAMETER_REVIEW_GROUP_LABELS[group])
}

// Nguồn của khung đếm đang áp hôm nay (VISION-FR-019, BR-13)
const COUNTING_WINDOW_SOURCE_LABELS: Record<CountingWindowSource, string> = {
  TEMPORARY: 'Khung tạm',
  PROFILE: 'Hồ sơ theo mùa',
  DEFAULT: 'Khung mặc định',
}

export function getCountingWindowSourceLabel(source: CountingWindowSource): string {
  return t(COUNTING_WINDOW_SOURCE_LABELS[source])
}

// Trạng thái chu kỳ thu hoạch (Report 3 §6.22)
const HARVEST_CYCLE_STATUS_LABELS: Record<HarvestCycleStatus, string> = {
  OPEN: 'Đang diễn ra',
  CLOSED: 'Đã đóng',
  CONCLUDED: 'Đã có kết luận',
}

export function getHarvestCycleStatusLabel(status: HarvestCycleStatus): string {
  return t(HARVEST_CYCLE_STATUS_LABELS[status])
}
