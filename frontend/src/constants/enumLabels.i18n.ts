import type { Dictionary } from '@/lib/i18n';
import type { AlertStatus, AlertType, DeviceStatus, Role, TicketStatus, TicketType } from '@/types';

// Nhãn VI/EN của mã backend — nguồn duy nhất, từ điển màn chỉ lấy lại qua prefixLabels

// Loại cảnh báo
export const alertTypeDict: Dictionary<AlertType> = {
  vi: {
    THRESHOLD_BREACH: 'Vượt ngưỡng môi trường',
    PREDATOR_DETECTED: 'Phát hiện thiên địch',
    NODE_OFFLINE: 'Thiết bị mất kết nối',
    SPEAKER_FAILURE: 'Lỗi loa ru',
    PUMP_DRY: 'Bơm chạy khô',
    BIRD_PANIC: 'Ồn bất thường',
    POWER_OUTAGE: 'Mất điện',
    LOW_RETURN_RATE: 'Tỉ lệ chim về thấp',
    EDGE_AI_DEGRADED: 'Camera AI suy giảm',
    SENSOR_FAULT: 'Lỗi cảm biến',
    RS485_BUS_FAILURE: 'Lỗi bus RS485',
    SENSOR_ANOMALY: 'Cảm biến bất thường',
    FORECAST_BREACH: 'Dự báo vượt ngưỡng',
  },
  en: {
    THRESHOLD_BREACH: 'Environment threshold breach',
    PREDATOR_DETECTED: 'Predator detected',
    NODE_OFFLINE: 'Device offline',
    SPEAKER_FAILURE: 'Lullaby speaker fault',
    PUMP_DRY: 'Pump running dry',
    BIRD_PANIC: 'Noise anomaly',
    POWER_OUTAGE: 'Power outage',
    LOW_RETURN_RATE: 'Low bird return rate',
    EDGE_AI_DEGRADED: 'AI camera degraded',
    SENSOR_FAULT: 'Sensor fault',
    RS485_BUS_FAILURE: 'RS485 bus failure',
    SENSOR_ANOMALY: 'Sensor anomaly',
    FORECAST_BREACH: 'Forecast threshold breach',
  },
};

// Trạng thái xử lý cảnh báo
export const alertStatusDict: Dictionary<AlertStatus> = {
  vi: { ACTIVE: 'Mới', ACKNOWLEDGED: 'Tiếp nhận', RESOLVED: 'Đã xử lý' },
  en: { ACTIVE: 'New', ACKNOWLEDGED: 'Received', RESOLVED: 'Resolved' },
};

// Loại ticket
export const ticketTypeDict: Dictionary<TicketType> = {
  vi: {
    SENSOR_FAULT: 'Lỗi cảm biến',
    RS485_BUS_FAILURE: 'Lỗi bus RS485',
    ACTUATOR_FAILURE: 'Lỗi thiết bị chấp hành',
    NODE_OFFLINE: 'Thiết bị mất kết nối',
    EDGE_AI_DEGRADED: 'Camera AI suy giảm',
    POWER_OUTAGE: 'Mất điện',
    SPEAKER_FAILURE: 'Lỗi loa ru',
    PREDATOR_DETECTED: 'Phát hiện thiên địch',
    INSTALLATION: 'Yêu cầu lắp đặt mới',
    MAINTENANCE: 'Bảo trì định kỳ',
    OTHER: 'Khác',
  },
  en: {
    SENSOR_FAULT: 'Sensor fault',
    RS485_BUS_FAILURE: 'RS485 bus failure',
    ACTUATOR_FAILURE: 'Actuator failure',
    NODE_OFFLINE: 'Device offline',
    EDGE_AI_DEGRADED: 'AI camera degraded',
    POWER_OUTAGE: 'Power outage',
    SPEAKER_FAILURE: 'Lullaby speaker fault',
    PREDATOR_DETECTED: 'Predator detected',
    INSTALLATION: 'New installation request',
    MAINTENANCE: 'Scheduled maintenance',
    OTHER: 'Other',
  },
};

// Trạng thái ticket — 4 bước: NEW Mới · IN_PROGRESS kỹ thuật viên đã nhận việc · AWAITING_FIELD_CONFIRMATION kỹ thuật viên đang xác nhận kết quả · CLOSED kỹ thuật viên xác nhận xong
export const ticketStatusDict: Dictionary<TicketStatus> = {
  vi: {
    NEW: 'Mới',
    IN_PROGRESS: 'Đã tiếp nhận',
    AWAITING_FIELD_CONFIRMATION: 'Đang xử lý',
    CLOSED: 'Hoàn tất',
  },
  en: {
    NEW: 'New',
    IN_PROGRESS: 'Accepted',
    AWAITING_FIELD_CONFIRMATION: 'In progress',
    CLOSED: 'Completed',
  },
};

// Trạng thái hiển thị của ticket: 4 trạng thái backend + Đã huỷ (CLOSED kèm cancelled_at)
export type TicketDisplayStatus = TicketStatus | 'CANCELLED';

export const ticketDisplayStatusDict: Dictionary<TicketDisplayStatus> = {
  vi: { ...ticketStatusDict.vi, CANCELLED: 'Đã huỷ' },
  en: { ...ticketStatusDict.en, CANCELLED: 'Cancelled' },
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
    SALES_STAFF: 'Chuyên gia',
  },
  en: {
    ADMIN: 'Administrator',
    FARM_OWNER: 'Farm Owner',
    TECHNICIAN: 'Technician',
    SALES_STAFF: 'Expert',
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
