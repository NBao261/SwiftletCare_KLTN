import type { BirdCountDay } from './birdCount.types'
import type { FuzzyTuning } from './farm.types'

// Khoảng thời gian của các API phân tích môi trường, điều khiển (ANALYTICS-FR-001)
export type AnalyticsRange = '1h' | '6h' | '24h' | '7d' | '30d'

// GET /analytics/bird-count/daily — ngày không có dữ liệu thì không có dòng
export interface BirdCountDailyResult {
  house_id: string
  from: string
  to: string
  records: BirdCountDay[]
  note?: string
}

// Một khung 5 phút của cả nhà (VISION-FR-017) — khung không có chim thì backend không trả
export interface BirdCountBucket {
  bucket_start: string
  entry_count: number
  exit_count: number
}

// GET /analytics/bird-count/buckets — tối đa 7 ngày mỗi lần
export interface BirdCountBucketsResult {
  house_id: string
  from: string
  to: string
  buckets: BirdCountBucket[]
}

// Một ngày ghép môi trường của zone với tỉ lệ về tổ của nhà (ANALYTICS-FR-003)
export interface CorrelationPoint {
  date: string
  avg_temperature: number | null
  max_temperature: number | null
  avg_humidity: number | null
  return_rate: number | null
}

// GET /analytics/correlation — chỉ các điểm, hệ số do app tính
export interface CorrelationResult {
  days: number
  points: CorrelationPoint[]
  note?: string
}

// Một điểm trung bình của GET /analytics/env/summary (tối đa khoảng 120 điểm; khung không có mẫu thì không có điểm)
export interface EnvSeriesPoint {
  timestamp: string
  temperature: number | null
  humidity: number | null
  light_lux: number | null
  nh3_ppm: number | null
  co2_ppm: number | null
  sound_db: number | null
  anomalyCount: number
  sampleCount: number
}

export interface EnvSummaryResult {
  range: AnalyticsRange
  from: string
  to: string
  bucketMs: number
  series: EnvSeriesPoint[]
}

// Một điểm của GET /analytics/control/performance: độ ẩm, nhiệt và công suất phun sương, quạt (%)
export interface ControlSeriesPoint {
  timestamp: string
  humidity: number | null
  temperature: number | null
  misting_pct: number | null
  ventilation_pct: number | null
}

// Số tổng của cả khoảng (ANALYTICS-FR-008); số lần đóng ngắt/giờ null khi chưa đủ 15 phút dữ liệu
export interface ControlStats {
  sampleCount: number
  humidityInRangePct: number | null
  temperatureInRangePct: number | null
  mistingAvgPct: number | null
  ventilationAvgPct: number | null
  mistingSwitchesPerHour: number | null
  ventilationSwitchesPerHour: number | null
}

// Một lần đổi hệ số trong khoảng: chỉ các khoá đã đổi, không có người đổi
export interface TuningChange {
  changed_at: string
  new_values: Partial<FuzzyTuning>
}

export interface ControlPerformanceResult {
  range: AnalyticsRange
  from: string
  to: string
  bucketMs: number
  thresholds: { humidity_min: number; humidity_max: number; temp_min: number; temp_max: number }
  fuzzy_tuning: FuzzyTuning
  tuning_changes: TuningChange[]
  series: ControlSeriesPoint[]
  stats: ControlStats | null
}

// GET /analytics/autonomy — % thời gian mọi relay ở AUTO (ANALYTICS-FR-011)
export interface AutonomyResult {
  range: AnalyticsRange
  from: string
  to: string
  auto_mode_pct: number | null
  manual_minutes: number
  override_count: number
}

export interface ForecastPoint {
  timestamp: string
  value: number
}

// Dự báo 60 phút của một chỉ số (ANALYTICS-FR-009): 6 giờ đã qua, 12 điểm 5 phút tới, sai số kiểm lại 30/60 phút
export interface MetricForecast {
  history: ForecastPoint[]
  forecast: ForecastPoint[]
  alpha: number
  beta: number
  mae30: number | null
  mae60: number | null
}

// GET /analytics/forecast — chỉ số null khi chưa đủ 2 giờ dữ liệu hoặc số cuối quá cũ
export interface ForecastResult {
  horizonMinutes: number
  bucketMinutes: number
  humidity: MetricForecast | null
  temperature: MetricForecast | null
}

// Ba hệ số được gợi ý (ANALYTICS-FR-010)
export type SuggestedTuning = Pick<FuzzyTuning, 'fuzzy_humidity_band' | 'fuzzy_temp_band' | 'fuzzy_fan_dry_level'>

// GET /analytics/control/suggestion — chỉ đọc; suggestion null thì reason nói lý do
export interface ControlSuggestion {
  current: FuzzyTuning
  model: { r2: number; samples: number; days: number } | null
  suggestion: SuggestedTuning | null
  reason: string | null
  predicted?: { inRangeNow: number; inRangeSuggested: number; mistingNow: number; mistingSuggested: number }
}
