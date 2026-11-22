import type { FuzzyNumericKey, RecommendationIndicator, RecommendationRule, RecommendationRuleInput, Thresholds } from '@/types';
import { FUZZY_TUNING_LIMITS } from '@/validations/common/fuzzyTuning.validation';
import { THRESHOLD_LIMITS } from '@/validations/common/threshold.validation';

// Khớp RULE_VALUE_LIMITS của backend
export const RULE_VALUE_LIMITS: Record<RecommendationIndicator, { min: number; max: number }> = {
  TIME_IN_RANGE: { min: 0, max: 100 },
  AIR_HOURS_OVER: { min: 0, max: 24 },
  RETURN_RATE: { min: 0, max: 200 },
  NOISE_EPISODES: { min: 0, max: 1000 },
  MISTING_INEFFECTIVE: { min: 0, max: 1000 },
};
export const RULE_WINDOW_MIN_DAYS = 1;
export const RULE_WINDOW_MAX_DAYS = 30;
export const RULE_NAME_MAX_LENGTH = 50;
export const RULE_SOURCE_MAX_LENGTH = 500;
// Tiêu đề Work Order của luật, như route /work-orders (RULE_WORK_ORDER_TITLE_MAX)
export const RULE_TITLE_MAX_LENGTH = 200;
// Lý do từ chối khuyến nghị (api-spec reject.reason)
export const REJECT_REASON_MAX_LENGTH = 1000;

// Giá trị nhập trên form (chuỗi để còn biết ô bỏ trống)
export interface RuleDraft {
  name: string;
  indicator: RecommendationIndicator;
  comparison: 'GTE' | 'LTE';
  value: string;
  window_days: string;
  actionType: 'WORK_ORDER' | 'PARAMETER_CHANGE';
  title: string;
  group: 'thresholds' | 'fuzzy';
  key: string;
  actionValue: string;
  source: string;
}

export type RuleDraftErrors = Partial<Record<'name' | 'value' | 'window_days' | 'title' | 'key' | 'actionValue' | 'source', 'required' | 'range' | 'tooLong'>>;

// Ô trống hoặc không phải số → NaN, để không lẫn với 0
const toNumber = (raw: string) => (raw.trim() === '' ? NaN : Number(raw));

const outOfRange = (value: number, limit: { min: number; max: number }) => !Number.isFinite(value) || value < limit.min || value > limit.max;

// Cùng luật với backend: trả lỗi theo ô (rỗng = hợp lệ)
export function validateRuleDraft(draft: RuleDraft): RuleDraftErrors {
  const errors: RuleDraftErrors = {};
  if (!draft.name.trim()) errors.name = 'required';
  else if (draft.name.trim().length > RULE_NAME_MAX_LENGTH) errors.name = 'tooLong';
  if (draft.value.trim() === '') errors.value = 'required';
  else if (outOfRange(toNumber(draft.value), RULE_VALUE_LIMITS[draft.indicator])) errors.value = 'range';
  const windowDays = toNumber(draft.window_days);
  if (draft.window_days.trim() === '') errors.window_days = 'required';
  else if (!Number.isInteger(windowDays) || windowDays < RULE_WINDOW_MIN_DAYS || windowDays > RULE_WINDOW_MAX_DAYS) errors.window_days = 'range';
  if (!draft.source.trim()) errors.source = 'required';
  else if (draft.source.trim().length > RULE_SOURCE_MAX_LENGTH) errors.source = 'tooLong';
  if (draft.actionType === 'WORK_ORDER' && !draft.title.trim()) errors.title = 'required';
  else if (draft.actionType === 'WORK_ORDER' && draft.title.trim().length > RULE_TITLE_MAX_LENGTH) errors.title = 'tooLong';
  if (draft.actionType === 'PARAMETER_CHANGE') {
    const limits: Record<string, { min: number; max: number }> = draft.group === 'thresholds' ? THRESHOLD_LIMITS : FUZZY_TUNING_LIMITS;
    if (!limits[draft.key]) errors.key = 'required';
    else if (draft.actionValue.trim() === '') errors.actionValue = 'required';
    else if (outOfRange(toNumber(draft.actionValue), limits[draft.key])) errors.actionValue = 'range';
    // Cửa sổ điều khiển là số giây nguyên, như assertValidFuzzyTuning
    else if (draft.key === 'fuzzy_window_sec' && !Number.isInteger(toNumber(draft.actionValue))) errors.actionValue = 'range';
  }
  return errors;
}

// Luật đang có → giá trị ô form
export function draftOfRule(rule: RecommendationRule): RuleDraft {
  const action = rule.action;
  return {
    name: rule.name,
    indicator: rule.indicator,
    comparison: rule.comparison,
    value: String(rule.value),
    window_days: String(rule.window_days),
    actionType: action.type,
    title: action.type === 'WORK_ORDER' ? action.title : '',
    group: action.type === 'PARAMETER_CHANGE' ? action.group : 'thresholds',
    key: action.type === 'PARAMETER_CHANGE' ? action.key : '',
    actionValue: action.type === 'PARAMETER_CHANGE' ? String(action.value) : '',
    source: rule.source,
  };
}

// Ô form đã kiểm → thân request (api-spec RecommendationRuleInput)
export function ruleInputOf(draft: RuleDraft, active: boolean): RecommendationRuleInput {
  const base = {
    name: draft.name.trim(), indicator: draft.indicator, comparison: draft.comparison, value: Number(draft.value),
    window_days: Number(draft.window_days), source: draft.source.trim(), active,
  };
  if (draft.actionType === 'WORK_ORDER') return { ...base, action: { type: 'WORK_ORDER', title: draft.title.trim() } };
  if (draft.group === 'thresholds') {
    return { ...base, action: { type: 'PARAMETER_CHANGE', group: 'thresholds', key: draft.key as keyof Thresholds, value: Number(draft.actionValue) } };
  }
  return { ...base, action: { type: 'PARAMETER_CHANGE', group: 'fuzzy', key: draft.key as FuzzyNumericKey, value: Number(draft.actionValue) } };
}

// Bật/tắt gửi lại cả luật (PUT thay toàn bộ) với `active` mới
export function toggledRuleInput(rule: RecommendationRule): RecommendationRuleInput {
  return ruleInputOf(draftOfRule(rule), !rule.active);
}
