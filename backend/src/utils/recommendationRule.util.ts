import { BadRequestError } from '@/utils/appError.util'
import { THRESHOLD_KEYS, THRESHOLD_LIMITS, toNumber } from '@/utils/thresholds.util'
import { FUZZY_TUNING_KEYS, FUZZY_TUNING_LIMITS } from '@/utils/fuzzyTuning.util'

/**
 * EXPERT-FR-016…019, BR-42 — phần thuần của luật khuyến nghị: kiểm luật, xét luật thoả trên các ngày của
 * nhà, tính hiệu quả. Không DB, để test riêng.
 */

/** BR-42 — khuyến nghị mở quá 7 ngày thì EXPIRED; hiệu quả đo 7 ngày trước và 7 ngày sau khi chấp nhận (A-4) */
export const RECOMMENDATION_EXPIRY_DAYS = 7
export const RECOMMENDATION_EFFECT_DAYS = 7
/** Report 3 §4.5 — tiêu đề Work Order tối đa 200 ký tự, như route `/work-orders` */
export const RULE_WORK_ORDER_TITLE_MAX = 200
/** EXPERT-FR-016 — cửa sổ của luật */
export const RULE_WINDOW_MIN_DAYS = 1
export const RULE_WINDOW_MAX_DAYS = 30

/**
 * EXPERT-FR-016 — chỉ số của nhà theo từng ngày (giờ VN):
 * - TIME_IN_RANGE: % thời gian trong ngưỡng (zone thấp nhất, đánh giá ngày ANALYTICS-FR-012);
 * - AIR_HOURS_OVER: số giờ NH3 hoặc CO2 vượt ngưỡng (zone cao nhất);
 * - RETURN_RATE: tỷ lệ chim về (%);
 * - NOISE_EPISODES: số đợt ồn bất thường;
 * - MISTING_INEFFECTIVE: số cảnh báo phun sương không hiệu quả mở trong ngày.
 */
export const RULE_INDICATORS = ['TIME_IN_RANGE', 'AIR_HOURS_OVER', 'RETURN_RATE', 'NOISE_EPISODES', 'MISTING_INEFFECTIVE'] as const
export type RuleIndicator = typeof RULE_INDICATORS[number]
/** Điều kiện của một ngày: chỉ số ≥ value (GTE) hoặc ≤ value (LTE) */
export const RULE_COMPARISONS = ['GTE', 'LTE'] as const
export type RuleComparison = typeof RULE_COMPARISONS[number]

/** Khoảng nhập của `value` theo chỉ số: giới hạn vật lý chống nhập nhầm, không phải khuyến nghị nuôi yến */
export const RULE_VALUE_LIMITS: Record<RuleIndicator, { min: number; max: number; unit: string }> = {
  TIME_IN_RANGE:       { min: 0, max: 100, unit: '%' },
  AIR_HOURS_OVER:      { min: 0, max: 24, unit: 'giờ' },
  RETURN_RATE:         { min: 0, max: 200, unit: '%' },
  NOISE_EPISODES:      { min: 0, max: 1000, unit: 'đợt' },
  MISTING_INEFFECTIVE: { min: 0, max: 1000, unit: 'cảnh báo' },
}

/**
 * EXPERT-FR-016, 018 — hành động khuyến nghị: một Work Order sửa chữa (MF-02), hoặc một thay đổi ngưỡng / hệ số mờ
 * của các zone trong nhà, đi theo MF-05 (Farm Owner sửa, chuyên gia duyệt lại). Work Order phòng ngừa không có ở đây:
 * nó sinh từ kế hoạch bảo trì (MF-07) và cần checklist của kế hoạch.
 */
export type RuleAction =
  | { type: 'WORK_ORDER'; title: string }
  | { type: 'PARAMETER_CHANGE'; group: 'thresholds' | 'fuzzy'; key: string; value: number }

export interface RuleInput {
  name: string
  indicator: RuleIndicator
  comparison: RuleComparison
  value: number
  window_days: number
  action: RuleAction
  /** Nguồn của luật (phỏng vấn, tài liệu): không tự viết luật (todo-final-scope §G-24) */
  source: string
  active: boolean
}

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/**
 * EXPERT-FR-016 — 400 khi chỉ số không hỗ trợ, cửa sổ ngoài 1–30 ngày, giá trị ngoài khoảng hoặc hành động sai.
 * `currentActive`: khi sửa luật mà không gửi `active` thì giữ trạng thái cũ, không tự bật lại luật đang tắt.
 */
export function parseRuleInput(input: Record<string, unknown>, currentActive = true): RuleInput {
  const indicator = input.indicator as RuleIndicator
  if (!RULE_INDICATORS.includes(indicator)) throw BadRequestError('Chỉ số không được hỗ trợ (EXPERT-FR-016)')
  const comparison = input.comparison as RuleComparison
  if (!RULE_COMPARISONS.includes(comparison)) throw BadRequestError('comparison phải là GTE hoặc LTE')
  const value = toNumber(input.value)
  const limit = RULE_VALUE_LIMITS[indicator]
  if (!isNumber(value) || value < limit.min || value > limit.max) {
    throw BadRequestError(`value phải từ ${limit.min} đến ${limit.max} ${limit.unit}`)
  }
  const windowDays = Number(input.window_days)
  if (!Number.isInteger(windowDays) || windowDays < RULE_WINDOW_MIN_DAYS || windowDays > RULE_WINDOW_MAX_DAYS) {
    throw BadRequestError(`window_days phải là số ngày nguyên từ ${RULE_WINDOW_MIN_DAYS} đến ${RULE_WINDOW_MAX_DAYS}`)
  }
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  if (!name) throw BadRequestError('Luật cần có tên')
  const source = typeof input.source === 'string' ? input.source.trim() : ''
  if (!source) throw BadRequestError('Luật cần ghi nguồn (phỏng vấn, tài liệu)')
  return {
    name, indicator, comparison, value, window_days: windowDays, action: parseAction(input.action), source,
    active: typeof input.active === 'boolean' ? input.active : currentActive,
  }
}

function parseAction(raw: unknown): RuleAction {
  const action = (raw ?? {}) as Record<string, unknown>
  if (action.type === 'WORK_ORDER') {
    const title = typeof action.title === 'string' ? action.title.trim() : ''
    if (!title) throw BadRequestError('Hành động Work Order cần tiêu đề')
    if (title.length > RULE_WORK_ORDER_TITLE_MAX) throw BadRequestError(`Tiêu đề Work Order tối đa ${RULE_WORK_ORDER_TITLE_MAX} ký tự`)
    return { type: 'WORK_ORDER', title }
  }
  if (action.type === 'PARAMETER_CHANGE') {
    const group = action.group
    const key = String(action.key ?? '')
    // toNumber: null, '' hay false thành NaN, không thành 0 (một ngưỡng 0 sẽ được áp cho mọi zone)
    const value = toNumber(action.value)
    const limits: Record<string, { min: number; max: number }> | undefined =
      group === 'thresholds' ? THRESHOLD_LIMITS : group === 'fuzzy' ? FUZZY_TUNING_LIMITS : undefined
    const keys: readonly string[] = group === 'thresholds' ? THRESHOLD_KEYS : group === 'fuzzy' ? FUZZY_TUNING_KEYS : []
    if (!limits || !keys.includes(key)) throw BadRequestError('Thay đổi tham số cần group thresholds/fuzzy và một khoá có thật')
    if (!isNumber(value) || value < limits[key].min || value > limits[key].max) {
      throw BadRequestError(`${key} phải từ ${limits[key].min} đến ${limits[key].max}`)
    }
    // Cùng luật với assertValidFuzzyTuning: cửa sổ điều khiển là số giây nguyên
    if (key === 'fuzzy_window_sec' && !Number.isInteger(value)) throw BadRequestError('fuzzy_window_sec phải là số giây nguyên')
    return { type: 'PARAMETER_CHANGE', group: group as 'thresholds' | 'fuzzy', key, value }
  }
  throw BadRequestError('Hành động phải là WORK_ORDER hoặc PARAMETER_CHANGE')
}

export interface DayValue { date: string; value: number | null }

const meets = (value: number, comparison: RuleComparison, threshold: number) =>
  comparison === 'GTE' ? value >= threshold : value <= threshold

/**
 * EXPERT-FR-017 — luật thoả khi mỗi ngày trong `window_days` ngày gần nhất (kết thúc ở `date`) đều có giá trị và đạt
 * điều kiện. Thiếu số của một ngày thì không thoả: không khuyến nghị trên dữ liệu không đủ. Trả các ngày làm bằng chứng.
 */
export function ruleHolds(
  rule: Pick<RuleInput, 'comparison' | 'value' | 'window_days'>, days: DayValue[], date: string,
): DayValue[] | null {
  const window = lastDates(date, rule.window_days)
  const byDate = new Map(days.map(d => [d.date, d.value]))
  const evidence = window.map(d => ({ date: d, value: byDate.get(d) ?? null }))
  return evidence.every(d => d.value !== null && meets(d.value, rule.comparison, rule.value)) ? evidence : null
}

/** `count` ngày 'YYYY-MM-DD' kết thúc ở `date`, cũ trước */
export function lastDates(date: string, count: number): string[] {
  const end = Date.parse(`${date}T00:00:00Z`)
  return Array.from({ length: count }, (_, i) => new Date(end - (count - 1 - i) * 86_400_000).toISOString().slice(0, 10))
}

const mean = (values: Array<number | null>) => {
  const nums = values.filter((v): v is number => v !== null)
  return nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100 : null
}

/**
 * EXPERT-FR-019, BR-42 — hiệu quả: trung bình chỉ số 7 ngày sau ngày chấp nhận trừ 7 ngày trước đó. Cải thiện khi
 * chỉ số đi ngược điều kiện của luật (luật GTE: giảm; luật LTE: tăng). Thiếu số một bên thì không kết luận được (null).
 */
export function measureEffect(comparison: RuleComparison, acceptedDate: string, days: DayValue[]) {
  const byDate = new Map(days.map(d => [d.date, d.value]))
  const beforeDates = lastDates(dayOffset(acceptedDate, -1), RECOMMENDATION_EFFECT_DAYS)
  const afterDates = lastDates(dayOffset(acceptedDate, RECOMMENDATION_EFFECT_DAYS), RECOMMENDATION_EFFECT_DAYS)
  const before = mean(beforeDates.map(d => byDate.get(d) ?? null))
  const after = mean(afterDates.map(d => byDate.get(d) ?? null))
  const change = before !== null && after !== null ? Math.round((after - before) * 100) / 100 : null
  const improved = change === null ? null : comparison === 'GTE' ? change < 0 : change > 0
  return { before, after, change, improved }
}

export const dayOffset = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
