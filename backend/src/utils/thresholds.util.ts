import { BadRequestError } from '@/utils/appError.util'
import type { Thresholds } from '@/types'

export const THRESHOLD_KEYS = [
  'temp_min', 'temp_max', 'humidity_min', 'humidity_max', 'light_max', 'nh3_max', 'co2_max',
] as const satisfies ReadonlyArray<keyof Thresholds>

/** Phải khớp firmware Config.h; default của Zone.thresholds lấy từ đây */
export const DEFAULT_THRESHOLDS: Thresholds = {
  temp_min: 26.0,
  temp_max: 31.0,
  humidity_min: 75.0,
  humidity_max: 95.0,
  light_max: 0.2,
  nh3_max: 25,
  co2_max: 1500,
}

/** Khoảng đo của cảm biến: ngoài khoảng thì không bao giờ (hoặc luôn) kích hoạt */
export const THRESHOLD_LIMITS: Record<keyof Thresholds, { min: number; max: number; unit: string }> = {
  temp_min:     { min: -40, max: 125,     unit: '°C' },
  temp_max:     { min: -40, max: 125,     unit: '°C' },
  humidity_min: { min: 0,   max: 100,     unit: '%' },
  humidity_max: { min: 0,   max: 100,     unit: '%' },
  light_max:    { min: 0,   max: 200_000, unit: 'lux' },
  nh3_max:      { min: 0,   max: 500,     unit: 'ppm' },
  co2_max:      { min: 0,   max: 5000,    unit: 'ppm' },
}

/** Number() cho null/''/[]/false thành 0; so 2 chuỗi số theo chữ cái */
export function toNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim() !== '') return Number(value)
  return NaN
}

export function assertValidThresholds(t: Thresholds): void {
  const n = {} as Record<keyof Thresholds, number>
  for (const key of THRESHOLD_KEYS) {
    n[key] = toNumber(t[key])
    if (!Number.isFinite(n[key])) throw BadRequestError(`${key} phải là một số hợp lệ`)
  }

  if (n.temp_min >= n.temp_max) throw BadRequestError('temp_min phải nhỏ hơn temp_max')
  if (n.humidity_min >= n.humidity_max) throw BadRequestError('humidity_min phải nhỏ hơn humidity_max')
  if (n.light_max < 0 || n.nh3_max < 0 || n.co2_max < 0) {
    throw BadRequestError('light_max/nh3_max/co2_max không được âm')
  }
  for (const key of THRESHOLD_KEYS) {
    const { min, max, unit } = THRESHOLD_LIMITS[key]
    if (n[key] < min || n[key] > max) {
      throw BadRequestError(`${key} phải nằm trong khoảng ${min}–${max} ${unit} (khoảng đo của cảm biến)`)
    }
  }
}

/** Định dạng mã của REF-5, không phải hằng số tự chọn */
export const REF5_ENTRY_PATTERN = /\b(TL|MC)-\d{3}\b/
export const SOURCE_MAX_LENGTH = 500

/** Chặn field lạ; số sai thành NaN */
export function pickThresholds(input: Record<string, unknown>): Partial<Thresholds> {
  const picked: Partial<Thresholds> = {}
  for (const key of THRESHOLD_KEYS) {
    if (input[key] !== undefined) picked[key] = toNumber(input[key])
  }
  return picked
}
