import type { Dictionary } from '@/lib/i18n';
import type { AlertStatus, AlertType, DeviceStatus, Role } from '@/types';

// Nhãn VI/EN của mã backend — nguồn duy nhất, từ điển màn chỉ lấy lại qua prefixLabels

// Loại cảnh báo
export const alertTypeDict: Dictionary<AlertType> = {
  vi: {
    THRESHOLD_BREACH: 'Vượt ngưỡng môi trường',
    PREDATOR_DETECTED: 'Phát hiện thiên địch',
    NODE_OFFLINE: 'Thiết bị mất kết nối',
    SPEAKER_FAILURE: 'Lỗi loa ru',
    PUMP_DRY: 'Bơm chạy khô',
    NOISE_ANOMALY: 'Ồn bất thường',
    POWER_OUTAGE: 'Mất điện',
    LOW_RETURN_RATE: 'Tỉ lệ chim về thấp',
    EDGE_AI_DEGRADED: 'Camera AI suy giảm',
    SENSOR_FAULT: 'Lỗi cảm biến',
    RS485_BUS_FAILURE: 'Lỗi bus RS485',
    SENSOR_ANOMALY: 'Cảm biến bất thường',
    FORECAST_BREACH: 'Dự báo vượt ngưỡng',
    MAINTENANCE_DUE: 'Đến hạn bảo trì bơm/quạt',
  },
  en: {
    THRESHOLD_BREACH: 'Environment threshold breach',
    PREDATOR_DETECTED: 'Predator detected',
    NODE_OFFLINE: 'Device offline',
    SPEAKER_FAILURE: 'Lullaby speaker fault',
    PUMP_DRY: 'Pump running dry',
    NOISE_ANOMALY: 'Noise anomaly',
    POWER_OUTAGE: 'Power outage',
    LOW_RETURN_RATE: 'Low bird return rate',
    EDGE_AI_DEGRADED: 'AI camera degraded',
    SENSOR_FAULT: 'Sensor fault',
    RS485_BUS_FAILURE: 'RS485 bus failure',
    SENSOR_ANOMALY: 'Sensor anomaly',
    FORECAST_BREACH: 'Forecast threshold breach',
    MAINTENANCE_DUE: 'Pump/fan service due',
  },
};

// Trạng thái xử lý cảnh báo
export const alertStatusDict: Dictionary<AlertStatus> = {
  vi: { ACTIVE: 'Mới', ACKNOWLEDGED: 'Tiếp nhận', RESOLVED: 'Đã xử lý' },
  en: { ACTIVE: 'New', ACKNOWLEDGED: 'Received', RESOLVED: 'Resolved' },
};

// Trạng thái thiết bị
export const deviceStatusDict: Dictionary<DeviceStatus> = {
  vi: { PENDING: 'Chờ kết nối', ONLINE: 'Online', OFFLINE: 'Offline', ERROR: 'Lỗi', DEGRADED: 'Suy giảm' },
  en: { PENDING: 'Awaiting connection', ONLINE: 'Online', OFFLINE: 'Offline', ERROR: 'Error', DEGRADED: 'Degraded' },
};

// Vai trò người dùng
export const roleDict: Dictionary<Role> = {
  vi: {
    ADMIN: 'Quản trị viên',
    FARM_OWNER: 'Chủ nhà yến',
    TECHNICIAN: 'Kỹ thuật viên',
    DOMAIN_EXPERT: 'Chuyên gia',
    SALES_STAFF: 'Nhân viên kinh doanh',
  },
  en: {
    ADMIN: 'Administrator',
    FARM_OWNER: 'Farm Owner',
    TECHNICIAN: 'Technician',
    DOMAIN_EXPERT: 'Expert',
    SALES_STAFF: 'Sales Staff',
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
