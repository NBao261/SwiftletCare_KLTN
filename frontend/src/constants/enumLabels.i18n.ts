import type { Dictionary } from '@/lib/i18n';
import type {
  AlertStatus, AlertType, ChecklistResult, DeviceStatus, OnsiteObservation, RecommendationIndicator, RecommendationStatus, Role, SiteCause,
  WorkOrderOrigin, WorkOrderResult, WorkOrderStatus,
} from '@/types';
import type { HarvestCycleStatus } from '@/types/harvest.types';

// Nhãn VI/EN của mã backend — nguồn duy nhất, từ điển màn chỉ lấy lại qua prefixLabels

// Loại cảnh báo
export const alertTypeDict: Dictionary<AlertType> = {
  vi: {
    THRESHOLD_BREACH:    'Vượt ngưỡng môi trường',
    NODE_OFFLINE:        'Thiết bị mất kết nối',
    SPEAKER_FAILURE:     'Lỗi loa ru',
    MISTING_INEFFECTIVE: 'Phun sương không hiệu quả', // THREAT-FR-011, trước là PUMP_DRY
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
    FARM_TECHNICIAN: 'Kỹ thuật viên nhà yến',
    DOMAIN_EXPERT: 'Chuyên gia',
  },
  en: {
    ADMIN: 'Administrator',
    FARM_OWNER: 'Farm Owner',
    FARM_TECHNICIAN: 'Farm Technician',
    DOMAIN_EXPERT: 'Expert',
  },
};

// Trạng thái Work Order (Report 3 §6.19, SM-19)
export const workOrderStatusDict: Dictionary<WorkOrderStatus> = {
  vi: {
    OPEN: 'Chưa bắt đầu',
    IN_PROGRESS: 'Đang làm',
    VERIFYING: 'Đang kiểm dữ liệu',
    AWAITING_APPROVAL: 'Chờ duyệt',
    CLOSED: 'Đã đóng',
    CANCELLED: 'Đã huỷ',
  },
  en: {
    OPEN: 'Not started',
    IN_PROGRESS: 'In progress',
    VERIFYING: 'Verifying data',
    AWAITING_APPROVAL: 'Awaiting approval',
    CLOSED: 'Closed',
    CANCELLED: 'Cancelled',
  },
};

// Nguồn mở Work Order (OPS-FR-001, BR-39)
export const workOrderOriginDict: Dictionary<WorkOrderOrigin> = {
  vi: {
    ALERT: 'Cảnh báo thiết bị',
    OUTAGE: 'Mất kết nối quá 30 phút',
    EXPERT: 'Chuyên gia xác nhận cần tới nhà',
    ONSITE_CHECK: 'Kỹ thuật viên thấy cảm biến hỏng',
    MANUAL: 'Chủ nhà yến tạo',
    PLAN: 'Kế hoạch bảo trì đến hạn',
    CHECKLIST: 'Mục checklist bảo trì ghi hỏng',
    RECOMMENDATION: 'Chủ nhà yến chấp nhận khuyến nghị',
  },
  en: {
    ALERT: 'Equipment alert',
    OUTAGE: 'Offline for over 30 minutes',
    EXPERT: 'Expert confirmed a visit is needed',
    ONSITE_CHECK: 'Technician found a faulty sensor',
    MANUAL: 'Created by the Farm Owner',
    PLAN: 'Maintenance plan due',
    CHECKLIST: 'Maintenance checklist item marked defective',
    RECOMMENDATION: 'Recommendation accepted by the Farm Owner',
  },
};

// Chỉ số theo ngày mà luật khuyến nghị xét (EXPERT-FR-016)
export const recommendationIndicatorDict: Dictionary<RecommendationIndicator> = {
  vi: {
    TIME_IN_RANGE: 'Thời gian trong ngưỡng (%)',
    AIR_HOURS_OVER: 'Số giờ NH3 hoặc CO2 vượt ngưỡng',
    RETURN_RATE: 'Tỷ lệ chim về (%)',
    NOISE_EPISODES: 'Số đợt ồn bất thường',
    MISTING_INEFFECTIVE: 'Số cảnh báo phun sương không hiệu quả',
  },
  en: {
    TIME_IN_RANGE: 'Time in range (%)',
    AIR_HOURS_OVER: 'Hours of NH3 or CO2 over the limit',
    RETURN_RATE: 'Return rate (%)',
    NOISE_EPISODES: 'Abnormal noise episodes',
    MISTING_INEFFECTIVE: 'Ineffective misting alerts',
  },
};

// Trạng thái khuyến nghị (Report 3 §6.21, SM-21)
export const recommendationStatusDict: Dictionary<RecommendationStatus> = {
  vi: {
    OPEN: 'Chờ quyết định',
    ACCEPTED: 'Đã chấp nhận',
    REJECTED: 'Đã từ chối',
    EXPIRED: 'Hết hạn',
    MEASURED: 'Đã đo hiệu quả',
  },
  en: {
    OPEN: 'Awaiting decision',
    ACCEPTED: 'Accepted',
    REJECTED: 'Rejected',
    EXPIRED: 'Expired',
    MEASURED: 'Effect measured',
  },
};

// Nguyên nhân tìm thấy tại chỗ (ALERT-FR-018)
export const siteCauseDict: Dictionary<SiteCause> = {
  vi: { WATER: 'Nước', NOZZLE: 'Béc phun', PUMP: 'Bơm', FAN: 'Quạt', DOOR: 'Cửa', SENSOR: 'Cảm biến', SPEAKER: 'Loa', OTHER: 'Khác' },
  en: { WATER: 'Water', NOZZLE: 'Nozzle', PUMP: 'Pump', FAN: 'Fan', DOOR: 'Door', SENSOR: 'Sensor', SPEAKER: 'Speaker', OTHER: 'Other' },
};

// Quan sát tại chỗ của Kỹ thuật viên (EXPERT-FR-021)
export const onsiteObservationDict: Dictionary<OnsiteObservation> = {
  vi: {
    BIRDS_DISTURBED:        'Chim bị động',
    WORK_OR_PEOPLE_NEARBY:  'Có người/công việc gần đó',
    RAIN:                   'Mưa',
    SENSOR_DIRTY_OR_FAULTY: 'Cảm biến bẩn hoặc hỏng',
    NOTHING_UNUSUAL:        'Không có gì lạ',
    OTHER:                  'Khác',
  },
  en: {
    BIRDS_DISTURBED:        'Birds disturbed',
    WORK_OR_PEOPLE_NEARBY:  'Work or people nearby',
    RAIN:                   'Rain',
    SENSOR_DIRTY_OR_FAULTY: 'Sensor dirty or faulty',
    NOTHING_UNUSUAL:        'Nothing unusual',
    OTHER:                  'Other',
  },
};

// Kết quả Work Order thợ báo khi xong
export const workOrderResultDict: Dictionary<WorkOrderResult> = {
  vi: { REPAIRED: 'Đã sửa', SELF_RECOVERED: 'Tự phục hồi trước khi sửa', DONE: 'Đã bảo trì' },
  en: { REPAIRED: 'Repaired', SELF_RECOVERED: 'Recovered on its own before the repair', DONE: 'Maintenance done' },
};

// Kết quả 1 mục checklist bảo trì (OPS-FR-007), cùng chữ với mobile
export const checklistResultDict: Dictionary<ChecklistResult> = {
  vi: { OK: 'Đạt', DEFECT: 'Hỏng' },
  en: { OK: 'OK', DEFECT: 'Defective' },
};

// Trạng thái chu kỳ thu hoạch (HARVEST-FR-007, EXPERT-FR-020)
export const harvestCycleStatusDict: Dictionary<HarvestCycleStatus> = {
  vi: { OPEN: 'Đang mở', CLOSED: 'Đã đóng', CONCLUDED: 'Đã kết luận' },
  en: { OPEN: 'Open', CLOSED: 'Closed', CONCLUDED: 'Concluded' },
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
