import api from '@/lib/axios'
import type { ApiResponse, FuzzyTuning, Thresholds } from '@/types'

export type AnalyticsRange = '1h' | '6h' | '24h' | '7d' | '30d'

export interface EnvSummaryPoint {
  timestamp: string
  temperature?: number; humidity?: number; light_lux?: number
  nh3_ppm?: number; co2_ppm?: number; sound_db?: number
  anomalyCount: number; sampleCount: number
}

export interface EnvSummaryStats {
  temp_min?: number; temp_max?: number; temp_avg?: number
  humidity_min?: number; humidity_max?: number; humidity_avg?: number
  anomalyCount: number; total: number
}

export interface EnvSummaryResponse {
  range: AnalyticsRange; from: string; to: string; bucketMs: number
  series: EnvSummaryPoint[]
  stats: EnvSummaryStats | null
}

export interface EnvCompareZone {
  zoneId: string; zoneName: string; thresholds: Thresholds
  metrics: {
    temperature?: number; humidity?: number; light_lux?: number
    nh3_ppm?: number; co2_ppm?: number; anomalyCount: number; sampleCount: number
  } | null
}

export interface EnvCompareResponse {
  range: AnalyticsRange
  zones: EnvCompareZone[]
}

export interface BirdCountDailyRecord {
  date: string; morning_exit: number; evening_entry: number; return_rate: number | null
}

export interface BirdCountDailyResponse {
  from: string; to: string
  records: BirdCountDailyRecord[]
  note?: string
}

export interface BirdCountTrendsResponse {
  days: number
  records: BirdCountDailyRecord[]
  avg_return_rate: number | null
  latest_return_rate: number | null
  drop_percent: number | null
  is_significant_drop: boolean
}

export interface EnvBirdCorrelationPoint {
  date: string; avg_temperature: number; max_temperature: number
  avg_humidity: number; return_rate: number | null
}

export interface EnvBirdCorrelationResponse {
  days: number
  points: EnvBirdCorrelationPoint[]
  note?: string
}

/** ANALYTICS-FR-008 — hiệu quả bộ điều khiển mờ (chỉ mẫu từ firmware ≥ 1.1.0) */
export interface ControlPerformancePoint {
  timestamp: string
  humidity?: number | null; temperature?: number | null
  misting_pct?: number | null; ventilation_pct?: number | null
}

export interface ControlPerformanceStats {
  sampleCount: number
  humidityInRangePct: number | null; temperatureInRangePct: number | null
  mistingAvgPct: number | null; ventilationAvgPct: number | null
  /** null khi dữ liệu < 15 phút — chưa đủ để quy ra /giờ */
  mistingSwitchesPerHour: number | null; ventilationSwitchesPerHour: number | null
}

export interface ControlPerformanceResponse {
  range: AnalyticsRange; from: string; to: string; bucketMs: number
  thresholds: Pick<Thresholds, 'humidity_min' | 'humidity_max' | 'temp_min' | 'temp_max'>
  fuzzy_tuning: FuzzyTuning
  tuning_changes: Array<{ changed_at: string; new_values: Partial<FuzzyTuning> }>
  series: ControlPerformancePoint[]
  stats: ControlPerformanceStats | null
  /** TICKET-FR-018 — mốc bảo trì theo thời gian chạy + tiến độ từng thiết bị (từ lần bảo trì trước) */
  service_limits: Record<'misting' | 'ventilation', { hours: number; switches: number }>
  relay_usage: Array<{
    device_id: string
    misting: { hours: number; switches: number }
    ventilation: { hours: number; switches: number }
  }>
}

/** ANALYTICS-FR-009 — dự báo 60 phút tới (Holt trend tắt dần), sai số đánh giá lùi */
export interface MetricForecast {
  history: Array<{ timestamp: string; value: number }>
  forecast: Array<{ timestamp: string; value: number }>
  alpha: number; beta: number
  mae30: number | null; mae60: number | null
}

export interface ForecastResponse {
  horizonMinutes: number; bucketMinutes: number
  humidity: MetricForecast | null
  temperature: MetricForecast | null
  thresholds: Record<'humidity' | 'temperature', { min: number; max: number }>
  predicted: { metric: 'humidity' | 'temperature'; direction: 'above' | 'below'; limit: number; value: number; minutesAhead: number } | null
}

/** ANALYTICS-FR-001..005/008/009, VISION-FR-008..011 */
export const analyticsApi = {
  forecast: (zoneId: string) =>
    api.get<ApiResponse<ForecastResponse>>('/analytics/forecast', { params: { zoneId } }),
  controlPerformance: (zoneId: string, range: AnalyticsRange) =>
    api.get<ApiResponse<ControlPerformanceResponse>>('/analytics/control/performance', { params: { zoneId, range } }),
  envSummary: (zoneId: string, range: AnalyticsRange) =>
    api.get<ApiResponse<EnvSummaryResponse>>('/analytics/env/summary', { params: { zoneId, range } }),
  envCompare: (zoneIds: string[], range: AnalyticsRange) =>
    api.get<ApiResponse<EnvCompareResponse>>('/analytics/env/compare', { params: { zoneIds: zoneIds.join(','), range } }),
  birdCountDaily: (zoneId: string, params?: { from?: string; to?: string }) =>
    api.get<ApiResponse<BirdCountDailyResponse>>('/analytics/bird-count/daily', { params: { zoneId, ...params } }),
  birdCountTrends: (zoneId: string, days = 30) =>
    api.get<ApiResponse<BirdCountTrendsResponse>>('/analytics/bird-count/trends', { params: { zoneId, days } }),
  correlation: (zoneId: string, days = 30) =>
    api.get<ApiResponse<EnvBirdCorrelationResponse>>('/analytics/correlation', { params: { zoneId, days } }),
}
