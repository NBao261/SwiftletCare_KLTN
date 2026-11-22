import { BadRequestError } from '@/utils/appError.util'
import { toNumber } from '@/utils/thresholds.util'
import type { FuzzyTuning } from '@/types'

// Mặc định và khoảng phải khớp firmware Config.h. Tách file vì houseZone.model import làm default
export const FUZZY_TUNING_KEYS = [
  'fuzzy_humidity_band', 'fuzzy_temp_band', 'fuzzy_fan_dry_level', 'fuzzy_window_sec',
] as const satisfies ReadonlyArray<keyof FuzzyTuning>
type NumericKey = typeof FUZZY_TUNING_KEYS[number]

export const DEFAULT_FUZZY_TUNING: FuzzyTuning = {
  fuzzy_humidity_band: 8,
  fuzzy_temp_band: 4,
  fuzzy_fan_dry_level: 40,
  fuzzy_window_sec: 120,
  fuzzy_input_filter: true,
}

export const FUZZY_TUNING_LIMITS: Record<NumericKey, { min: number; max: number; unit: string }> = {
  fuzzy_humidity_band: { min: 2,  max: 20,  unit: '%RH' },
  fuzzy_temp_band:     { min: 1,  max: 10,  unit: '°C' },
  fuzzy_fan_dry_level: { min: 0,  max: 100, unit: '%' },
  fuzzy_window_sec:    { min: 60, max: 600, unit: 'giây' },
}

// Chặn field lạ; số sai thành NaN để assert từ chối
export function pickFuzzyTuning(input: Record<string, unknown>): Partial<FuzzyTuning> {
  const picked: Partial<FuzzyTuning> = {}
  for (const key of FUZZY_TUNING_KEYS) {
    if (input[key] !== undefined) picked[key] = toNumber(input[key])
  }
  if (input.fuzzy_input_filter !== undefined) picked.fuzzy_input_filter = input.fuzzy_input_filter as boolean
  return picked
}

export function assertValidFuzzyTuning(t: FuzzyTuning): void {
  for (const key of FUZZY_TUNING_KEYS) {
    const { min, max, unit } = FUZZY_TUNING_LIMITS[key]
    if (!Number.isFinite(t[key])) throw BadRequestError(`${key} phải là một số hợp lệ`)
    if (t[key] < min || t[key] > max) throw BadRequestError(`${key} phải nằm trong khoảng ${min}–${max} ${unit}`)
  }
  if (!Number.isInteger(t.fuzzy_window_sec)) throw BadRequestError('fuzzy_window_sec phải là số giây nguyên')
  if (typeof t.fuzzy_input_filter !== 'boolean') throw BadRequestError('fuzzy_input_filter phải là true/false')
}
