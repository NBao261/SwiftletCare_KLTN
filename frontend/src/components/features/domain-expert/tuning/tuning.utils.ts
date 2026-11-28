import type { ExpertDetectionTuning } from '@/types/expert.types'

// 5 tham số phát hiện của Zone gửi xuống bộ điều khiển: backend trả 400 với khoá khác
export const DETECTION_TUNING_KEYS: Array<keyof ExpertDetectionTuning> = [
  'noise_margin_db', 'noise_min_sec', 'pump_dry_on_sec', 'pump_dry_min_rise_pct', 'speaker_drop_pct',
]

// Payload PUT /farms/zones/:zoneId/detection-tuning: chỉ các khoá của Zone, bỏ mọi trường khác của form
export function detectionTuningPayload(form: Partial<ExpertDetectionTuning>): Partial<ExpertDetectionTuning> {
  const payload: Partial<ExpertDetectionTuning> = {}
  for (const key of DETECTION_TUNING_KEYS) {
    const value = form[key]
    if (typeof value === 'number') payload[key] = value
  }
  return payload
}
