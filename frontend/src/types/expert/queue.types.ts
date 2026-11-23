// Hàng đợi việc của chuyên gia: GET /expert-activity/queue
export type ExpertQueueKind =
  | 'alert_verdict' | 'parameter_review' | 'coefficient_proposal' | 'disagreeing_day' | 'report_conclusion'
  | 'weather_proposal' | 'profile_draft' | 'recommendation_rule' | 'season_conclusion'

export interface ExpertQueueItem {
  id: string
  title: string
  house_name: string | null
  // ISO, hoặc 'YYYY-MM-DD' với ngày lệch
  at: string
  // Chủ nhà yến đã nhắc chuyên gia
  reminded: boolean
}

export interface ExpertQueueGroup {
  kind: ExpertQueueKind
  total: number
  items: ExpertQueueItem[]
}

export interface ExpertQueue {
  farm_id: string
  groups: ExpertQueueGroup[]
}
