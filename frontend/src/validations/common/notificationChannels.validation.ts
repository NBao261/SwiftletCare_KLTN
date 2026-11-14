// ALERT-FR-005 — kênh ngoài ứng dụng theo mức cảnh báo ở trang Cài đặt: 3 cấp giao diện ↔ by_severity 4 mức của backend
import { LEVELS, SEVERITY_TO_LEVEL } from '@/constants/severity';
import type { AlertSeverity, ChannelChoice, NotificationPreferences, SeverityLevel } from '@/types';

export interface LevelChannels {
  push: boolean;
  telegram: boolean;
}

const SEVERITIES = Object.keys(SEVERITY_TO_LEVEL) as AlertSeverity[];

// Kênh chung: push và Telegram mặc định bật như model User
function generalChannels(prefs: NotificationPreferences | undefined): LevelChannels {
  return { push: prefs?.push ?? true, telegram: prefs?.telegram ?? true };
}

// Kênh đang dùng của mỗi cấp; cấp Khẩn cấp đọc theo CRITICAL (mức đầu của cấp)
export function levelChannelsOf(prefs: NotificationPreferences | undefined): Record<SeverityLevel, LevelChannels> {
  const general = generalChannels(prefs);
  const result = {} as Record<SeverityLevel, LevelChannels>;
  for (const level of LEVELS) {
    const severity = SEVERITIES.find(item => SEVERITY_TO_LEVEL[item] === level)!;
    const choice = prefs?.by_severity?.[severity];
    result[level] = { push: choice?.push ?? general.push, telegram: choice?.telegram ?? general.telegram };
  }
  return result;
}

// by_severity gửi lên: mức giống cài đặt chung thì null (bỏ ghi đè), khác thì ghi đè cả 2 kênh
export function bySeverityPayload(
  levels: Record<SeverityLevel, LevelChannels>,
  general: LevelChannels,
): Record<AlertSeverity, ChannelChoice | null> {
  const result = {} as Record<AlertSeverity, ChannelChoice | null>;
  for (const severity of SEVERITIES) {
    const choice = levels[SEVERITY_TO_LEVEL[severity]];
    result[severity] = choice.push === general.push && choice.telegram === general.telegram ? null : { ...choice };
  }
  return result;
}

// Cấp Khẩn cấp phải còn ít nhất 1 kênh ngoài ứng dụng; Telegram chỉ tính khi đã liên kết bot
export function urgentHasOutsideChannel(urgent: LevelChannels, telegramLinked: boolean): boolean {
  return urgent.push || (telegramLinked && urgent.telegram);
}
