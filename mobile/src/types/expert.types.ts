import type { Alert, AlertStatus } from './alert.types'

// Các loại cảnh báo suy luận cần chuyên gia kiểm chứng (EXPERT-FR-003)
export type InferredAlertType =
  | 'NOISE_ANOMALY'
  | 'SENSOR_ANOMALY'
  | 'FORECAST_BREACH'
  | 'LOW_RETURN_RATE'
  | 'MISTING_INEFFECTIVE'

// Kết quả kiểm chứng của chuyên gia
export type VerdictResult = 'CONFIRMED' | 'REJECTED'

export interface ExpertVerdict {
  result: VerdictResult
  note: string
  by: { _id: string; full_name: string }
  role: 'DOMAIN_EXPERT' | 'FARM_OWNER'
  at: string
}

export interface InferredAlert extends Alert {
  expert_verdict?: ExpertVerdict
  previous_status?: AlertStatus
  house_id?: string
}

export interface TelemetrySample {
  timestamp: string
  temperature?: number
  humidity?: number
  nh3?: number
  co2?: number
  sound_db?: number
  light?: number
}

export interface BirdCountBucket {
  bucket_start: string
  entry_count: number
  exit_count: number
}

// Bằng chứng đa phương thức (ALERT-FR-014)
export interface AlertEvidence {
  alert_id: string
  type: InferredAlertType
  window: { from: string; to: string }
  telemetry?: { status: 'ok' | 'missing'; samples: TelemetrySample[] }
  bird_counts?: { status: 'ok' | 'missing'; buckets: BirdCountBucket[] }
  device_alerts: Alert[]
  earlier_verdicts: InferredAlert[]
}

// Trạng thái kiểm duyệt thay đổi của chủ farm (EXPERT-FR-010)
export type ReviewItemStatus = 'PENDING_REVIEW' | 'ACCEPTED' | 'REVERTED' | 'ADJUSTED'

export interface ReviewItem {
  _id: string
  farm_id: string
  zone_id: string
  parameter_group: 'thresholds' | 'fuzzy'
  status: ReviewItemStatus
  old_values: Record<string, number>
  new_values: Record<string, number>
  changed_by: { _id: string; full_name: string }
  created_at: string
}

// Trạng thái đề xuất hệ số mờ từ chủ farm (EXPERT-FR-011)
export type ProposalStatus = 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'SUPERSEDED'

export interface CoefficientProposal {
  _id: string
  farm_id: string
  zone_id: string
  status: ProposalStatus
  suggested_values: Record<string, number>
  current_values: Record<string, number>
  r_squared: number
  predicted_in_range_pct: number
  submitted_by: { _id: string; full_name: string }
  created_at: string
}

// Trạng thái sức khỏe nhà yến (EXPERT-FR-005, BR-28)
export type DailyHealthStatus = 'GOOD' | 'WATCH' | 'ACTION' | 'INSUFFICIENT_DATA'

// Đánh giá ngày độc lập 2 bước (EXPERT-FR-012, BR-31)
export interface DayRating {
  _id: string
  house_id: string
  date: string // YYYY-MM-DD
  system_status?: DailyHealthStatus
  system_reasons?: string[]
  assessor_status?: DailyHealthStatus
  note?: string
  state: 'PENDING' | 'RATED' | 'SKIPPED' | 'EXPIRED'
}

// Loại hành động của chuyên gia cho nhật ký hoạt động (EXPERT-FR-009)
export type ExpertActionType =
  | 'ALERT_VERDICT_SET'
  | 'THRESHOLD_UPDATED'
  | 'THRESHOLD_RESET'
  | 'FUZZY_UPDATED'
  | 'DETECTION_TUNING_UPDATED'
  | 'REVIEW_ACCEPTED'
  | 'REVIEW_REVERTED'
  | 'REVIEW_ADJUSTED'
  | 'PROPOSAL_APPROVED'
  | 'PROPOSAL_REJECTED'
  | 'CONCLUSION_WRITTEN'
  | 'COUNTING_RING_SET'
  | 'COUNTING_SCHEDULE_SET'

export interface ExpertActivityEntry {
  _id: string
  action: ExpertActionType
  actor: { _id: string; full_name: string }
  actor_role: 'DOMAIN_EXPERT' | 'FARM_OWNER'
  target_type: 'Alert' | 'Zone' | 'House' | 'Report'
  target_id: string
  zone_id?: string
  house_id?: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface ExpertVerdictStats {
  type: InferredAlertType
  total: number
  confirmed: number
  rejected: number
  pending: number
  confirmation_rate: number
}

// Cấu hình Ngưỡng & Vi khí hậu Zone (BR-01, BR-02)
export interface ExpertThresholds {
  temp_min: number
  temp_max: number
  humidity_min: number
  humidity_max: number
  light_max?: number
  nh3_max?: number
  co2_max?: number
}

// Hệ số điều khiển mờ Fuzzy (BR-05)
export interface ExpertFuzzyTuning {
  fuzzy_humidity_band: number
  fuzzy_temp_band: number
  fuzzy_fan_dry_level: number
  fuzzy_window_sec: number
  fuzzy_input_filter: boolean
}

// Tham số phát hiện bất thường Zone & House (BR-09)
export interface ExpertDetectionTuning {
  noise_margin_db: number
  noise_min_sec: number
  pump_dry_on_sec: number
  pump_dry_min_rise_pct: number
  speaker_drop_pct: number
  return_rate_drop_pct?: number
}

export interface FuzzySuggestionResponse {
  suggested_values: Partial<ExpertFuzzyTuning>
  current_values: ExpertFuzzyTuning
  r_squared: number
  predicted_in_range_pct: number
  reasoning?: string
}

export interface ZoneHealthReportItem {
  _id: string
  zone_id: string
  farm_id: string
  report_type: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  period_start: string
  period_end: string
  health_status: DailyHealthStatus
  time_in_range_pct: number
  autonomy_pct: number
  alerts_count: number
  confirmed_alerts_count: number
  expert_conclusion?: string
  expert_conclusion_by?: { _id: string; full_name: string }
  expert_conclusion_at?: string
  created_at: string
}
