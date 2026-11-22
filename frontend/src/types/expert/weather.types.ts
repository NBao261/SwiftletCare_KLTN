// Luật bù phun sương theo thời tiết
export type WeatherMetric = 'temperature' | 'humidity' | 'rain'

export interface WeatherRule {
  _id?: string
  metric: WeatherMetric
  min: number
  offset_pct: number
  duration_min: number
  active: boolean
}

// bộ luật Farm Owner gửi trên farm có chuyên gia, chỉ chạy khi chuyên gia duyệt
export interface WeatherRulesProposal {
  rules: WeatherRule[]
  proposed_by: string
  proposed_at: string
}

export interface WeatherRulesResponse {
  house_id: string
  rules: WeatherRule[]
  proposal: WeatherRulesProposal | null
  last_compensation: {
    rule_id: string
    offset_pct: number
    sent_at: string
    expires_at: string
    forecast: {
      temperature_max: number | null
      humidity_max: number | null
      rain_mm: number | null
    }
  } | null
}
