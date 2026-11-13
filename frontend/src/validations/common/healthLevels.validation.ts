import type { HealthLevels } from '@/types'

export type HealthLevelKey = keyof HealthLevels

// Khoảng hợp lệ BR-28 — khớp kiểm tra của backend (PUT /farms/houses/{houseId}/health-levels)
export const HEALTH_LEVEL_LIMITS: Record<HealthLevelKey, { min: number; max: number; integer: boolean }> = {
  in_range_slight_pct: { min: 50, max: 100, integer: false },
  in_range_clear_pct:  { min: 50, max: 100, integer: false },
  air_slight_h:        { min: 0.5, max: 12, integer: false },
  air_clear_h:         { min: 0.5, max: 12, integer: false },
  noise_slight:        { min: 1, max: 10, integer: true },
  noise_clear:         { min: 1, max: 10, integer: true },
}

// Mã lỗi để màn tự dịch
export type HealthLevelError = 'number' | 'range' | 'integer' | 'environmentOrder' | 'ascendingOrder'

// Cùng luật với backend: từng mức trong khoảng; môi trường càng thấp càng lệch nên mức rõ ≤ mức nhẹ, không khí và tiếng ồn ngược lại
export function validateHealthLevels(values: Record<HealthLevelKey, number>): Partial<Record<HealthLevelKey, HealthLevelError>> {
  const errors: Partial<Record<HealthLevelKey, HealthLevelError>> = {}
  for (const key of Object.keys(HEALTH_LEVEL_LIMITS) as HealthLevelKey[]) {
    const value = values[key]
    const { min, max, integer } = HEALTH_LEVEL_LIMITS[key]
    if (!Number.isFinite(value)) errors[key] = 'number'
    else if (value < min || value > max) errors[key] = 'range'
    else if (integer && !Number.isInteger(value)) errors[key] = 'integer'
  }
  if (!errors.in_range_slight_pct && !errors.in_range_clear_pct && values.in_range_clear_pct > values.in_range_slight_pct) {
    errors.in_range_clear_pct = 'environmentOrder'
  }
  if (!errors.air_slight_h && !errors.air_clear_h && values.air_clear_h < values.air_slight_h) errors.air_clear_h = 'ascendingOrder'
  if (!errors.noise_slight && !errors.noise_clear && values.noise_clear < values.noise_slight) errors.noise_clear = 'ascendingOrder'
  return errors
}
