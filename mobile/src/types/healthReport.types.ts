import type { AlertType } from './alert.types'

// Báo cáo sức khoẻ và đánh giá ngày (EXPERT-FR-005/006, MF-11)

export interface ExpertConclusion {
  text: string
  by: { _id: string; full_name: string }
  at: string
}

// Số liệu của một kỳ báo cáo (healthReport.service.ts buildZoneMetrics); phần trăm là 0–100, null khi không có mẫu.
// api-spec chưa ghi trường này (Known debt) nhưng backend trả kèm báo cáo
export interface ZoneHealthMetrics {
  sample_count: number
  temp_in_range_pct: number | null
  humidity_in_range_pct: number | null
  auto_mode_pct: number | null
  misting_switches: number
  ventilation_switches: number
  alerts_by_type: Partial<Record<AlertType, number>>
  avg_return_rate: number | null
  nh3_avg: number | null
  nh3_max: number | null
  co2_avg: number | null
  co2_max: number | null
}

// Báo cáo sức khoẻ của một Zone trong một kỳ — khớp ZoneHealthReport trong api-spec, cộng metrics backend trả
export interface ZoneHealthReport {
  _id: string
  farm_id: string
  zone_id: string
  period_start: string
  period_end: string
  generated_at: string
  // null khi chuyên gia chưa viết kết luận, hoặc farm không có chuyên gia
  expert_conclusion: ExpertConclusion | null
  metrics?: ZoneHealthMetrics
}

// GET /health-reports/preview — báo cáo khoảng tự chọn, không lưu
export interface HealthReportPreview {
  zone_id: string
  farm_id: string
  period_start: string
  period_end: string
  metrics: ZoneHealthMetrics
}

// Một ngày của một nhà đang chờ người dùng chấm (MF-11, BR-31) — CHƯA CÓ API (gap G-11).
// Dạng theo bảng HOUSE_HEALTH_DAY của Report 4 §6, cộng tên nhà/trang trại do server trả sẵn;
// không có trạng thái, lý do hay đánh giá của người khác vì người dùng phải chấm trước khi thấy
export interface PendingHealthDay {
  _id: string
  house_id: string
  house_name: string
  farm_id: string
  farm_name: string
  // Ngày cần đánh giá, YYYY-MM-DD giờ Việt Nam
  date: string
}
