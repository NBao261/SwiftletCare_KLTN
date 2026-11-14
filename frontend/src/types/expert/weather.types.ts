/** ENV-FR-030, BR-38 — Luật bù phun sương theo thời tiết */
export type WeatherMetric = 'temperature' | 'humidity' | 'rain'

export interface WeatherRule {
  _id?: string
  metric: WeatherMetric
  min: number
  offset_pct: number
  duration_min: number
  active: boolean
}

export interface WeatherRulesResponse {
  house_id: string
  rules: WeatherRule[]
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
