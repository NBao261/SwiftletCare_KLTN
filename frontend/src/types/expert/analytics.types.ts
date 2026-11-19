// ENV-FR-019, ANALYTICS-FR — tỷ lệ thời gian tự động của 1 zone (GET /analytics/autonomy)
export interface AutonomyResponse {
  range: string
  from: string
  to: string
  auto_mode_pct: number | null
  manual_minutes: number
  override_count: number
}
