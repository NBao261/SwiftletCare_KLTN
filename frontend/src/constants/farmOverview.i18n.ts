import type { Dictionary } from '@/lib/i18n';

// Từ điển trang Tổng quan trại (/overview)
const vi = {
  // Đầu trang
  'page.retry': 'Thử lại',
  'page.pickFarmTitle': 'Chọn một trang trại',
  'page.pickFarmHint': 'Chọn một trang trại ở khung lọc phía trên để so sánh các nhà của trang trại đó.',

  // Tab Các nhà

  // Tab So sánh nhà
  'comparison.subtitle': 'Bấm tên cột để sắp xếp. Không có điểm tổng hay xếp hạng, mỗi chỉ số đọc riêng.',
  'comparison.title': 'So sánh các nhà yến',
  'comparison.periodLabel': 'Khoảng',
  'comparison.period': '{n} ngày',
  'comparison.range': 'Số liệu từ {from} tới {to}',
  'comparison.errorTitle': 'Không tải được bảng so sánh',
  'comparison.emptyTitle': 'Trang trại chưa có nhà yến',
  'comparison.emptyHint': 'Thêm nhà yến ở mục Trang trại để so sánh.',
  'comparison.note': 'Điện năng là số ước tính từ dòng đo của bơm và quạt, không phải số công tơ. Ô "_" là chưa có số.',
  'col.name': 'Nhà yến',
  'col.time_in_range_pct': 'Thời gian trong ngưỡng',
  'col.good_days_pct': 'Ngày trạng thái Tốt',
  'col.return_rate_avg': 'Tỷ lệ về trung bình',
  'col.flock_trend_pct': 'Xu hướng đàn',
  'col.alerts_raised': 'Cảnh báo trong kỳ',
  'col.alerts_open': 'Cảnh báo đang mở',
  'col.mttr_min': 'Thời gian xử lý trung bình',
  'col.energy_kwh': 'Điện năng (ước tính)',
  'col.last_cycle_yield_g': 'Sản lượng chu kỳ gần nhất',
  'group.environment': 'Môi trường',
  'group.flock': 'Đàn chim',
  'group.alerts': 'Cảnh báo',
  'group.energyYield': 'Điện năng và sản lượng',
  'group.siteCauses': 'Nguyên nhân tại chỗ',
  'short.time_in_range_pct': 'Trong ngưỡng',
  'short.good_days_pct': 'Ngày Tốt',
  'short.return_rate_avg': 'Tỷ lệ về',
  'short.flock_trend_pct': 'Xu hướng',
  'short.alerts_raised': 'Trong kỳ',
  'short.alerts_open': 'Đang mở',
  'short.mttr_min': 'Xử lý trung bình',
  'short.energy_kwh': 'Điện (ước tính)',
  'short.last_cycle_yield_g': 'Sản lượng chu kỳ',
  'unit.minutes': '{n} phút',
  'unit.kwh': '{n} kWh',
  'unit.kg': '{n} kg',
};

export type FarmOverviewKey = keyof typeof vi;

const en: Record<FarmOverviewKey, string> = {
  'page.retry': 'Retry',
  'page.pickFarmTitle': 'Choose a farm',
  'page.pickFarmHint': 'Choose a farm in the filter above to compare its houses.',


  'comparison.subtitle': 'Click a column name to sort. There is no total score or ranking: each figure is read on its own.',
  'comparison.title': 'Compare the houses',
  'comparison.periodLabel': 'Period',
  'comparison.period': '{n} days',
  'comparison.range': 'Figures from {from} to {to}',
  'comparison.errorTitle': 'Could not load the comparison',
  'comparison.emptyTitle': 'This farm has no swiftlet house yet',
  'comparison.emptyHint': 'Add a swiftlet house under Farms to compare.',
  'comparison.note': 'Energy is estimated from the measured current of the pump and the fan, not a meter reading. "_" means no figure yet.',
  'col.name': 'Swiftlet house',
  'col.time_in_range_pct': 'Time in range',
  'col.good_days_pct': 'Good days',
  'col.return_rate_avg': 'Mean return rate',
  'col.flock_trend_pct': 'Flock trend',
  'col.alerts_raised': 'Alerts in period',
  'col.alerts_open': 'Open alerts',
  'col.mttr_min': 'Mean time to resolve',
  'col.energy_kwh': 'Energy (estimated)',
  'col.last_cycle_yield_g': 'Last cycle yield',
  'group.environment': 'Environment',
  'group.flock': 'Flock',
  'group.alerts': 'Alerts',
  'group.energyYield': 'Energy and yield',
  'group.siteCauses': 'Causes found on site',
  'short.time_in_range_pct': 'In range',
  'short.good_days_pct': 'Good days',
  'short.return_rate_avg': 'Return rate',
  'short.flock_trend_pct': 'Trend',
  'short.alerts_raised': 'In period',
  'short.alerts_open': 'Open',
  'short.mttr_min': 'Mean resolve time',
  'short.energy_kwh': 'Energy (estimate)',
  'short.last_cycle_yield_g': 'Cycle yield',
  'unit.minutes': '{n} min',
  'unit.kwh': '{n} kWh',
  'unit.kg': '{n} kg',
};

export const farmOverviewDict: Dictionary<FarmOverviewKey> = { vi, en };
