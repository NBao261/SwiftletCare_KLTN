import { BadRequestError } from '@/utils/appError.util'
import { toNumber } from '@/utils/thresholds.util'
import type { DetectionTuning } from '@/types'

/**
 * EXPERT-FR-008 — sáu tham số phát hiện Domain Expert chỉnh theo Zone. Mặc định là
 * các hằng số dùng trước SRS v2.1.0; khoảng hợp lệ là giới hạn kỹ thuật (tránh nhập
 * nhầm làm tắt hẳn việc phát hiện), không phải khuyến nghị nuôi yến. Năm tham số đầu
 * chạy trên ESP32 — mặc định và khoảng phải khớp firmware `Config.h` / `Config::update()`
 * (nó kẹp lại lần nữa); `return_rate_drop_pct` do backend dùng.
 * Tách file riêng vì houseZone.model import mặc định ở đây làm default schema.
 */
export const FIRMWARE_DETECTION_KEYS = [
  'noise_margin_db', 'noise_min_sec', 'pump_dry_on_sec', 'pump_dry_min_rise_pct', 'speaker_drop_pct',
] as const satisfies ReadonlyArray<keyof DetectionTuning>

export const DETECTION_TUNING_KEYS = [
  ...FIRMWARE_DETECTION_KEYS, 'return_rate_drop_pct',
] as const satisfies ReadonlyArray<keyof DetectionTuning>

export const DEFAULT_DETECTION_TUNING: DetectionTuning = {
  noise_margin_db: 15,
  noise_min_sec: 10,
  pump_dry_on_sec: 300,
  pump_dry_min_rise_pct: 2,
  speaker_drop_pct: 70,
  return_rate_drop_pct: 20,
}

export const DETECTION_TUNING_LIMITS: Record<keyof DetectionTuning, { min: number; max: number; unit: string; integer?: boolean }> = {
  noise_margin_db:       { min: 5,   max: 30,  unit: 'dB' },
  noise_min_sec:         { min: 5,   max: 15,  unit: 'giây', integer: true },
  pump_dry_on_sec:       { min: 120, max: 900, unit: 'giây', integer: true },
  pump_dry_min_rise_pct: { min: 0.5, max: 10,  unit: '%RH' },
  speaker_drop_pct:      { min: 30,  max: 90,  unit: '%', integer: true },
  return_rate_drop_pct:  { min: 5,   max: 50,  unit: '%' },
}

/** Chỉ giữ các khoá tham số — chặn body chèn field lạ; số không hợp lệ thành NaN để assert từ chối */
export function pickDetectionTuning(input: Record<string, unknown>): Partial<DetectionTuning> {
  const picked: Partial<DetectionTuning> = {}
  for (const key of DETECTION_TUNING_KEYS) {
    if (input[key] !== undefined) picked[key] = toNumber(input[key])
  }
  return picked
}

export function assertValidDetectionTuning(t: DetectionTuning): void {
  for (const key of DETECTION_TUNING_KEYS) {
    const { min, max, unit, integer } = DETECTION_TUNING_LIMITS[key]
    if (!Number.isFinite(t[key])) throw BadRequestError(`${key} phải là một số hợp lệ`)
    if (t[key] < min || t[key] > max) throw BadRequestError(`${key} phải nằm trong khoảng ${min}–${max} ${unit}`)
    if (integer && !Number.isInteger(t[key])) throw BadRequestError(`${key} phải là số nguyên`)
  }
}

/** Zone tạo trước v2.1.0 chưa có `detection_tuning` (hoặc thiếu trường) → dùng mặc định */
export function resolveDetectionTuning(saved?: Partial<DetectionTuning> | null): DetectionTuning {
  const resolved = { ...DEFAULT_DETECTION_TUNING }
  for (const key of DETECTION_TUNING_KEYS) {
    const value = saved?.[key]
    if (typeof value === 'number' && Number.isFinite(value)) resolved[key] = value
  }
  return resolved
}

/** Phần gửi xuống ESP32 qua config/update — tên field = tên key MQTT */
export function firmwareDetectionConfig(t: DetectionTuning): Pick<DetectionTuning, typeof FIRMWARE_DETECTION_KEYS[number]> {
  return Object.fromEntries(FIRMWARE_DETECTION_KEYS.map(key => [key, t[key]])) as Pick<DetectionTuning, typeof FIRMWARE_DETECTION_KEYS[number]>
}
