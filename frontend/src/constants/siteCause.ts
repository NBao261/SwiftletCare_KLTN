import type { AlertType, SiteCause } from '@/types';

// nguyên nhân tìm thấy tại chỗ, cùng thứ tự với SITE_CAUSES của backend (workOrder.model.ts)
export const SITE_CAUSES: SiteCause[] = ['WATER', 'NOZZLE', 'PUMP', 'FAN', 'DOOR', 'SENSOR', 'SPEAKER', 'OTHER'];

// Khớp AUTO_WORK_ORDER_TYPES của backend và isCauseAlertType của mobile
export const CAUSE_ALERT_TYPES: ReadonlySet<AlertType> = new Set<AlertType>([
  'MISTING_INEFFECTIVE', 'ACTUATOR_FAULT', 'SENSOR_FAULT', 'RS485_BUS_FAILURE', 'SPEAKER_FAILURE',
]);
