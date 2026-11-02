import { SCADA_PUMP_ON_MAX_MINUTES } from '@/components/features/farm-owner/dashboard/scada.constants';
import type { RelayName } from '@/types';

// BR-08 — bật bơm (phun sương) tay tối đa 30 phút; tắt bơm, quạt, loa theo thời hạn đang chọn
export function relayMinutes(relay: RelayName, turnOn: boolean, durationMinutes: number): number {
  return relay === 'misting' && turnOn ? Math.min(durationMinutes, SCADA_PUMP_ON_MAX_MINUTES) : durationMinutes;
}

// Cảnh báo backend gửi kèm 409 CONFIRMATION_REQUIRED (ENV-FR-016): bật bơm khi Zone đang có SENSOR_FAULT,
// RS485_BUS_FAILURE hoặc MISTING_INEFFECTIVE còn hiệu lực
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
