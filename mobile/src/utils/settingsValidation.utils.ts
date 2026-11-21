import type { BirdCountTuning, Coordinates, DetectionTuning, FuzzyTuning, HealthLevels, Thresholds, WeatherMetric } from '@/types'
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

// Hệ số fuzzy dạng số; bộ lọc đầu vào là công tắc nên không nằm trong bảng số
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

// Số tầng của nhà: số nguyên 1–10 (Len chốt 10/11/2026; backend chưa kiểm số tầng — đề xuất cho Kiệt ở todo-review2 G-16)
export const HOUSE_FLOOR_RULE: NumberRule = { min: 1, max: 10, integer: true }

// Tầng của một khu vực: từ 1 tới số tầng của nhà; nhà cũ chưa có số tầng thì lấy mức trên của số tầng nhà
export function getZoneFloorRule(houseFloors: number | undefined): NumberRule {
  return { min: 1, max: houseFloors ?? HOUSE_FLOOR_RULE.max, integer: true }
}

// Độ dài tối đa của tên farm / nhà / khu vực (Len chốt 10/11/2026; backend chỉ bắt không rỗng — đề xuất cho Kiệt)
export const NAME_MAX_LENGTH = 50

// Tên để so trùng: bỏ khoảng trắng đầu cuối, gộp khoảng trắng giữa, không phân biệt hoa thường; dấu tiếng Việt vẫn giữ
// ("  nhà  A " = "Nhà a", còn "Nhà Á" khác "Nhà A")
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi')
}

// Câu lỗi của ô tên; hợp lệ thì null. existingNames: tên đang có cùng cấp (nhà trong farm, khu vực trong nhà) để chặn trùng
export function validateName(name: string, existingNames: readonly string[] = [], duplicateMessage = ''): string | null {
  const trimmed = name.trim()
  if (trimmed === '') return t('Không được để trống')
  if (trimmed.length > NAME_MAX_LENGTH) return t('Tối đa {max} ký tự', { max: NAME_MAX_LENGTH })
  if (existingNames.length === 0) return null
  const normalizedNames = new Set(existingNames.map(normalizeName))
  return normalizedNames.has(normalizeName(trimmed)) ? duplicateMessage : null
}

// Chữ người dùng gõ thành số: nhận cả dấu phẩy lẫn dấu chấm làm dấu thập phân (bàn phím số Android chỉ có dấu chấm), không
// nhận ngăn hàng nghìn
export function parseNumberInput(text: string): number | null {
  const normalized = text.trim().replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null
  return Number(normalized)
}

// Ô có giới hạn từ 1000 trở lên (vd. ánh sáng tối đa 200.000 lux) mới có thể bị gõ theo kiểu khung xem ghi số: tiếng Việt
// "1.500" là một nghìn năm trăm. Ô nhỏ hơn (toạ độ, hệ số) thì "10.762" luôn là số thập phân
const GROUPING_AMBIGUOUS_MIN = 1000

// Chữ trông như số có dấu ngăn nghìn của ngôn ngữ đang dùng ("1.500" khi tiếng Việt, "1,500" khi tiếng Anh)
function looksLikeThousandsGrouping(text: string): boolean {
  const pattern = getCurrentLanguage() === 'en' ? /^-?[1-9]\d{0,2},\d{3}$/ : /^-?[1-9]\d{0,2}\.\d{3}$/
  return pattern.test(text.trim())
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
  if (rule.max >= GROUPING_AMBIGUOUS_MIN && looksLikeThousandsGrouping(text)) return t('Nhập số không có dấu ngăn nghìn')
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

// Khoảng mức chỉ số sức khỏe của nhà (backend HEALTH_LEVEL_LIMITS, BR-28)
export const HEALTH_LEVEL_RULES: Record<keyof HealthLevels, NumberRule> = {
  in_range_slight_pct: { min: 50, max: 100 },
  in_range_clear_pct: { min: 50, max: 100 },
  air_slight_h: { min: 0.5, max: 12 },
  air_clear_h: { min: 0.5, max: 12 },
  noise_slight: { min: 1, max: 10, integer: true },
  noise_clear: { min: 1, max: 10, integer: true },
}

// Lỗi bản nháp mức chỉ số: từng ô trong khoảng, rồi mức "rõ" không được nhẹ hơn mức "nhẹ" (thời gian trong ngưỡng càng thấp càng
// nặng; giờ vượt ngưỡng, số đợt tiếng ồn càng cao càng nặng)
export function validateHealthLevelsDraft(draft: NumberDraft<keyof HealthLevels>): DraftErrors<keyof HealthLevels> {
  const errors = validateNumberDraft(draft, HEALTH_LEVEL_RULES)
  const valueOf = (key: keyof HealthLevels) => parseNumberInput(draft[key]) as number
  if (!errors.in_range_slight_pct && !errors.in_range_clear_pct && valueOf('in_range_clear_pct') > valueOf('in_range_slight_pct')) {
    errors.in_range_clear_pct = t('Không được lớn hơn mức nhẹ')
  }
  if (!errors.air_slight_h && !errors.air_clear_h && valueOf('air_clear_h') < valueOf('air_slight_h')) {
    errors.air_clear_h = t('Không được nhỏ hơn mức nhẹ')
  }
  if (!errors.noise_slight && !errors.noise_clear && valueOf('noise_clear') < valueOf('noise_slight')) {
    errors.noise_clear = t('Không được nhỏ hơn mức nhẹ')
  }
  return errors
}

// Luật bù thời tiết (backend weatherCompensation.util, BR-38): tối đa 10 luật; ngưỡng theo chỉ số; offset −10…+10 khác 0;
// thời hạn 1–120 phút
export const MAX_WEATHER_RULES = 10
export const WEATHER_METRIC_RULES: Record<WeatherMetric, NumberRule> = {
  temperature: { min: 0, max: 50 },
  humidity: { min: 0, max: 100 },
  rain: { min: 0.1, max: 50 },
}
export const WEATHER_OFFSET_RULE: NumberRule = { min: -10, max: 10 }
export const WEATHER_DURATION_RULE: NumberRule = { min: 1, max: 120, integer: true }

export interface WeatherRuleDraft {
  metric: WeatherMetric
  min: string
  offset: string
  duration: string
}

// Lỗi từng ô của một luật bù thời tiết đang nhập
export function validateWeatherRuleDraft(draft: WeatherRuleDraft): Partial<Record<'min' | 'offset' | 'duration', string>> {
  const errors: Partial<Record<'min' | 'offset' | 'duration', string>> = {}
  const minError = validateNumber(draft.min, WEATHER_METRIC_RULES[draft.metric])
  if (minError) errors.min = minError
  const offsetError = validateNumber(draft.offset, WEATHER_OFFSET_RULE)
  if (offsetError) errors.offset = offsetError
  else if (parseNumberInput(draft.offset) === 0) errors.offset = t('Phải khác 0')
  const durationError = validateNumber(draft.duration, WEATHER_DURATION_RULE)
  if (durationError) errors.duration = durationError
  return errors
}
