// Test kênh theo mức cảnh báo ở trang Cài đặt (ALERT-FR-005)
import { describe, expect, it } from 'vitest';
import {
  applyGeneralPush, bySeverityPayload, levelChannelsOf, urgentHasOutsideChannel,
} from '@/validations/common/notificationChannels.validation';
import type { NotificationPreferences } from '@/types';

const quiet = { start: '22:00', end: '06:00' };

describe('levelChannelsOf', () => {
  it('mức không ghi đè thì theo cài đặt chung; Khẩn cấp đọc theo CRITICAL', () => {
    const prefs: NotificationPreferences = {
      push: true, telegram: false, quiet_hours: quiet,
      by_severity: { CRITICAL: { telegram: true }, LOW: { push: false } },
    };
    expect(levelChannelsOf(prefs)).toEqual({
      P1: { push: true, telegram: true },
      P2: { push: true, telegram: false },
      P3: { push: false, telegram: false },
    });
  });

  it('chưa có cài đặt: push và Telegram đều bật', () => {
    expect(levelChannelsOf(undefined).P2).toEqual({ push: true, telegram: true });
  });
});

describe('bySeverityPayload', () => {
  it('giống cài đặt chung thì null, khác thì ghi đè; Khẩn cấp ghi cho cả CRITICAL và HIGH', () => {
    const general = { push: true, telegram: true };
    const payload = bySeverityPayload({
      P1: { push: true, telegram: true },
      P2: { push: false, telegram: true },
      P3: { push: false, telegram: false },
    }, general);
    expect(payload).toEqual({
      CRITICAL: null,
      HIGH: null,
      MEDIUM: { push: false, telegram: true },
      LOW: { push: false, telegram: false },
    });
  });
});

describe('urgentHasOutsideChannel', () => {
  it('cần push, hoặc Telegram đã liên kết', () => {
    expect(urgentHasOutsideChannel({ push: true, telegram: false }, false)).toBe(true);
    expect(urgentHasOutsideChannel({ push: false, telegram: true }, true)).toBe(true);
    expect(urgentHasOutsideChannel({ push: false, telegram: true }, false)).toBe(false);
    expect(urgentHasOutsideChannel({ push: false, telegram: false }, true)).toBe(false);
  });
});

describe('applyGeneralPush', () => {
  it('tắt Push chung rồi lưu: mọi cấp tắt push, không còn ghi đè nào', () => {
    const prefs: NotificationPreferences = { push: true, telegram: true, quiet_hours: quiet };
    const general = { push: false, telegram: true };
    const levels = applyGeneralPush(levelChannelsOf(prefs), general.push);
    expect(levels.P1).toEqual({ push: false, telegram: true });
    expect(bySeverityPayload(levels, general)).toEqual({ CRITICAL: null, HIGH: null, MEDIUM: null, LOW: null });
  });

  it('giữ Telegram riêng của từng cấp', () => {
    const prefs: NotificationPreferences = { push: false, telegram: true, quiet_hours: quiet, by_severity: { LOW: { telegram: false } } };
    expect(applyGeneralPush(levelChannelsOf(prefs), true).P3).toEqual({ push: true, telegram: false });
  });
});
