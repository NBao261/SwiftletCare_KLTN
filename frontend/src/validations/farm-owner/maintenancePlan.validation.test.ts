import { describe, expect, it } from 'vitest';
import { basesFor, filledChecklist, validateMaintenancePlan } from '@/validations/farm-owner/maintenancePlan.validation';

const draft = { interval: '500', checklist: ['Vệ sinh lưới lọc'], source: 'Hướng dẫn nhà sản xuất' };

describe('validateMaintenancePlan (OPS-FR-005)', () => {
  it('nhận kế hoạch hợp lệ', () => {
    expect(validateMaintenancePlan(draft)).toEqual({});
  });

  it('chặn chu kỳ trống, bằng 0, âm hoặc không phải số', () => {
    for (const interval of ['', '0', '-5', 'abc']) {
      expect(validateMaintenancePlan({ ...draft, interval }).interval).toBe('error.interval');
    }
  });

  it('checklist cần 1–30 mục có chữ, mục trống không tính', () => {
    expect(validateMaintenancePlan({ ...draft, checklist: ['  ', ''] }).checklist).toBe('error.checklistEmpty');
    expect(validateMaintenancePlan({ ...draft, checklist: Array.from({ length: 31 }, (_, index) => `Mục ${index}`) }).checklist)
      .toBe('error.checklistTooMany');
    expect(filledChecklist([' Quạt ', '', 'Cửa'])).toEqual(['Quạt', 'Cửa']);
  });

  it('bắt buộc nguồn của chu kỳ', () => {
    expect(validateMaintenancePlan({ ...draft, source: '   ' }).source).toBe('error.source');
  });
});

describe('basesFor', () => {
  it('bơm, quạt theo bộ đếm; việc khác theo lịch', () => {
    expect(basesFor('PUMP')).toEqual(['RUN_HOURS', 'SWITCHES']);
    expect(basesFor('FAN')).toEqual(['RUN_HOURS', 'SWITCHES']);
    expect(basesFor('NOZZLE')).toEqual(['CALENDAR']);
  });
});
