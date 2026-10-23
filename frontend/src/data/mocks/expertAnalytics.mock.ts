/**
 * Mock Fallback — Màn hình 04_Analytics_Forecast_v3
 * ANALYTICS-FR-008/009/011, VISION-FR-009 | SRS v2.1.4
 */
import type {
  ForecastResponse,
  ControlPerformanceResponse,
  AutonomyResponse,
  BirdCountTrendsResponse,
  HarvestBatchItem,
} from '@/types/expert.types'
import { MOCK_EXPERT_FUZZY_TUNING } from './expertTuning.mock'

const nowMs = Date.now()
const BUCKET_5M = 5 * 60_000

// ── Holt forecast: 72 điểm lịch sử + 12 điểm dự báo ─────────────────────────
const histH = Array.from({ length: 72 }, (_, i) => ({
  timestamp: new Date(nowMs - (72 - i) * BUCKET_5M).toISOString(),
  value: Math.round((80 + Math.sin(i / 6) * 3 + (i % 3 === 0 ? 0.8 : -0.5)) * 10) / 10,
}))
const histT = Array.from({ length: 72 }, (_, i) => ({
  timestamp: new Date(nowMs - (72 - i) * BUCKET_5M).toISOString(),
  value: Math.round((28.5 + Math.cos(i / 8) * 0.8 + (i % 2 === 0 ? 0.2 : -0.1)) * 10) / 10,
}))
const fcH = Array.from({ length: 12 }, (_, i) => ({
  timestamp: new Date(nowMs + (i + 1) * BUCKET_5M).toISOString(),
  value: Math.round((histH[71].value + (i + 1) * 0.25 - (i > 6 ? 0.3 : 0)) * 10) / 10,
}))
const fcT = Array.from({ length: 12 }, (_, i) => ({
  timestamp: new Date(nowMs + (i + 1) * BUCKET_5M).toISOString(),
  value: Math.round((histT[71].value - (i + 1) * 0.05) * 10) / 10,
}))

export const MOCK_FORECAST_RESPONSE: ForecastResponse = {
  horizonMinutes: 60,
  bucketMinutes: 5,
  humidity: { history: histH, forecast: fcH, alpha: 0.35, beta: 0.12, mae30: 0.8, mae60: 1.4 },
  temperature: { history: histT, forecast: fcT, alpha: 0.28, beta: 0.09, mae30: 0.3, mae60: 0.5 },
  thresholds: { humidity: { min: 75.0, max: 85.0 }, temperature: { min: 27.0, max: 31.0 } },
  predicted: null,
}

export const MOCK_CONTROL_PERFORMANCE: ControlPerformanceResponse = {
  range: '24h',
  from: new Date(nowMs - 24 * 3600_000).toISOString(),
  to: new Date(nowMs).toISOString(),
  bucketMs: 15 * 60_000,
  thresholds: { humidity_min: 75, humidity_max: 85, temp_min: 27, temp_max: 31 },
  fuzzy_tuning: MOCK_EXPERT_FUZZY_TUNING,
  tuning_changes: [],
  series: Array.from({ length: 96 }, (_, i) => ({
    timestamp: new Date(nowMs - (96 - i) * 15 * 60_000).toISOString(),
    humidity: Math.round((80 + Math.sin(i / 5) * 4) * 10) / 10,
    temperature: Math.round((28.5 + Math.cos(i / 7) * 1) * 10) / 10,
    misting_pct: Math.round(25 + Math.sin(i / 4) * 15),
    ventilation_pct: Math.round(15 + Math.cos(i / 6) * 10),
  })),
  stats: {
    sampleCount: 8640,
    humidityInRangePct: 88.5,
    temperatureInRangePct: 93.2,
    mistingAvgPct: 28,
    ventilationAvgPct: 18,
    mistingSwitchesPerHour: 2.1,
    ventilationSwitchesPerHour: 1.4,
  },
}

export const MOCK_AUTONOMY: AutonomyResponse = {
  range: '24h',
  from: new Date(nowMs - 24 * 3600_000).toISOString(),
  to: new Date(nowMs).toISOString(),
  auto_mode_pct: 94.2,
  manual_minutes: 25,
  override_count: 2,
}

export const MOCK_BIRD_COUNT_TRENDS: BirdCountTrendsResponse = {
  days: 30,
  records: Array.from({ length: 30 }, (_, i) => {
    const exit = 2400 + Math.floor(Math.sin(i / 4) * 200) + (i % 2 === 0 ? 50 : -30)
    const entry = Math.floor(exit * (0.84 + Math.cos(i / 6) * 0.05))
    return {
      date: new Date(nowMs - (30 - i) * 86400_000).toISOString().slice(0, 10),
      morning_exit: exit,
      evening_entry: entry,
      return_rate: Math.round((entry / exit) * 1000) / 10,
    }
  }),
  avg_return_rate: 86.4,
  latest_return_rate: 88.1,
  drop_percent: 0,
  drop_threshold_pct: 20,
  is_significant_drop: false,
}

export const MOCK_HARVEST_BATCHES: HarvestBatchItem[] = [
  {
    _id: 'batch_001',
    zone_id: 'zone_demo_01',
    harvest_date: new Date(nowMs - 12 * 86400_000).toISOString(),
    total_nests: 450,
    total_weight_kg: 4.8,
    quality_grades: { grade_1_pct: 65, grade_2_pct: 25, grade_3_pct: 10 },
    notes: 'Tổ trắng, sợi dày, tỷ lệ lông ít.',
  },
  {
    _id: 'batch_002',
    zone_id: 'zone_demo_01',
    harvest_date: new Date(nowMs - 75 * 86400_000).toISOString(),
    total_nests: 420,
    total_weight_kg: 4.4,
    quality_grades: { grade_1_pct: 60, grade_2_pct: 30, grade_3_pct: 10 },
    notes: 'Thu hoạch đợt 2 mùa khô.',
  },
]
