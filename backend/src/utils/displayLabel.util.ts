import type {
  AlertSeverity, AlertType, BirdCountTuning, DetectionTuning, DeviceStatus, FuzzyTuning, HealthLevels, HouseStage, Role, Thresholds,
} from '@/types/domain.types'
import type { WorkOrderStatus } from '@/models/workOrder.model'
import type { ConfigProfileStatus } from '@/models/configProfile.model'

// Cùng tên với web (FE_Design); không đưa mã enum ra người dùng

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Quản trị viên',
  FARM_OWNER: 'Chủ nhà yến',
  FARM_TECHNICIAN: 'Kỹ thuật viên',
  DOMAIN_EXPERT: 'Chuyên gia',
}

export const DEVICE_STATUS_LABEL: Record<DeviceStatus, string> = {
  PENDING: 'Chờ kết nối',
  ONLINE: 'Online',
  OFFLINE: 'Mất kết nối',
}

export const WORK_ORDER_STATUS_LABEL: Record<WorkOrderStatus, string> = {
  OPEN: 'Chưa bắt đầu',
  IN_PROGRESS: 'Đang làm',
  VERIFYING: 'Đang kiểm dữ liệu',
  AWAITING_APPROVAL: 'Chờ duyệt',
  CLOSED: 'Đã đóng',
  CANCELLED: 'Đã huỷ',
}

export const PROFILE_STATUS_LABEL: Record<ConfigProfileStatus, string> = {
  DRAFT: 'Bản nháp',
  APPROVED: 'Đã duyệt',
  ARCHIVED: 'Lưu trữ',
}

// Tiêu đề mặc định của cảnh báo thiết bị gửi (firmware không gửi title)
export const ALERT_TYPE_LABEL: Record<AlertType, string> = {
  THRESHOLD_BREACH: 'Vượt ngưỡng môi trường',
  NODE_OFFLINE: 'Thiết bị mất kết nối',
  SPEAKER_FAILURE: 'Lỗi loa ru',
  MISTING_INEFFECTIVE: 'Phun sương không hiệu quả',
  NOISE_ANOMALY: 'Tiếng ồn bất thường',
  LOW_RETURN_RATE: 'Tỷ lệ chim về thấp',
  EDGE_AI_DEGRADED: 'Camera đếm chim gặp sự cố',
  UNEXPECTED_RESTART: 'Thiết bị tự khởi động lại',
  SENSOR_FAULT: 'Lỗi cảm biến',
  RS485_BUS_FAILURE: 'Lỗi đường truyền cảm biến',
  SENSOR_ANOMALY: 'Cảm biến bất thường',
  FORECAST_BREACH: 'Sắp vượt ngưỡng',
  MAINTENANCE_DUE: 'Đến hạn bảo trì bơm/quạt',
  ACTUATOR_FAULT: 'Bơm, quạt hoặc loa không chạy',
  CONFIG_MISMATCH: 'Thiết bị chưa nhận cấu hình mới',
}

export const HOUSE_STAGE_LABEL: Record<HouseStage, string> = {
  ATTRACTING: 'Đang dẫn dụ',
  OCCUPIED: 'Đã có chim ở',
}

export type ParameterField = keyof Thresholds | keyof FuzzyTuning | keyof DetectionTuning | keyof BirdCountTuning | keyof HealthLevels

// Tên tham số trong thông báo cho Chủ nhà yến, cùng tên với thẻ duyệt thay đổi trên web
export const PARAMETER_LABEL: Record<ParameterField, string> = {
  temp_min: 'Nhiệt độ tối thiểu (°C)',
  temp_max: 'Nhiệt độ tối đa (°C)',
  humidity_min: 'Độ ẩm tối thiểu (%)',
  humidity_max: 'Độ ẩm tối đa (%)',
  light_max: 'Ánh sáng tối đa (lux)',
  nh3_max: 'Khí NH3 tối đa (ppm)',
  co2_max: 'Khí CO2 tối đa (ppm)',
  fuzzy_humidity_band: 'Dải biên độ ẩm (%RH)',
  fuzzy_temp_band: 'Dải biên nhiệt độ (°C)',
  fuzzy_fan_dry_level: 'Mức quạt hút khử ẩm (%)',
  fuzzy_window_sec: 'Chu kỳ điều khiển (giây)',
  fuzzy_input_filter: 'Lọc nhiễu cảm biến đầu vào',
  noise_margin_db: 'Biên độ ồn vượt nền (dB)',
  noise_min_sec: 'Thời gian ồn tối thiểu (giây)',
  pump_dry_on_sec: 'Thời gian bơm chạy không tăng ẩm (giây)',
  pump_dry_min_rise_pct: 'Độ ẩm cần tăng tối thiểu (%)',
  speaker_drop_pct: 'Độ sụt âm lượng báo hỏng loa (%)',
  return_rate_drop_pct: 'Mức giảm tỷ lệ chim về (%)',
  in_range_slight_pct: 'Môi trường lệch nhẹ',
  in_range_clear_pct: 'Môi trường lệch rõ',
  air_slight_h: 'Không khí lệch nhẹ',
  air_clear_h: 'Không khí lệch rõ',
  noise_slight: 'Tiếng ồn lệch nhẹ',
  noise_clear: 'Tiếng ồn lệch rõ',
}

// MEDIUM và LOW cùng là "Thường"
export const SEVERITY_LABEL: Record<AlertSeverity, string> = {
  CRITICAL: 'Khẩn cấp',
  HIGH: 'Cao',
  MEDIUM: 'Thường',
  LOW: 'Thường',
}

const VN_DATE_TIME = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric', hour12: false,
})
export const formatVnDateTime = (at: Date): string => VN_DATE_TIME.format(at)
