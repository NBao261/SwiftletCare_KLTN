import type { AlertSeverity, AlertStatus, TicketPriority } from '@/types';

// 3 cấp mức độ dùng chung cho cảnh báo và ticket: P1 Khẩn cấp, P2 Cao, P3 Thường
export const LEVELS: TicketPriority[] = ['P1', 'P2', 'P3'];

// Backend gửi 4 mức cảnh báo, giao diện gộp CRITICAL và HIGH vào P1
export const SEVERITY_TO_LEVEL: Record<AlertSeverity, TicketPriority> = {
  CRITICAL: 'P1',
  HIGH: 'P1',
  MEDIUM: 'P2',
  LOW: 'P3',
};

// Màu badge của 3 cấp
export const LEVEL_BADGE_CLASS: Record<TicketPriority, string> = {
  P1: 'bg-safetyOrange text-white',
  P2: 'bg-orange-100 text-orange-800',
  P3: 'bg-warmGray/15 text-warmGray',
};

// Màu badge khi việc đã kết thúc (ticket đóng/huỷ): xám trung tính, dùng lại màu cấp Thường
export const LEVEL_BADGE_MUTED_CLASS = LEVEL_BADGE_CLASS.P3;

// Cảnh báo đã kết thúc (đã xử lý) thì badge mức độ về xám
export function isAlertFinished(status: AlertStatus): boolean {
  return status === 'RESOLVED';
}

// Cỡ badge mức độ
export const LEVEL_BADGE_SIZE = 'whitespace-nowrap px-2.5 py-0.5 text-[11px]';
