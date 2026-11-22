import { SCADA_PUMP_ON_MAX_MINUTES } from '@/components/features/farm-owner/dashboard/scada.constants';
import type { RelayName } from '@/types';

// bật bơm (phun sương) tay tối đa 30 phút; tắt bơm, quạt, loa theo thời hạn đang chọn
export function relayMinutes(relay: RelayName, turnOn: boolean, durationMinutes: number): number {
  return relay === 'misting' && turnOn ? Math.min(durationMinutes, SCADA_PUMP_ON_MAX_MINUTES) : durationMinutes;
}

// 409 CONFIRMATION_REQUIRED khi bật bơm lúc Zone có cảnh báo cảm biến/phun sương
export interface PumpConfirmAlert {
  _id: string;
  type: string;
  title: string;
  created_at: string;
}

// Đọc danh sách cảnh báo từ lỗi axios; lỗi khác thì null
export function pumpConfirmAlerts(error: unknown): PumpConfirmAlert[] | null {
  const body = (error as { response?: { status?: number; data?: { error?: { code?: string; details?: unknown } } } }).response;
  if (body?.status !== 409 || body.data?.error?.code !== 'CONFIRMATION_REQUIRED') return null;
  const details = body.data.error.details;
  return Array.isArray(details) ? (details as PumpConfirmAlert[]) : [];
}
