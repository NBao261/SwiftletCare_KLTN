import type { FuzzyNumericKey } from '@/types'

/** Khoảng hợp lệ của 4 hệ số mờ — khớp `FUZZY_TUNING_LIMITS` backend và phần kẹp trong firmware `Config::update()` */
export const FUZZY_TUNING_LIMITS: Record<FuzzyNumericKey, { min: number; max: number; unit: string }> = {
  fuzzy_humidity_band: { min: 2,  max: 20,  unit: '%RH' },
  fuzzy_temp_band:     { min: 1,  max: 10,  unit: '°C' },
  fuzzy_fan_dry_level: { min: 0,  max: 100, unit: '%' },
  fuzzy_window_sec:    { min: 60, max: 600, unit: 'giây' },
}

/** Cùng luật với `assertValidFuzzyTuning` backend. Trả map lỗi theo field (rỗng = hợp lệ). */
export function validateFuzzyTuning(values: Record<FuzzyNumericKey, number>): Partial<Record<FuzzyNumericKey, string>> {
  const errors: Partial<Record<FuzzyNumericKey, string>> = {}
  for (const key of Object.keys(FUZZY_TUNING_LIMITS) as FuzzyNumericKey[]) {
    const v = values[key]
    const { min, max, unit } = FUZZY_TUNING_LIMITS[key]
    if (!Number.isFinite(v)) errors[key] = 'Chưa nhập hoặc không phải số'
    else if (v < min || v > max) errors[key] = `Phải trong khoảng ${min}–${max} ${unit}`
  }
  if (!errors.fuzzy_window_sec && !Number.isInteger(values.fuzzy_window_sec)) {
    errors.fuzzy_window_sec = 'Phải là số giây nguyên'
  }
  return errors
}
