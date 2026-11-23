import { BadRequestError } from '@/utils/appError.util'
import { THRESHOLD_KEYS, THRESHOLD_LIMITS, toNumber } from '@/utils/thresholds.util'
import { FUZZY_TUNING_KEYS, FUZZY_TUNING_LIMITS } from '@/utils/fuzzyTuning.util'

export const RECOMMENDATION_EXPIRY_DAYS = 7
export const RECOMMENDATION_EFFECT_DAYS = 7
export const RULE_WORK_ORDER_TITLE_MAX = 200
export const RULE_WINDOW_MIN_DAYS = 1
export const RULE_WINDOW_MAX_DAYS = 30

export const RULE_INDICATORS = ['TIME_IN_RANGE', 'AIR_HOURS_OVER', 'RETURN_RATE', 'NOISE_EPISODES', 'MISTING_INEFFECTIVE'] as const
export type RuleIndicator = typeof RULE_INDICATORS[number]
export const RULE_COMPARISONS = ['GTE', 'LTE'] as const
export type RuleComparison = typeof RULE_COMPARISONS[number]

// Giới hạn vật lý chống nhập nhầm
export const RULE_VALUE_LIMITS: Record<RuleIndicator, { min: number; max: number; unit: string }> = {
  TIME_IN_RANGE:       { min: 0, max: 100, unit: '%' },
  AIR_HOURS_OVER:      { min: 0, max: 24, unit: 'giờ' },
  RETURN_RATE:         { min: 0, max: 200, unit: '%' },
  NOISE_EPISODES:      { min: 0, max: 1000, unit: 'đợt' },
  MISTING_INEFFECTIVE: { min: 0, max: 1000, unit: 'cảnh báo' },
}

// Work Order phòng ngừa không có ở đây: nó cần checklist của kế hoạch bảo trì
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
  // Không tự viết luật
  source: string
  active: boolean
}

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

// Sửa mà không gửi active thì giữ trạng thái cũ
export function parseRuleInput(input: Record<string, unknown>, currentActive = true): RuleInput {
  const indicator = input.indicator as RuleIndicator
  if (!RULE_INDICATORS.includes(indicator)) throw BadRequestError('Chỉ số không được hỗ trợ')
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
    // null, '' hay false thành NaN, không thành 0
    const value = toNumber(action.value)
    const limits: Record<string, { min: number; max: number }> | undefined =
      group === 'thresholds' ? THRESHOLD_LIMITS : group === 'fuzzy' ? FUZZY_TUNING_LIMITS : undefined
    const keys: readonly string[] = group === 'thresholds' ? THRESHOLD_KEYS : group === 'fuzzy' ? FUZZY_TUNING_KEYS : []
    if (!limits || !keys.includes(key)) throw BadRequestError('Thay đổi tham số cần group thresholds/fuzzy và một khoá có thật')
    if (!isNumber(value) || value < limits[key].min || value > limits[key].max) {
      throw BadRequestError(`${key} phải từ ${limits[key].min} đến ${limits[key].max}`)
    }
    if (key === 'fuzzy_window_sec' && !Number.isInteger(value)) throw BadRequestError('fuzzy_window_sec phải là số giây nguyên')
    return { type: 'PARAMETER_CHANGE', group: group as 'thresholds' | 'fuzzy', key, value }
  }
  throw BadRequestError('Hành động phải là WORK_ORDER hoặc PARAMETER_CHANGE')
}

export interface DayValue { date: string; value: number | null }

const meets = (value: number, comparison: RuleComparison, threshold: number) =>
  comparison === 'GTE' ? value >= threshold : value <= threshold

// Thiếu số của một ngày thì không thoả
export function ruleHolds(
  rule: Pick<RuleInput, 'comparison' | 'value' | 'window_days'>, days: DayValue[], date: string,
): DayValue[] | null {
  const window = lastDates(date, rule.window_days)
  const byDate = new Map(days.map(d => [d.date, d.value]))
  const evidence = window.map(d => ({ date: d, value: byDate.get(d) ?? null }))
  return evidence.every(d => d.value !== null && meets(d.value, rule.comparison, rule.value)) ? evidence : null
}

// Cũ trước
export function lastDates(date: string, count: number): string[] {
  const end = Date.parse(`${date}T00:00:00Z`)
  return Array.from({ length: count }, (_, i) => new Date(end - (count - 1 - i) * 86_400_000).toISOString().slice(0, 10))
}

const mean = (values: Array<number | null>) => {
  const nums = values.filter((v): v is number => v !== null)
  return nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100 : null
}

// Cải thiện khi đi ngược điều kiện (GTE: giảm, LTE: tăng); thiếu một bên thì null
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
