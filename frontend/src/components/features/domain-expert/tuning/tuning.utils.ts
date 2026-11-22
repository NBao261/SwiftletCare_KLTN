import type { ExpertDetectionTuning } from '@/types/expert.types'

// DE-04: thanh lưu dính đáy chung, mỗi khối tự validate và gọi đúng API của mình qua ref
export interface TuningBlockHandle {
  save: () => void
  cancel: () => void
}

// 5 tham số phát hiện của Zone gửi xuống bộ điều khiển — backend trả 400 với khoá khác (EXPERT-FR-008)
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
