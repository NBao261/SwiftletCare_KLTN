// Bộ lọc của trang Kiểm chứng cảnh báo: tab kết luận, loại cảnh báo suy luận, mức độ
import type { AlertTabFilter } from '@/hooks/domain-expert/useExpertAlerts';
import type { InferredAlertType } from '@/types/expert.types';
import type { AlertSeverity } from '@/types';

// Thứ tự tab: chờ kiểm chứng đứng ngay sau "Tất cả" vì là việc chuyên gia phải làm
export const TAB_ORDER: AlertTabFilter[] = ['ALL', 'PENDING', 'CONFIRMED', 'REJECTED'];

// Nhãn tab (khoá dịch là chính câu tiếng Việt)
export const TAB_LABEL: Record<AlertTabFilter, string> = {
  ALL: 'Tất cả',
  PENDING: 'Chờ kiểm chứng',
  CONFIRMED: 'Đã xác nhận',
  REJECTED: 'Đã bác bỏ',
};

export const TYPE_OPTS: Array<{ value: InferredAlertType | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'Loại cảnh báo' },
  { value: 'NOISE_ANOMALY', label: 'Tiếng ồn bất thường' },
  { value: 'SENSOR_ANOMALY', label: 'Cảm biến bất thường' },
  { value: 'FORECAST_BREACH', label: 'Sắp vượt ngưỡng' },
  { value: 'LOW_RETURN_RATE', label: 'Tỷ lệ chim về thấp' },
];

// Cảnh báo suy luận chỉ ở mức MEDIUM/LOW, tức cấp P3 Trung bình và P4 Thấp của FE_Design 2.4
export const INFERRED_SEVERITIES: AlertSeverity[] = ['MEDIUM', 'LOW'];
