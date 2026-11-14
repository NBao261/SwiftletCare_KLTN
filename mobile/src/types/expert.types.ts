import type {
  ChangeReviewStatus,
  CoefficientProposal,
  ExpertActivityEntry,
  ParameterReview,
  ProposalStatus,
} from './account.types'
import type {
  Alert,
  AlertEvidence,
  AlertStatus,
  AlertVerdict,
  AlertVerdictResult,
  EvidenceSourceStatus,
  EvidenceTelemetrySample,
} from './alert.types'
import type { BirdCountBucket } from './analytics.types'
import type {
  HouseHealthReport,
  HouseHealthReportKind,
  HouseHealthReportSummary,
} from './healthReport.types'

export type {
  AlertEvidence,
  BirdCountBucket,
  ChangeReviewStatus,
  CoefficientProposal,
  EvidenceSourceStatus,
  EvidenceTelemetrySample,
  ExpertActivityEntry,
  HouseHealthReport,
  HouseHealthReportKind,
  HouseHealthReportSummary,
  ParameterReview,
  ProposalStatus,
}

// Các loại cảnh báo suy luận cần chuyên gia kiểm chứng (EXPERT-FR-003, api-spec.yaml dòng 3105/3303)
// MISTING_INEFFECTIVE là device alert, không phải inferred type — không hiện trong hàng đợi kiểm chứng
export type InferredAlertType =
  | 'NOISE_ANOMALY'
  | 'SENSOR_ANOMALY'
  | 'FORECAST_BREACH'
  | 'LOW_RETURN_RATE'

// Kết quả kiểm chứng của chuyên gia
export type VerdictResult = AlertVerdictResult

export type ExpertVerdict = AlertVerdict

export interface InferredAlert extends Alert {
  previous_status?: AlertStatus
}

export type TelemetrySample = EvidenceTelemetrySample

// Trạng thái kiểm duyệt thay đổi của chủ farm (EXPERT-FR-010)
export type ReviewItemStatus = ChangeReviewStatus

export interface ReviewItem {
  _id: string
  farm_id: string
  zone_id: string
  group?: 'thresholds' | 'fuzzy'
  parameter_group?: 'thresholds' | 'fuzzy'
  status: ReviewItemStatus
  old_values: Record<string, number>
  new_values: Record<string, number>
  changed_by: string | { _id: string; full_name?: string }
  created_at: string
  updated_at?: string
}

// Trạng thái sức khỏe nhà yến (EXPERT-FR-005, BR-28)
export type DailyHealthStatus = 'GOOD' | 'WATCH' | 'ACTION' | 'INSUFFICIENT_DATA'

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
  current?: ExpertFuzzyTuning
  model?: { r2: number; samples: number; days: number } | null
  suggestion?: Partial<ExpertFuzzyTuning> | null
  reason?: string | null
  predicted?: {
    inRangeNow: number
    inRangeSuggested: number
    mistingNow: number
    mistingSuggested: number
  }
  suggested_values?: Partial<ExpertFuzzyTuning>
  current_values?: ExpertFuzzyTuning
  r_squared?: number
  predicted_in_range_pct?: number
  reasoning?: string
}

