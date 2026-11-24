import type { AlertSeverity, AlertStatus, SeverityLevel } from '@/types';

// 4 cấp mức độ cảnh báo như: P1 Khẩn cấp, P2 Cao, P3 Trung bình, P4 Thấp (mỗi cấp một cách gửi)
export const LEVELS: SeverityLevel[] = ['P1', 'P2', 'P3', 'P4'];

// Mỗi mức backend là một cấp: CRITICAL tới cả chủ và thợ ngay và vượt giờ im lặng, HIGH tới thợ trước
export const SEVERITY_TO_LEVEL: Record<AlertSeverity, SeverityLevel> = {
  CRITICAL: 'P1',
  HIGH: 'P2',
  MEDIUM: 'P3',
  LOW: 'P4',
};

// Mức backend của 1 cấp, cho tham số severity của GET /alerts
export function severityQueryOf(level: SeverityLevel): AlertSeverity {
  return (Object.keys(SEVERITY_TO_LEVEL) as AlertSeverity[]).find(severity => SEVERITY_TO_LEVEL[severity] === level)!;
}

// Màu badge của 4 cấp
export const LEVEL_BADGE_CLASS: Record<SeverityLevel, string> = {
  P1: 'bg-alertRed text-white',
  P2: 'bg-safetyOrange text-white',
  P3: 'bg-orange-100 text-orange-800',
  P4: 'bg-warmGray/15 text-warmGray',
};

// Màu badge khi cảnh báo đã xử lý: xám trung tính, dùng lại màu cấp Thấp
export const LEVEL_BADGE_MUTED_CLASS = LEVEL_BADGE_CLASS.P4;

// Cảnh báo đã kết thúc (đã xử lý) thì badge mức độ về xám
export function isAlertFinished(status: AlertStatus): boolean {
  return status === 'RESOLVED';
}

// Cỡ badge mức độ
export const LEVEL_BADGE_SIZE = 'whitespace-nowrap px-2.5 py-0.5 text-small';
