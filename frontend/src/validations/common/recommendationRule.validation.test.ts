import { describe, expect, it } from 'vitest';
import { validateRuleDraft, type RuleDraft } from '@/validations/common/recommendationRule.validation';

const VALID: RuleDraft = {
  name: 'Tỷ lệ về thấp 3 ngày',
  indicator: 'RETURN_RATE',
  comparison: 'LTE',
  value: '80',
  window_days: '3',
  actionType: 'WORK_ORDER',
  title: 'Kiểm tra béc phun',
  group: 'thresholds',
  key: '',
  actionValue: '',
  source: 'Phỏng vấn chủ nhà yến 12/11/2026',
};

describe('validateRuleDraft', () => {
  it('nhận luật hợp lệ', () => {
    expect(validateRuleDraft(VALID)).toEqual({});
  });

  it('bắt buộc tên, nguồn và tiêu đề phiếu', () => {
    expect(validateRuleDraft({ ...VALID, name: ' ', source: '', title: '' })).toEqual({ name: 'required', source: 'required', title: 'required' });
  });

  it('giá trị theo khoảng của chỉ số, ô trống không thành 0', () => {
    expect(validateRuleDraft({ ...VALID, indicator: 'TIME_IN_RANGE', value: '120' }).value).toBe('range');
    expect(validateRuleDraft({ ...VALID, indicator: 'AIR_HOURS_OVER', value: '24' }).value).toBeUndefined();
    expect(validateRuleDraft({ ...VALID, value: '' }).value).toBe('required');
  });

  it('cửa sổ là số ngày nguyên 1–30', () => {
    expect(validateRuleDraft({ ...VALID, window_days: '0' }).window_days).toBe('range');
    expect(validateRuleDraft({ ...VALID, window_days: '31' }).window_days).toBe('range');
    expect(validateRuleDraft({ ...VALID, window_days: '2.5' }).window_days).toBe('range');
    expect(validateRuleDraft({ ...VALID, window_days: '30' }).window_days).toBeUndefined();
  });

  it('đổi tham số cần khoá có thật và giá trị trong khoảng của khoá', () => {
    const change = { ...VALID, actionType: 'PARAMETER_CHANGE' as const, title: '' };
    expect(validateRuleDraft({ ...change, key: '' }).key).toBe('required');
    expect(validateRuleDraft({ ...change, group: 'thresholds', key: 'humidity_min', actionValue: '101' }).actionValue).toBe('range');
    expect(validateRuleDraft({ ...change, group: 'fuzzy', key: 'fuzzy_window_sec', actionValue: '30' }).actionValue).toBe('range');
    expect(validateRuleDraft({ ...change, group: 'fuzzy', key: 'fuzzy_window_sec', actionValue: '120' })).toEqual({});
    expect(validateRuleDraft({ ...change, group: 'fuzzy', key: 'fuzzy_window_sec', actionValue: '120.5' }).actionValue).toBe('range');
  });

  it('tiêu đề phiếu tối đa 200 ký tự, như backend', () => {
    expect(validateRuleDraft({ ...VALID, title: 'x'.repeat(201) }).title).toBe('tooLong');
    expect(validateRuleDraft({ ...VALID, title: 'x'.repeat(200) }).title).toBeUndefined();
  });
});
