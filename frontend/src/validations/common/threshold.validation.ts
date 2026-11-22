import type { Thresholds } from '@/types'
import { THRESHOLD_KEYS } from '@/constants/thresholds'

// Khớp THRESHOLD_LIMITS của backend
export const THRESHOLD_LIMITS: Record<keyof Thresholds, { min: number; max: number; unit: string }> = {
  temp_min:     { min: -40, max: 125,     unit: '°C' },
  temp_max:     { min: -40, max: 125,     unit: '°C' },
  humidity_min: { min: 0,   max: 100,     unit: '%' },
  humidity_max: { min: 0,   max: 100,     unit: '%' },
  light_max:    { min: 0,   max: 200_000, unit: 'lux' },
  nh3_max:      { min: 0,   max: 500,     unit: 'ppm' },
  co2_max:      { min: 0,   max: 5000,    unit: 'ppm' },
}

// nguồn của ngưỡng mặc định phải nêu mã một mục REF-5 (`TL-xxx`, `MC-xxx`), như `REF5_ENTRY_PATTERN` backend
export const REF5_ENTRY_PATTERN = /\b(TL|MC)-\d{3}\b/
export const THRESHOLD_SOURCE_MAX_LENGTH = 500

export function validateThresholdSource(raw: string): string | undefined {
  const source = raw.trim()
  if (!source) return 'Cần ghi nguồn của ngưỡng'
  if (source.length > THRESHOLD_SOURCE_MAX_LENGTH) return `Nguồn tối đa ${THRESHOLD_SOURCE_MAX_LENGTH} ký tự`
  if (!REF5_ENTRY_PATTERN.test(source)) return 'Nguồn phải có mã mục REF-5, ví dụ TL-001 hoặc MC-002'
  return undefined
}

export function parseThresholdInput(raw: string): number {
  return raw.trim() === '' ? NaN : Number(raw)
}

// Cùng luật với assertValidThresholds của backend; rỗng = hợp lệ
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
