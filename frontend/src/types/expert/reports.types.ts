export interface ZoneHealthMetrics {
  sample_count: number
  temp_in_range_pct: number | null
  humidity_in_range_pct: number | null
  auto_mode_pct: number | null
  misting_switches: number
  ventilation_switches: number
  alerts_by_type: Record<string, number>
  avg_return_rate: number | null
  nh3_avg: number | null
  nh3_max: number | null
  co2_avg: number | null
  co2_max: number | null
}

export interface ZoneHealthReportItem {
  _id: string
  farm_id: string
  zone_id: string
  period_start: string
  period_end: string
  metrics: ZoneHealthMetrics
  generated_at: string
  expert_conclusion?: {
    text: string
    by: { _id: string; full_name: string } | string
    at: string
  }
}
