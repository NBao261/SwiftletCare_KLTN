import type { MaintenanceKey } from '@/constants/maintenance.i18n';
import type { MaintenanceBasis, MaintenanceEquipment } from '@/types';

// Giới hạn của POST /maintenance/plans (api-spec MaintenancePlanInput)
export const CHECKLIST_MAX_ITEMS = 30;
export const CHECKLIST_ITEM_MAX_LENGTH = 200;
export const SOURCE_MAX_LENGTH = 300;
export const NOTE_MAX_LENGTH = 1000;

export const EQUIPMENTS: MaintenanceEquipment[] = ['PUMP', 'FAN', 'SENSOR', 'NOZZLE', 'CALIBRATION'];

// OPS-FR-005 — bơm, quạt tính theo giờ chạy hoặc số lần đóng cắt; vệ sinh, hiệu chuẩn theo lịch (cùng luật backend)
export function basesFor(equipment: MaintenanceEquipment): MaintenanceBasis[] {
  return equipment === 'PUMP' || equipment === 'FAN' ? ['RUN_HOURS', 'SWITCHES'] : ['CALENDAR'];
}

export interface MaintenancePlanDraft {
  interval: string;
  checklist: string[];
  source: string;
}

export type MaintenancePlanErrors = Partial<Record<'interval' | 'checklist' | 'source', MaintenanceKey>>;

// Mục checklist bỏ trống thì không gửi
export const filledChecklist = (checklist: string[]): string[] => checklist.map(item => item.trim()).filter(Boolean);

// Kiểm form trước khi gửi; rỗng = hợp lệ
export function validateMaintenancePlan(draft: MaintenancePlanDraft): MaintenancePlanErrors {
  const errors: MaintenancePlanErrors = {};
  const interval = Number(draft.interval);
  if (!draft.interval.trim() || !Number.isFinite(interval) || interval <= 0) errors.interval = 'error.interval';
  const items = filledChecklist(draft.checklist);
  if (items.length === 0) errors.checklist = 'error.checklistEmpty';
  else if (items.length > CHECKLIST_MAX_ITEMS) errors.checklist = 'error.checklistTooMany';
  if (!draft.source.trim()) errors.source = 'error.source';
  return errors;
}
