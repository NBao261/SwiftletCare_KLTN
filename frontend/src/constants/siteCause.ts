import type { AlertType, SiteCause } from '@/types'

// ALERT-FR-018 — nguyên nhân tìm thấy tại chỗ, cùng thứ tự với SITE_CAUSES của backend (workOrder.model.ts)
export const SITE_CAUSES: SiteCause[] = ['WATER', 'NOZZLE', 'PUMP', 'FAN', 'DOOR', 'SENSOR', 'SPEAKER', 'OTHER']

// Cảnh báo thiết bị có ô nguyên nhân — khớp AUTO_WORK_ORDER_TYPES của backend (bắt buộc khi báo xong Work Order của chúng) và isCauseAlertType của mobile
export const CAUSE_ALERT_TYPES: ReadonlySet<AlertType> = new Set<AlertType>([
  'MISTING_INEFFECTIVE', 'ACTUATOR_FAULT', 'SENSOR_FAULT', 'RS485_BUS_FAILURE', 'SPEAKER_FAILURE',
])
