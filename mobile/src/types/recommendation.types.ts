import type { FuzzyTuning, Thresholds } from '@/types/farm.types'

// Khuyến nghị của nhà (EXPERT-FR-016…019, BR-42, Report 3 §6.21) — khớp Recommendation trong api-spec

// Chỉ số theo ngày của nhà mà luật xét
export type RecommendationIndicator = 'TIME_IN_RANGE' | 'AIR_HOURS_OVER' | 'RETURN_RATE' | 'NOISE_EPISODES' | 'MISTING_INEFFECTIVE'

// GTE: chỉ số ≥ giá trị · LTE: chỉ số ≤ giá trị
export type RecommendationComparison = 'GTE' | 'LTE'

export type RecommendationStatus = 'OPEN' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'MEASURED'

// Hệ số fuzzy dạng số mà luật đổi được (công tắc lọc đầu vào không đổi bằng khuyến nghị)
export type FuzzyNumericKey = Exclude<keyof FuzzyTuning, 'fuzzy_input_filter'>

// WORK_ORDER: mở một phiếu sửa chữa có tiêu đề · PARAMETER_CHANGE: đổi một ngưỡng hoặc hệ số fuzzy của mọi zone trong nhà
export type RecommendationAction =
  | { type: 'WORK_ORDER'; title: string }
  | { type: 'PARAMETER_CHANGE'; group: 'thresholds'; key: keyof Thresholds; value: number }
  | { type: 'PARAMETER_CHANGE'; group: 'fuzzy'; key: FuzzyNumericKey; value: number }

// Giá trị chỉ số của một ngày trong cửa sổ của luật; null khi ngày đó thiếu số
export interface RecommendationEvidenceDay {
  date: string
  value: number | null
}

// Luật lúc khuyến nghị mở; chấp nhận làm theo bản này
export interface RecommendationRuleSnapshot {
  name: string
  indicator: RecommendationIndicator
  comparison: RecommendationComparison
  value: number
  window_days: number
  action: RecommendationAction
}

export interface Recommendation {
  _id: string
  farm_id: string
  house_id: string
  // Ở danh sách backend kèm tên và hành động của luật
  rule_id: { _id: string; name: string; action: RecommendationAction } | string
  // Khuyến nghị mở trước 17/11/2026 không có
  rule_snapshot?: RecommendationRuleSnapshot
  status: RecommendationStatus
  evidence: {
    indicator: RecommendationIndicator
    comparison: RecommendationComparison
    value: number
    window_days: number
    days: RecommendationEvidenceDay[]
  }
  raised_at: string
  // Ngày (giờ VN) luật thoả
  raised_for: string
  decided_at?: string
  expired_at?: string
  reject_reason?: string
  work_order_id?: string
  review_ids?: string[]
  // Trung bình 7 ngày sau trừ 7 ngày trước ngày chấp nhận; null khi thiếu số
  effect?: { before: number | null; after: number | null; change: number | null; improved: boolean | null; measured_at: string }
}
