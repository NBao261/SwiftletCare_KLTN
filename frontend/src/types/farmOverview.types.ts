// G-25 — tổng quan trại, so sánh nhà (ANALYTICS-FR-015, 016, BR-44), điện năng ước tính (ANALYTICS-FR-017, BR-45); api-spec HouseOverview, HouseComparisonRow, EnergyMonth

// Giai đoạn nhà dùng chung với hồ sơ cấu hình (G-24), không khai báo lại để barrel `@/types` không xuất trùng
import type { HouseStage } from '@/types/expert/profile.types';

// NOT_COMPUTED: chưa xét ngày hôm nay · INSUFFICIENT_DATA: đã xét nhưng thiếu dữ liệu
export type OverviewStatusReason = 'NOT_COMPUTED' | 'INSUFFICIENT_DATA';

export interface HouseOverview {
  house_id: string;
  name: string;
  stage: HouseStage;
  status: 'GOOD' | 'WATCH' | 'ACTION' | null;
  status_reason: OverviewStatusReason | null;
  open_alerts: number;
  open_work_orders: number;
  // Tìm trong 30 ngày gần nhất; null = không có ngày nào có tỷ lệ
  latest_return_rate: { date: string; value: number } | null;
  // Mọi thiết bị của nhà là thiết bị giả lập (SYSTEM-FR-004)
  simulated: boolean;
}

export interface FarmOverview {
  farm_id: string;
  date: string;
  houses: HouseOverview[];
}

// Cột sắp xếp được của bảng so sánh (api-spec sort)
export type ComparisonSortKey =
  | 'name' | 'time_in_range_pct' | 'good_days_pct' | 'return_rate_avg' | 'flock_trend_pct'
  | 'alerts_raised' | 'alerts_open' | 'mttr_min' | 'energy_kwh' | 'last_cycle_yield_g';

// Không có điểm tổng hay xếp hạng (BR-44); null = chưa có số
export interface HouseComparisonRow {
  house_id: string;
  name: string;
  time_in_range_pct: number | null;
  good_days_pct: number | null;
  return_rate_avg: number | null;
  flock_trend_pct: number | null;
  alerts_raised: number;
  alerts_open: number;
  mttr_min: number | null;
  // Ước tính (BR-45); null = không có dòng đo
  energy_kwh: number | null;
  last_cycle_yield_g: number | null;
}

export interface HouseComparison {
  farm_id: string;
  from: string;
  to: string;
  days: number;
  sort: ComparisonSortKey;
  order: 'asc' | 'desc';
  rows: HouseComparisonRow[];
}

// Một tháng giờ VN; null = tải không có dòng đo trong tháng
export interface EnergyMonth {
  month: string;
  misting_kwh: number | null;
  ventilation_kwh: number | null;
}

export interface EnergyEstimate {
  house_id: string;
  from: string;
  to: string;
  supply_voltage: { misting: number; ventilation: number };
  estimated: boolean;
  months: EnergyMonth[];
  total: { misting_kwh: number | null; ventilation_kwh: number | null; total_kwh: number | null };
}

// ANALYTICS-FR-002 — trung bình số chim ra buổi sáng của 1 tuần (thứ Hai đầu tuần) hoặc 1 tháng
export interface FlockPeriod {
  period: string;
  days: number;
  mean_morning_exit: number;
  // null khi kỳ trước không có số
  change_pct: number | null;
}
