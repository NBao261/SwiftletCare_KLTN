/**
 * Mock Fallback — Màn hình 03_Zone_Tuning_v3
 * EXPERT-FR-004/008 | SRS v2.1.4
 */
import type {
  ExpertThresholds,
  ExpertFuzzyTuning,
  ExpertDetectionTuning,
  FuzzySuggestionResponse,
} from '@/types/expert.types'

export const MOCK_EXPERT_THRESHOLDS: ExpertThresholds = {
  temp_min: 27.0,
  temp_max: 31.0,
  humidity_min: 75.0,
  humidity_max: 85.0,
  light_max: 0.2,
  nh3_max: 5.0,
  co2_max: 600.0,
}

export const MOCK_EXPERT_FUZZY_TUNING: ExpertFuzzyTuning = {
  fuzzy_humidity_band: 5.0,
  fuzzy_temp_band: 1.5,
  fuzzy_fan_dry_level: 40,
  fuzzy_window_sec: 60,
  fuzzy_input_filter: true,
}

export const MOCK_EXPERT_DETECTION_TUNING: ExpertDetectionTuning = {
  noise_margin_db: 15,
  noise_min_sec: 10,
  pump_dry_on_sec: 300,
  pump_dry_min_rise_pct: 2.0,
  speaker_drop_pct: 70,
  return_rate_drop_pct: 20,
}

export const MOCK_FUZZY_SUGGESTION: FuzzySuggestionResponse = {
  current: MOCK_EXPERT_FUZZY_TUNING,
  model: { r2: 0.88, samples: 2016, days: 14.0 },
  predicted: {
    inRangeNow: 84.5,
    inRangeSuggested: 92.1,
    mistingNow: 32,
    mistingSuggested: 26,
  },
  suggestion: {
    fuzzy_humidity_band: 4.5,
    fuzzy_temp_band: 1.2,
    fuzzy_fan_dry_level: 35,
  },
  reason: null,
}
