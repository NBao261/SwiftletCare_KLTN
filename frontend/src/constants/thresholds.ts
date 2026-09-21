import type { Thresholds } from '@/types'

export const THRESHOLD_KEYS = [
  'temp_min', 'temp_max', 'humidity_min', 'humidity_max', 'light_max', 'nh3_max', 'co2_max',
] as const satisfies ReadonlyArray<keyof Thresholds>

/**
 * Giá trị gốc kỹ thuật (ENV-FR-007) — PHẢI khớp backend/src/utils/thresholds.util.ts
 * `DEFAULT_THRESHOLDS` và firmware Config.h. Backend không có endpoint "reset",
 * nên "Khôi phục mặc định gốc" = PUT /system/settings/default-thresholds với
 * đúng 7 giá trị này.
 */
export const FACTORY_DEFAULT_THRESHOLDS: Thresholds = {
  temp_min: 26,
  temp_max: 31,
  humidity_min: 75,
  humidity_max: 95,
  light_max: 0.2,
  nh3_max: 25,
  co2_max: 1500,
}

/**
 * Khoảng đo của cảm biến thật (SRS §7.1) — khớp `THRESHOLD_LIMITS` backend, dùng
 * để validate trước khi gửi (backend vẫn kiểm lại và trả 400 nếu lệch).
 */
export const THRESHOLD_LIMITS: Record<keyof Thresholds, { min: number; max: number; unit: string }> = {
  temp_min:     { min: -40, max: 125,     unit: '°C' },
  temp_max:     { min: -40, max: 125,     unit: '°C' },
  humidity_min: { min: 0,   max: 100,     unit: '%' },
  humidity_max: { min: 0,   max: 100,     unit: '%' },
  light_max:    { min: 0,   max: 200_000, unit: 'lux' },
  nh3_max:      { min: 0,   max: 500,     unit: 'ppm' },
  co2_max:      { min: 0,   max: 5000,    unit: 'ppm' },
}

/** Nhãn + bước nhập cho form 7 ngưỡng (SystemSettingsPage, ThresholdsModal) */
export const THRESHOLD_FIELDS: Array<{ key: keyof Thresholds; label: string; step: string }> = [
  { key: 'temp_min',     label: 'Nhiệt độ min (°C)',   step: '0.1' },
  { key: 'temp_max',     label: 'Nhiệt độ max (°C)',   step: '0.1' },
  { key: 'humidity_min', label: 'Độ ẩm min (%)',       step: '0.1' },
  { key: 'humidity_max', label: 'Độ ẩm max (%)',       step: '0.1' },
  { key: 'light_max',    label: 'Ánh sáng max (lux)',  step: '0.01' },
  { key: 'nh3_max',      label: 'NH3 max (ppm)',       step: '1' },
  { key: 'co2_max',      label: 'CO2 max (ppm)',       step: '1' },
]

/** Chuỗi rỗng/khoảng trắng → NaN thay vì 0 như `Number('')` — lý do có hàm này */
export function parseThresholdInput(raw: string): number {
  return raw.trim() === '' ? NaN : Number(raw)
}

/**
 * Validate form ngưỡng phía client — cùng luật với `assertValidThresholds` backend:
 * đủ 7 số hợp lệ, min < max, không âm, nằm trong khoảng đo cảm biến. Trả map
 * lỗi theo field (rỗng = hợp lệ).
 */
export function validateThresholds(values: Record<keyof Thresholds, number>): Partial<Record<keyof Thresholds, string>> {
  const errors: Partial<Record<keyof Thresholds, string>> = {}
  for (const key of THRESHOLD_KEYS) {
    const v = values[key]
    const { min, max, unit } = THRESHOLD_LIMITS[key]
    if (!Number.isFinite(v)) errors[key] = 'Chưa nhập hoặc không phải số'
    else if (v < min || v > max) errors[key] = `Phải trong khoảng ${min}–${max} ${unit} (khoảng đo cảm biến)`
  }
  if (!errors.temp_min && !errors.temp_max && values.temp_min >= values.temp_max) {
    errors.temp_max = 'Nhiệt độ max phải lớn hơn nhiệt độ min'
  }
  if (!errors.humidity_min && !errors.humidity_max && values.humidity_min >= values.humidity_max) {
    errors.humidity_max = 'Độ ẩm max phải lớn hơn độ ẩm min'
  }
  return errors
}
