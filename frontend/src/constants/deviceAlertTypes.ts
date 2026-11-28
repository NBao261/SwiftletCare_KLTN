import type { AlertType } from '@/types';

// "Device alert" của Report 3, khớp DEVICE_ALERT_TYPES của backend: cảnh báo về thiết bị chứ không về nhà yến
export const DEVICE_ALERT_TYPES: AlertType[] = [
  'NODE_OFFLINE', 'EDGE_AI_DEGRADED', 'SENSOR_FAULT', 'RS485_BUS_FAILURE', 'UNEXPECTED_RESTART',
  'SPEAKER_FAILURE', 'MISTING_INEFFECTIVE', 'ACTUATOR_FAULT', 'CONFIG_MISMATCH', 'MAINTENANCE_DUE',
];
