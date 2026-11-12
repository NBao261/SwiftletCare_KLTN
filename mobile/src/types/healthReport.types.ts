// Trạng thái sức khỏe theo ngày và báo cáo theo nhà yến (MF-06: ANALYTICS-FR-012, EXPERT-FR-005/006/012, BR-28…31)

import type { Role } from './auth.types'

export interface ExpertConclusion {
  text: string
  by: { _id: string; full_name: string }
  at: string
  // Lần sửa gần nhất của tác giả (EXPERT-FR-006)
  edited_at?: string | null
}

// Mức người chấm chọn (EXPERT-FR-012)
export type HealthRatingValue = 'GOOD' | 'WATCH' | 'ACTION'

// Trạng thái ngày do hệ thống tính (BR-29)
export type HealthDayStatus = HealthRatingValue | 'INSUFFICIENT_DATA'

// Trạng thái chấm của chính người gọi (SM-18); null khi người gọi không phải người chấm
export type MyRatingState = 'PENDING' | 'RATED' | 'SKIPPED' | 'EXPIRED'

// 4 nguồn của trạng thái ngày (BR-28)
export type HealthSource = 'environment' | 'air' | 'flock' | 'noise'

// Mức của một nguồn; null khi nguồn không đủ dữ liệu
export type HealthIndicatorLevel = 'NORMAL' | 'SLIGHT' | 'CLEAR'

export interface HealthIndicator {
  // environment: % thời gian trong ngưỡng; air: giờ vượt ngưỡng; flock: % tỷ lệ chim về giảm; noise: số đợt
  value: number | null
  level: HealthIndicatorLevel | null
  details?: Record<string, unknown>
}

export type HealthReasonCode =
  | 'ALL_NORMAL'
  | 'MISSING_DATA'
  | 'NOT_ASSESSED'
  | 'ENV_IN_RANGE'
  | 'AIR_OVER_LIMIT'
  | 'FLOCK_DROP'
  | 'FLOCK_NO_BASELINE'
  | 'NOISE_EPISODES'
  | 'WEATHER_UNAVAILABLE'
  | 'RAIN_DOWNGRADE'
  | 'ATTRACTING_STAGE'

// Một lý do của trạng thái ngày, dạng mã + số liệu để app tự dịch (schema HealthReason)
export interface HealthReason {
  code: HealthReasonCode
  source: HealthSource | null
  level: 'SLIGHT' | 'CLEAR' | null
  values: Record<string, unknown>
}

export interface HealthDayWeather {
  temperature_min: number | null
  temperature_max: number | null
  humidity_avg: number | null
  precipitation_mm: number | null
  hours: number
}

// Điểm của một người chấm, kèm ảnh chụp trạng thái lúc chấm
// Vai trò của người chấm: Farm Owner, Farm Technician (BR-31); DOMAIN_EXPERT chỉ còn ở điểm chấm cũ trước Report 3 4.2.0
export type HealthRaterRole = Extract<Role, 'FARM_OWNER' | 'FARM_TECHNICIAN' | 'DOMAIN_EXPERT'>

export interface HealthDayRating {
  _id: string
  by: { _id: string; full_name: string | null }
  role: HealthRaterRole
  outcome: 'RATED' | 'SKIPPED'
  rating: HealthRatingValue | null
  note: string | null
  at: string
  snapshot?: { status: HealthDayStatus; reasons: HealthReason[] }
}

// Trạng thái 1 ngày của 1 nhà (HouseHealthDay). Ngày người gọi còn PENDING không có các trường đánh dấu "ẩn" (BR-31)
export interface HouseHealthDay {
  _id: string
  house_id: string
  house_name: string
  farm_id: string
  // YYYY-MM-DD giờ Việt Nam
  date: string
  weather: HealthDayWeather | null
  computed_at?: string
  my_rating_state: MyRatingState | null
  rating_deadline: string
  // ẩn khi PENDING
  indicators?: Partial<Record<HealthSource, HealthIndicator>>
  // ẩn khi PENDING
  completeness?: Partial<Record<HealthSource, boolean>>
  // ẩn khi PENDING
  current_status?: HealthDayStatus
  // ẩn khi PENDING
  current_reasons?: HealthReason[]
  // ẩn khi PENDING
  ratings?: HealthDayRating[]
}

export type HouseHealthReportKind = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM'

// Phần tóm tắt một báo cáo theo nhà (danh sách)
export interface HouseHealthReportSummary {
  _id: string
  farm_id: string
  house_id: string
  house_name: string
  kind: HouseHealthReportKind
  // YYYY-MM-DD giờ Việt Nam, tính cả hai đầu
  period_start: string
  period_end: string
  generated_at: string
  has_conclusion: boolean
}

// Mục của một Zone trong báo cáo theo nhà
export interface HealthReportZoneSection {
  zone_id: string
  zone_name: string
  sample_count: number
  temp_in_range_pct: number | null
  humidity_in_range_pct: number | null
  auto_mode_pct: number | null
  misting_switches: number
  ventilation_switches: number
  alerts_by_type: Partial<Record<string, number>>
  inferred_alerts?: { confirmed: number; dismissed: number; pending: number }
  device_faults?: Partial<Record<string, number>>
  nh3_avg: number | null
  nh3_max: number | null
  co2_avg: number | null
  co2_max: number | null
}

// Báo cáo sức khỏe 1 nhà trong 1 kỳ (HouseHealthReport) — ngày người gọi chưa chấm bị che (BR-31)
export interface HouseHealthReport extends HouseHealthReportSummary {
  house_metrics?: {
    return_rate_trend: { date: string; return_rate: number | null; complete: boolean }[]
    avg_return_rate: number | null
    weather: {
      temperature_min: number | null
      temperature_max: number | null
      humidity_avg: number | null
      precipitation_mm: number | null
      rain_days: number
    } | null
  }
  zone_sections?: HealthReportZoneSection[]
  days?: HouseHealthDay[]
  status_counts?: Partial<Record<HealthDayStatus, number>>
  hidden_days?: number
  expert_conclusion: ExpertConclusion | null
}
