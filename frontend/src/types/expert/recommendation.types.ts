// EXPERT-FR-016…019, BR-42 — Luật khuyến nghị và đo hiệu quả
// API backend chờ Bảo viết (G-24, tuần 4 03–09/12); UI dùng dữ liệu mẫu cho đến khi backend sẵn.

export type RecommendationMetric =
  | 'return_rate'
  | 'health_status_good_rate'
  | 'humidity_in_range'
  | 'temp_in_range'

export type RecommendationActionType = 'WORK_ORDER' | 'PARAM_CHANGE'
export type RecommendationStatus = 'OPEN' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'MEASURED'

export interface RecommendationRule {
  _id?: string
  name: string
  metric: RecommendationMetric
  window_days: number         // 1–30 ngày
  threshold: number           // ngưỡng kích hoạt
  action_type: RecommendationActionType
  work_order_type?: string    // khi action_type = WORK_ORDER
  param_key?: string          // khi action_type = PARAM_CHANGE
  active: boolean
}

export interface RecommendationEffect {
  rule_id: string
  rule_name: string
  total_generated: number
  total_accepted: number
  total_improved: number      // khuyến nghị được đo và chỉ số cải thiện
}
