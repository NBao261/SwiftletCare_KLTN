import type { TicketStatus } from '@/types';
import type { TicketDisplayStatus } from '@/constants/enumLabels.i18n';

// Thứ tự 4 trạng thái ticket theo luồng xử lý (Flow 9/9b), khớp backend
export const TICKET_STATUS_ORDER: TicketStatus[] = ['NEW', 'IN_PROGRESS', 'AWAITING_FIELD_CONFIRMATION', 'CLOSED'];

// Trạng thái hiển thị: ticket huỷ vẫn là CLOSED ở backend nhưng có cancelled_at
export function ticketDisplayStatus(ticket: { status: TicketStatus; cancelled_at?: string }): TicketDisplayStatus {
  if (ticket.cancelled_at) return 'CANCELLED';
  return ticket.status;
}

// Màu badge trạng thái ticket — cùng bảng màu trạng thái Dashboard Farm Owner (FE_Design 2.6.1)
export const TICKET_STATUS_BADGE_CLASS: Record<TicketDisplayStatus, string> = {
  NEW: 'bg-infoBlue/10 text-infoBlue',
  IN_PROGRESS: 'bg-limeMist text-charcoal',
  AWAITING_FIELD_CONFIRMATION: 'bg-statusYellow/70 text-charcoal',
  CLOSED: 'bg-warmGray/15 text-warmGray',
  CANCELLED: 'bg-warmGray/15 text-warmGray',
};

// Cỡ badge trạng thái
export const TICKET_STATUS_BADGE_SIZE = 'whitespace-nowrap px-2.5 py-0.5 text-[11px] font-medium';

// Một bước trên thanh tiến độ: key để tìm bước hiện tại, label đã dịch để hiển thị
export interface ProgressStep {
  key: string;
  label: string;
}

// Bước riêng một trang muốn chèn thêm, đặt ngay sau bước có key afterKey
export interface ExtraProgressStep {
  afterKey: string;
  step: ProgressStep;
}

// Thanh tiến độ ticket: 4 bước trạng thái + bước riêng của trang (nếu có), 1 lần duyệt O(n + m)
export function buildTicketProgressSteps(
  statusLabels: Record<TicketStatus, string>,
  extraSteps: ExtraProgressStep[] = [],
): ProgressStep[] {
  const extraByAfterKey = new Map<string, ProgressStep[]>();
  for (const extra of extraSteps) {
    const list = extraByAfterKey.get(extra.afterKey) ?? [];
    list.push(extra.step);
    extraByAfterKey.set(extra.afterKey, list);
  }

  const steps: ProgressStep[] = [];
  for (const status of TICKET_STATUS_ORDER) {
    steps.push({ key: status, label: statusLabels[status] });
    steps.push(...(extraByAfterKey.get(status) ?? []));
  }
  return steps;
}

// Vị trí bước hiện tại theo key; không tìm thấy thì về bước đầu
export function findStepIndex(steps: ProgressStep[], key: string): number {
  const index = steps.findIndex(step => step.key === key);
  if (index < 0) return 0;
  return index;
}
