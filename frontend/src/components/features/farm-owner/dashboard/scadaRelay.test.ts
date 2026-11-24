import { describe, expect, it } from 'vitest';
import { pumpConfirmAlerts, relayMinutes } from '@/components/features/farm-owner/dashboard/scadaRelay';

describe('relayMinutes (BR-08)', () => {
  it('caps a pump ON at 30 minutes, keeps the chosen time otherwise', () => {
    expect(relayMinutes('misting', true, 120)).toBe(30);
    expect(relayMinutes('misting', true, 15)).toBe(15);
    expect(relayMinutes('misting', false, 120)).toBe(120);
    expect(relayMinutes('ventilation', true, 120)).toBe(120);
  });
});

describe('pumpConfirmAlerts (ENV-FR-016)', () => {
  const alert = { _id: 'a1', type: 'SENSOR_FAULT', title: 'Cảm biến lỗi', created_at: '2026-11-03T07:00:00Z' };
  const axiosError = (status: number, code: string, details?: unknown) => ({ response: { status, data: { error: { code, details } } } });

  it('reads the open alerts of a 409 CONFIRMATION_REQUIRED', () => {
    expect(pumpConfirmAlerts(axiosError(409, 'CONFIRMATION_REQUIRED', [alert]))).toEqual([alert]);
    expect(pumpConfirmAlerts(axiosError(409, 'CONFIRMATION_REQUIRED'))).toEqual([]);
  });

  it('ignores other errors', () => {
    expect(pumpConfirmAlerts(axiosError(409, 'DEVICE_DECOMMISSIONED'))).toBeNull();
    expect(pumpConfirmAlerts(axiosError(422, 'VALIDATION_ERROR'))).toBeNull();
    expect(pumpConfirmAlerts(new Error('network'))).toBeNull();
  });
});
