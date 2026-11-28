import type { DevicesKey } from '@/constants/devices.i18n';

// Lý do khởi động lại do ESP32 báo (esp_reset_reason), firmware từ 1.4.0 (FARM-FR-006)
const RESET_REASON_KEY: Record<string, DevicesKey> = {
  POWERON: 'reset.POWERON',
  EXT: 'reset.EXT',
  SW: 'reset.SW',
  PANIC: 'reset.PANIC',
  INT_WDT: 'reset.WDT',
  TASK_WDT: 'reset.WDT',
  WDT: 'reset.WDT',
  DEEPSLEEP: 'reset.DEEPSLEEP',
  BROWNOUT: 'reset.BROWNOUT',
  SDIO: 'reset.SDIO',
};

// Khởi động lại ngoài ý muốn (treo, lỗi phần mềm, sụt áp): đáng kiểm tra nguồn và firmware
const UNEXPECTED_RESETS = new Set(['PANIC', 'INT_WDT', 'TASK_WDT', 'WDT', 'BROWNOUT']);

// Chưa có lý do (thiết bị chưa gửi heartbeat có chẩn đoán) thì không có khoá
export function resetReasonKey(reason: string | undefined): DevicesKey | undefined {
  if (!reason) return undefined;
  return RESET_REASON_KEY[reason] ?? 'reset.unknown';
}

export function isUnexpectedReset(reason: string | undefined): boolean {
  return reason !== undefined && UNEXPECTED_RESETS.has(reason);
}
