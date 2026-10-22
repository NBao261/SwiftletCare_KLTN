import type { ExpertFuzzyTuning } from './tuning.types'

export interface MetricDataPoint {
  timestamp: string
  value: number
}

export interface MetricForecast {
  history: MetricDataPoint[]
  forecast: MetricDataPoint[]
  alpha: number
  beta: number
  mae30: number | null
  mae60: number | null
}

export interface PredictedBreach {
  metric: 'humidity' | 'temperature'
  direction: 'above' | 'below'
  limit: number
  value: number
  minutesAhead: number
}

export interface ForecastResponse {
  horizonMinutes: number
  bucketMinutes: number
  humidity: MetricForecast | null
  temperature: MetricForecast | null
  thresholds: Record<'humidity' | 'temperature', { min: number; max: number }>
  predicted: PredictedBreach | null
}

export interface ControlPerformanceSeriesItem {
  timestamp: string
  humidity: number
  temperature: number
  misting_pct: number
  ventilation_pct: number
}

export interface ControlPerformanceStats {
  sampleCount: number
  humidityInRangePct: number | null
  temperatureInRangePct: number | null
  mistingAvgPct: number | null
  ventilationAvgPct: number | null
  mistingSwitchesPerHour: number | null
  ventilationSwitchesPerHour: number | null
}

export interface ControlPerformanceResponse {
  range: string
  from: string
  to: string
  bucketMs: number
  thresholds: Record<string, number>
  fuzzy_tuning: ExpertFuzzyTuning
  tuning_changes: Array<{ changed_at: string; new_values: Partial<ExpertFuzzyTuning> }>
  series: ControlPerformanceSeriesItem[]
  stats: ControlPerformanceStats | null
  relay_usage?: Array<{
    device_id: string
    misting: { hours: number; switches: number }
    ventilation: { hours: number; switches: number }
  }>
}

export interface AutonomyResponse {
  range: string
  from: string
  to: string
  auto_mode_pct: number | null
  manual_minutes: number
  override_count: number
}

export interface BirdCountTrendRecord {
  date: string
  morning_exit: number
  evening_entry: number
  return_rate: number | null
}

export interface BirdCountTrendsResponse {
  days: number
  records: BirdCountTrendRecord[]
  avg_return_rate: number | null
  latest_return_rate: number | null
  drop_percent: number | null
  drop_threshold_pct: number
  is_significant_drop: boolean
}

export interface HarvestBatchItem {
  _id: string
  zone_id: string
  harvest_date: string
  total_nests?: number
  nest_count?: number
  total_weight_kg?: number
  weight_grams?: number
  nest_type?: string
  quality_grades?: {
    grade_1_pct: number
    grade_2_pct: number
    grade_3_pct: number
  }
  env_snapshot?: {
    avg_temperature?: number
    avg_humidity?: number
  }
  notes?: string
}

export interface ZoneComparisonMetrics {
  sampleCount: number
  humidity: number
  temperature: number
  anomalyCount?: number
}

export interface ZoneComparisonItem {
  zoneId: string
  zoneName: string
  metrics?: ZoneComparisonMetrics
}

export interface ZoneComparisonResponse {
  range: string
  from: string
  to: string
  zones: ZoneComparisonItem[]
}
