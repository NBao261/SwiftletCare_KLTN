import { format, parseISO } from 'date-fns';

import type { AnalyticsRange } from '@/apis/farm-owner/analytics.api';
import { CHART_COLORS, withAlpha } from '@/lib/chartTheme';

// 5 khoảng thời gian backend hỗ trợ (ANALYTICS-FR-001/008/011)
export const ANALYTICS_RANGES: AnalyticsRange[] = ['1h', '6h', '24h', '7d', '30d'];

// Chỉ số so sánh giữa các Zone — API so sánh không có âm thanh
export const COMPARE_METRICS = [
  { key: 'temperature', unit: '°C' },
  { key: 'humidity', unit: '%' },
  { key: 'light_lux', unit: 'lux' },
  { key: 'nh3_ppm', unit: 'ppm' },
  { key: 'co2_ppm', unit: 'ppm' },
] as const;
export type CompareMetricKey = typeof COMPARE_METRICS[number]['key'];

// Backend chặn quá 6 Zone mỗi lần so sánh
export const MAX_COMPARE_ZONES = 6;

// Số lần can thiệp tay hiện trong lịch sử
export const OVERRIDE_HISTORY_LIMIT = 8;

// Số tuần xem tỷ lệ chim về
export const BIRD_WEEK_OPTIONS = [4, 12] as const;
export type BirdWeekOption = typeof BIRD_WEEK_OPTIONS[number];

// Số ngày xem tương quan
export const CORRELATION_DAY_OPTIONS = [30, 90] as const;
export type CorrelationDayOption = typeof CORRELATION_DAY_OPTIONS[number];

// Nhãn trục thời gian: khoảng theo ngày hiện ngày/tháng, còn lại hiện giờ:phút
export function labelForRange(iso: string, range: AnalyticsRange): string {
  const date = parseISO(iso);
  if (range === '7d' || range === '30d') return format(date, 'dd/MM');
  return format(date, 'HH:mm');
}

// Trục thời gian tự bỏ bớt nhãn, tối đa 8 nhãn, không xoay chữ
export const X_AXIS_TICKS = { autoSkip: true, maxRotation: 0, maxTicksLimit: 8 };

// Chữ trên biểu đồ
export const CHART_FONT = { family: 'Plus Jakarta Sans', size: 11 };

// Chú thích biểu đồ đặt trên cùng
export const CHART_LEGEND = { display: true, position: 'top' as const, labels: { boxWidth: 10, font: CHART_FONT } };

// Tiêu đề trục biểu đồ
export function axisTitle(text: string): { display: boolean; text: string; color: string; font: typeof CHART_FONT } {
  return { display: true, text, color: CHART_COLORS.warmGray, font: CHART_FONT };
}

// Nền dải ngưỡng trên biểu đồ = accent-600 (token accentGreen) độ đậm 12%
export const THRESHOLD_BAND_FILL = withAlpha(CHART_COLORS.accentGreen, 0.12);
