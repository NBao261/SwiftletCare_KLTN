import type { Thresholds } from '@/types'
import { THRESHOLD_KEYS } from '@/constants/thresholds'
import { t } from '@/i18n'

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

// Cặp ngưỡng tối thiểu và tối đa của một chỉ số: tối thiểu phải nhỏ hơn tối đa
const MIN_MAX_PAIRS: Array<{ min: keyof Thresholds; max: keyof Thresholds }> = [
  { min: 'temp_min', max: 'temp_max' },
  { min: 'humidity_min', max: 'humidity_max' },
]

// Ô này sai vì cặp tối thiểu, tối đa bị đảo (cả hai số đều hợp lệ): màn có thể báo ngay khi gõ, không cần đợi bấm Lưu
export function hasMinMaxOrderError(values: Record<keyof Thresholds, number>, key: keyof Thresholds): boolean {
  const pair = MIN_MAX_PAIRS.find(item => item.min === key || item.max === key)
  if (!pair) return false
  const errors = validateThresholds(values)
  const isOrderMessage = [pair.min, pair.max].every(pairKey => Number.isFinite(values[pairKey]) && values[pairKey] >= THRESHOLD_LIMITS[pairKey].min && values[pairKey] <= THRESHOLD_LIMITS[pairKey].max)
  return isOrderMessage && Boolean(errors[key])
}

// Cùng luật với assertValidThresholds của backend; rỗng = hợp lệ. Câu nào cũng nói số cần nhập; cặp tối thiểu, tối đa
// bị đảo thì báo ở cả hai ô, mỗi ô kèm số của ô kia để người dùng biết phải sửa ô nào tới đâu
export function validateThresholds(values: Record<keyof Thresholds, number>): Partial<Record<keyof Thresholds, string>> {
  const errors: Partial<Record<keyof Thresholds, string>> = {}
  for (const key of THRESHOLD_KEYS) {
    const v = values[key]
    const { min, max, unit } = THRESHOLD_LIMITS[key]
    if (!Number.isFinite(v)) errors[key] = t('Chưa nhập hoặc không phải số')
    else if (v < min || v > max) errors[key] = t('Nhập từ {{min}} đến {{max}} {{unit}}', { min, max, unit: t(unit) })
  }
  for (const pair of MIN_MAX_PAIRS) {
    if (errors[pair.min] || errors[pair.max] || values[pair.min] < values[pair.max]) continue
    const unit = t(THRESHOLD_LIMITS[pair.min].unit)
    errors[pair.min] = t('Phải nhỏ hơn mức tối đa ({{value}} {{unit}})', { value: values[pair.max], unit })
    errors[pair.max] = t('Phải lớn hơn mức tối thiểu ({{value}} {{unit}})', { value: values[pair.min], unit })
  }
  return errors
}
