import type { Dictionary } from '@/lib/i18n';
import type { AlertStatus, AlertType, DeviceStatus, Role } from '@/types';

// Nhãn VI/EN của mã backend — nguồn duy nhất, từ điển màn chỉ lấy lại qua prefixLabels

// Loại cảnh báo
export const alertTypeDict: Dictionary<AlertType> = {
  vi: {
    THRESHOLD_BREACH:    'Vượt ngưỡng môi trường',
    NODE_OFFLINE:        'Thiết bị mất kết nối',
    SPEAKER_FAILURE:     'Lỗi loa ru',
    MISTING_INEFFECTIVE: 'Phún sương không hiệu quả', // THREAT-FR-011, trước là PUMP_DRY
    NOISE_ANOMALY:       'Ồn bất thường',
    LOW_RETURN_RATE:     'Tỉ lệ chim về thấp',
    EDGE_AI_DEGRADED:    'Camera AI suy giảm',
    UNEXPECTED_RESTART:  'Khởi động đột ngột',   // THREAT-FR-012, trước là POWER_OUTAGE
    SENSOR_FAULT:        'Lỗi cảm biến',
    RS485_BUS_FAILURE:   'Lỗi bus RS485',
    SENSOR_ANOMALY:      'Cảm biến bất thường',
    FORECAST_BREACH:     'Dự báo vượt ngưỡng',
    MAINTENANCE_DUE:     'Đến hạn bảo trì bơm/quạt',
    ACTUATOR_FAULT:      'Lỗi cơ cấu chấp hành',      // THREAT-FR-014
    CONFIG_MISMATCH:     'Sai cấu hình thiết bị',      // ENV-FR-027
  },
  en: {
    THRESHOLD_BREACH:    'Environment threshold breach',
    NODE_OFFLINE:        'Device offline',
    SPEAKER_FAILURE:     'Lullaby speaker fault',
    MISTING_INEFFECTIVE: 'Misting ineffective',
    NOISE_ANOMALY:       'Noise anomaly',
    LOW_RETURN_RATE:     'Low bird return rate',
    EDGE_AI_DEGRADED:    'AI camera degraded',
    UNEXPECTED_RESTART:  'Unexpected restart',
    SENSOR_FAULT:        'Sensor fault',
    RS485_BUS_FAILURE:   'RS485 bus failure',
    SENSOR_ANOMALY:      'Sensor anomaly',
    FORECAST_BREACH:     'Forecast threshold breach',
    MAINTENANCE_DUE:     'Pump/fan service due',
    ACTUATOR_FAULT:      'Actuator fault',
    CONFIG_MISMATCH:     'Config mismatch',
  },
};

// Trạng thái xử lý cảnh báo
export const alertStatusDict: Dictionary<AlertStatus> = {
  vi: { ACTIVE: 'Mới', ACKNOWLEDGED: 'Tiếp nhận', DISMISSED: 'Bác bỏ', RESOLVED: 'Đã xử lý' },
  en: { ACTIVE: 'New', ACKNOWLEDGED: 'Received', DISMISSED: 'Dismissed', RESOLVED: 'Resolved' },
};

// Trạng thái thiết bị — ERROR/DEGRADED đã bỏ theo SRS 3.1.0
export const deviceStatusDict: Dictionary<DeviceStatus> = {
  vi: { PENDING: 'Chờ kết nối', ONLINE: 'Online', OFFLINE: 'Offline' },
  en: { PENDING: 'Awaiting connection', ONLINE: 'Online', OFFLINE: 'Offline' },
};

// Vai trò người dùng
export const roleDict: Dictionary<Role> = {
  vi: {
    ADMIN: 'Quản trị viên',
    FARM_OWNER: 'Chủ nhà yến',
    TECHNICIAN: 'Kỹ thuật viên',
    DOMAIN_EXPERT: 'Chuyên gia',
  },
  en: {
    ADMIN: 'Administrator',
    FARM_OWNER: 'Farm Owner',
    TECHNICIAN: 'Technician',
    DOMAIN_EXPERT: 'Expert',
  },
};

// Gắn tiền tố vào key để từ điển màn dùng lại nhãn chung (VD 'status.' + NEW → 'status.NEW')
export function prefixLabels<Prefix extends string, Key extends string>(
  prefix: Prefix,
  labels: Record<Key, string>,
): Record<`${Prefix}${Key}`, string> {
  const result = {} as Record<`${Prefix}${Key}`, string>;
  for (const key of Object.keys(labels) as Key[]) {
    result[`${prefix}${key}`] = labels[key];
  }
  return result;
}
