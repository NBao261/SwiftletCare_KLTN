import api from '@/lib/axios'
import type { ApiResponse, Thresholds } from '@/types'

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

/** ANALYTICS-FR-001..005, VISION-FR-008..011 */
export const analyticsApi = {
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
