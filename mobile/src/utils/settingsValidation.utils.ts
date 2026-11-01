import type { BirdCountTuning, Coordinates, DetectionTuning, FuzzyTuning, Thresholds } from '@/types'
import { formatDecimal } from '@/utils/number.utils'
import { getCurrentLanguage, t } from '@/utils/i18n.utils'

// Khoảng hợp lệ của một ô số; integer: chỉ nhận số nguyên
export interface NumberRule {
  min: number
  max: number
  integer?: boolean
}

// Bản nháp của một mục đang sửa: mỗi ô giữ nguyên chữ người dùng gõ
export type NumberDraft<K extends string> = Record<K, string>
export type DraftErrors<K extends string> = Partial<Record<K, string>>

// Hệ số mờ dạng số; bộ lọc đầu vào là công tắc nên không nằm trong bảng số
export type FuzzyNumberKey = Exclude<keyof FuzzyTuning, 'fuzzy_input_filter'>

// Khoảng đo của từng cảm biến, khớp THRESHOLD_LIMITS trong backend/src/utils/thresholds.util.ts
export const THRESHOLD_RULES: Record<keyof Thresholds, NumberRule> = {
  temp_min: { min: -40, max: 125 },
  temp_max: { min: -40, max: 125 },
  humidity_min: { min: 0, max: 100 },
  humidity_max: { min: 0, max: 100 },
  light_max: { min: 0, max: 200_000 },
  nh3_max: { min: 0, max: 500 },
  co2_max: { min: 0, max: 5000 },
}

// Cặp ngưỡng thấp – cao phải thấp < cao (backend trả 400 nếu sai)
const THRESHOLD_PAIRS: [keyof Thresholds, keyof Thresholds][] = [
  ['temp_min', 'temp_max'],
  ['humidity_min', 'humidity_max'],
]

// Khoảng của schema FuzzyTuning trong api-spec (ENV-FR-021)
export const FUZZY_TUNING_RULES: Record<FuzzyNumberKey, NumberRule> = {
  fuzzy_humidity_band: { min: 2, max: 20 },
  fuzzy_temp_band: { min: 1, max: 10 },
  fuzzy_fan_dry_level: { min: 0, max: 100 },
  fuzzy_window_sec: { min: 60, max: 600, integer: true },
}

// Khoảng của schema DetectionTuning trong api-spec (EXPERT-FR-008) — giới hạn kỹ thuật, không phải khuyến nghị nuôi yến
export const DETECTION_TUNING_RULES: Record<keyof DetectionTuning, NumberRule> = {
  noise_margin_db: { min: 5, max: 30 },
  noise_min_sec: { min: 5, max: 15, integer: true },
  pump_dry_on_sec: { min: 120, max: 900, integer: true },
  pump_dry_min_rise_pct: { min: 0.5, max: 10 },
  speaker_drop_pct: { min: 30, max: 90, integer: true },
}

// Khoảng của schema BirdCountTuning trong api-spec (EXPERT-FR-008)
export const BIRD_COUNT_TUNING_RULES: Record<keyof BirdCountTuning, NumberRule> = {
  return_rate_drop_pct: { min: 5, max: 50 },
}

// Khoảng của schema Coordinates trong api-spec (FARM-FR-001)
export const COORDINATE_RULES: Record<keyof Coordinates, NumberRule> = {
  lat: { min: -90, max: 90 },
  lng: { min: -180, max: 180 },
}

// Số tầng của nhà, tầng của zone: số nguyên từ 1 (model backend mặc định 1)
export const FLOOR_RULE: NumberRule = { min: 1, max: Number.MAX_SAFE_INTEGER, integer: true }

// Chữ người dùng gõ thành số: nhận cả dấu phẩy lẫn dấu chấm làm dấu thập phân, không nhận ngăn hàng nghìn
export function parseNumberInput(text: string): number | null {
  const normalized = text.trim().replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null
  return Number(normalized)
}

// Số đang lưu thành chữ trong ô nhập, dấu thập phân theo ngôn ngữ; chưa có thì ô trống
export function toInputText(value: number | undefined): string {
  if (value === undefined) return ''
  const text = String(value)
  return getCurrentLanguage() === 'en' ? text : text.replace('.', ',')
}

// Câu lỗi của một ô số; hợp lệ thì null
export function validateNumber(text: string, rule: NumberRule): string | null {
  const value = parseNumberInput(text)
  if (value === null) return t('Nhập một số')
  if (rule.integer && !Number.isInteger(value)) return t('Nhập số nguyên')
  if (value < rule.min || value > rule.max) {
    return rule.max === Number.MAX_SAFE_INTEGER
      ? t('Từ {min} trở lên', { min: formatDecimal(rule.min) })
      : t('Từ {min} đến {max}', { min: formatRuleLimit(rule.min), max: formatRuleLimit(rule.max) })
  }
  return null
}

// Mốc khoảng hợp lệ: số nguyên không phần lẻ, số lẻ giữ 1 chữ số
function formatRuleLimit(value: number): string {
  return formatDecimal(value, Number.isInteger(value) ? 0 : 1)
}

// Khoảng hợp lệ để ghi cạnh ô: "2–20"
export function formatRuleRange(rule: NumberRule): string {
  return `${formatRuleLimit(rule.min)}–${formatRuleLimit(rule.max)}`
}

// Lỗi của từng ô trong bản nháp theo luật của ô đó
export function validateNumberDraft<K extends string>(
  draft: NumberDraft<K>,
  rules: Record<K, NumberRule>,
): DraftErrors<K> {
  const errors: DraftErrors<K> = {}
  for (const key of Object.keys(rules) as K[]) {
    const error = validateNumber(draft[key], rules[key])
    if (error) errors[key] = error
  }
  return errors
}

// Lỗi bản nháp ngưỡng: từng ô trong khoảng đo, rồi mức thấp phải nhỏ hơn mức cao
export function validateThresholdDraft(draft: NumberDraft<keyof Thresholds>): DraftErrors<keyof Thresholds> {
  const errors = validateNumberDraft(draft, THRESHOLD_RULES)
  for (const [minKey, maxKey] of THRESHOLD_PAIRS) {
    if (errors[minKey] || errors[maxKey]) continue
    const minValue = parseNumberInput(draft[minKey]) as number
    const maxValue = parseNumberInput(draft[maxKey]) as number
    if (minValue >= maxValue) errors[maxKey] = t('Phải lớn hơn mức thấp')
  }
  return errors
}

// Bản nháp đã hợp lệ thành số để gửi backend
export function parseNumberDraft<K extends string>(draft: NumberDraft<K>, keys: readonly K[]): Record<K, number> {
  const values = {} as Record<K, number>
  for (const key of keys) values[key] = parseNumberInput(draft[key]) as number
  return values
}

// Bản nháp có ô nào khác giá trị gốc không (so theo số, "26" và "26,0" coi là bằng)
export function isNumberDraftChanged<K extends string>(
  draft: NumberDraft<K>,
  original: Partial<Record<K, number>>,
  keys: readonly K[],
): boolean {
  return keys.some(key => parseNumberInput(draft[key]) !== (original[key] ?? null))
}

// Có lỗi nào trong bản nháp không
export function hasDraftErrors<K extends string>(errors: DraftErrors<K>): boolean {
  return Object.values(errors).some(Boolean)
}

// Số đang lưu để xem, giữ đúng phần lẻ backend trả (tối đa 3 chữ số): 0,2 lux không thành 0; 1500 thành "1.500"
export function formatStoredNumber(value: number): string {
  const decimals = Math.min(3, (String(value).split('.')[1] ?? '').length)
  return formatDecimal(value, decimals)
}
