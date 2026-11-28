import { describe, expect, it } from 'vitest';
import { isUnexpectedReset, resetReasonKey } from '@/components/features/farm-owner/devices/resetReason';

describe('lý do khởi động lại của bộ điều khiển', () => {
  it('chưa có lý do thì không hiện gì', () => {
    expect(resetReasonKey(undefined)).toBeUndefined();
    expect(isUnexpectedReset(undefined)).toBe(false);
  });

  it('ba kiểu treo gộp một nhãn, mã lạ ra "không rõ"', () => {
    expect(resetReasonKey('INT_WDT')).toBe('reset.WDT');
    expect(resetReasonKey('TASK_WDT')).toBe('reset.WDT');
    expect(resetReasonKey('WDT')).toBe('reset.WDT');
    expect(resetReasonKey('ABC')).toBe('reset.unknown');
  });

  it('treo, lỗi phần mềm và sụt áp là khởi động lại ngoài ý muốn; cấp nguồn và lệnh thì không', () => {
    for (const reason of ['PANIC', 'WDT', 'TASK_WDT', 'INT_WDT', 'BROWNOUT']) expect(isUnexpectedReset(reason)).toBe(true);
    for (const reason of ['POWERON', 'SW', 'EXT', 'DEEPSLEEP']) expect(isUnexpectedReset(reason)).toBe(false);
  });
});
