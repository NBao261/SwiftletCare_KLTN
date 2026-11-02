import type { Role } from '@/types'

export interface ExpertThresholds {
  temp_min: number
  temp_max: number
  humidity_min: number
  humidity_max: number
  light_max: number
  nh3_max: number
  co2_max: number
}

export interface ThresholdHistoryEntry {
  changed_by: { _id: string; full_name?: string } | string
  changed_by_role?: Role
  changed_at: string
  old_values: Partial<ExpertThresholds>
  new_values: Partial<ExpertThresholds>
  source: 'MANUAL' | 'RESET_TO_DEFAULT'
}

export interface ExpertFuzzyTuning {
  fuzzy_humidity_band: number
  fuzzy_temp_band: number
  fuzzy_fan_dry_level: number
  fuzzy_window_sec: number
  fuzzy_input_filter: boolean
}

export interface FuzzyTuningHistoryEntry {
  changed_by: { _id: string; full_name?: string } | string
  changed_by_role?: Role
  changed_at: string
  old_values: Partial<ExpertFuzzyTuning>
  new_values: Partial<ExpertFuzzyTuning>
}

export interface ExpertDetectionTuning {
  noise_margin_db: number
  noise_min_sec: number
  pump_dry_on_sec: number
  pump_dry_min_rise_pct: number
  speaker_drop_pct: number
  return_rate_drop_pct: number
}

export interface DetectionTuningHistoryEntry {
  changed_by: { _id: string; full_name?: string } | string
  changed_by_role?: Role
  changed_at: string
  old_values: Partial<ExpertDetectionTuning>
  new_values: Partial<ExpertDetectionTuning>
}

export interface FuzzySuggestionResponse {
  current: ExpertFuzzyTuning
  model: { r2: number; samples: number; days: number } | null
  predicted?: {
    inRangeNow: number
    inRangeSuggested: number
    mistingNow: number
    mistingSuggested: number
  }
  suggestion: Partial<ExpertFuzzyTuning> | null
  reason: string | null
}

/** VISION-FR-018 — Tọa độ vùng đếm chim (polygon) lưu dạng chuẩn hoá [0..1] */
export interface CountingRingPoint {
  x: number
  y: number
}

export interface CountingRingCoordinates {
  /** Mảng điểm polygon chuẩn hoá [0..1] theo chiều rộng/cao của khung hình */
  points: CountingRingPoint[]
}
