import type { FuzzyTuning, Thresholds } from '@/types'

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

/** ENV-FR-021 — hệ số mờ gốc, PHẢI khớp backend `DEFAULT_FUZZY_TUNING` và firmware Config.h (DEFAULT_FUZZY_*) */
export const DEFAULT_FUZZY_TUNING: FuzzyTuning = {
  fuzzy_humidity_band: 8,
  fuzzy_temp_band: 4,
  fuzzy_fan_dry_level: 40,
  fuzzy_window_sec: 120,
}

/**
 * Nhãn + bước nhập cho form 7 ngưỡng. Hiện chỉ AdminSystemSettingsPage dùng; ThresholdsModal (Farm Owner,
 * cùng 7 trường và cùng khoảng đo ở backend) vẫn giữ bản riêng — nên chuyển sang dùng chung với
 * `validateThresholds`/`parseThresholdInput` để cũng hết lỗi `Number('')` → 0.
 */
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
