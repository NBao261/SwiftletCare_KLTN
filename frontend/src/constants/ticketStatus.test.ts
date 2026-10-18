import { describe, expect, it } from 'vitest';
import { buildTicketProgressSteps, findStepIndex, ticketDisplayStatus } from '@/constants/ticketStatus';
import { ticketStatusDict } from '@/constants/enumLabels.i18n';

describe('buildTicketProgressSteps', () => {
  it('dựng 4 bước theo thứ tự trạng thái', () => {
    const steps = buildTicketProgressSteps(ticketStatusDict.vi);
    expect(steps.map(step => step.key)).toEqual(['NEW', 'IN_PROGRESS', 'AWAITING_FIELD_CONFIRMATION', 'CLOSED']);
    expect(steps[0].label).toBe('Mới');
  });

  it('chèn bước riêng của trang ngay sau bước chỉ định', () => {
    const steps = buildTicketProgressSteps(ticketStatusDict.vi, [
      { afterKey: 'IN_PROGRESS', step: { key: 'VISIT', label: 'Đến hiện trường' } },
    ]);
    expect(steps.map(step => step.key)).toEqual(['NEW', 'IN_PROGRESS', 'VISIT', 'AWAITING_FIELD_CONFIRMATION', 'CLOSED']);
    expect(findStepIndex(steps, 'AWAITING_FIELD_CONFIRMATION')).toBe(3);
  });

  it('không tìm thấy bước thì về bước đầu', () => {
    expect(findStepIndex(buildTicketProgressSteps(ticketStatusDict.vi), 'UNKNOWN')).toBe(0);
  });
});

describe('ticketDisplayStatus', () => {
  it('ticket đóng kèm cancelled_at là Đã huỷ', () => {
    expect(ticketDisplayStatus({ status: 'CLOSED', cancelled_at: '2026-09-17T15:34:00Z' })).toBe('CANCELLED');
    expect(ticketDisplayStatus({ status: 'CLOSED' })).toBe('CLOSED');
  });
});
