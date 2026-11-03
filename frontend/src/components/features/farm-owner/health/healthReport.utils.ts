import { formatHealthReason } from '@/components/features/farm-owner/health/healthDay.utils';
import { NO_VALUE } from '@/constants/display';
import type { HealthTranslate } from '@/constants/health.i18n';
import type { HealthReportZoneSection, HealthStatus, HouseHealthReport, HouseHealthReportSummary } from '@/types';

// Hàm định dạng truyền từ useTranslation — màn chi tiết và file PDF dùng chung để ra đúng một con số (EXPERT-FR-013)
export interface ReportFormat {
  t: HealthTranslate;
  date: (iso: string) => string;
  dateTime: (iso: string) => string;
  // Số đo tối đa 1 chữ số lẻ
  number: (value: number) => string;
}

export const REPORT_STATUSES: HealthStatus[] = ['GOOD', 'WATCH', 'ACTION', 'INSUFFICIENT_DATA'];

export interface ReportFact {
  label: string;
  value: string;
}

export interface ReportDayRow {
  date: string;
  status: HealthStatus | null;
  statusText: string;
  returnRate: string;
  reasons: string[];
  ratings: string[];
}

const percent = (value: number | null, format: ReportFormat): string => (value === null ? NO_VALUE : `${format.number(value)} %`);
const averageMax = (average: number | null, max: number | null, format: ReportFormat, unit: string): string =>
  (average === null && max === null ? NO_VALUE : `${average === null ? NO_VALUE : format.number(average)} / ${max === null ? NO_VALUE : format.number(max)} ${unit}`);

// Kỳ gọn: ngày "02/11/2026", tháng "Tháng 10/2026", khoảng cùng năm "26/10 – 01/11/2026" (khác năm thì ghi đủ 2 đầu)
export function reportPeriod(report: HouseHealthReportSummary, format: ReportFormat): string {
  const { period_start: start, period_end: end } = report;
  if (start === end) return format.date(start);
  // 'YYYY-MM-DD' → 'DD/MM'
  const dayMonth = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;
  if (report.kind === 'MONTHLY') return format.t('report.month', { month: `${start.slice(5, 7)}/${start.slice(0, 4)}` });
  const from = start.slice(0, 4) === end.slice(0, 4) ? dayMonth(start) : format.date(start);
  return format.t('report.period', { from, to: format.date(end) });
}

// "Lỗi cảm biến 2 · Thiết bị mất kết nối 1"; loại lạ (enum mới của backend) in nguyên mã thay vì bỏ
export function countsText(counts: Record<string, number>, format: ReportFormat, emptyText: string): string {
  const entries = Object.entries(counts).filter(([, count]) => count > 0);
  if (entries.length === 0) return emptyText;
  return entries.map(([type, count]) => {
    // Từ điển thiếu khoá thì translate trả undefined
    const label: string | undefined = format.t(`alertType.${type}` as Parameters<HealthTranslate>[0]);
    return `${label ?? type} ${count}`;
  }).join(' · ');
}

// Số liệu của 1 Zone theo đúng thứ tự EXPERT-FR-005
export function zoneFacts(section: HealthReportZoneSection, format: ReportFormat): ReportFact[] {
  const { t } = format;
  return [
    { label: t('rd.tempInRange'), value: percent(section.temp_in_range_pct, format) },
    { label: t('rd.humidityInRange'), value: percent(section.humidity_in_range_pct, format) },
    { label: t('rd.autoMode'), value: percent(section.auto_mode_pct, format) },
    { label: t('rd.switches'), value: `${section.misting_switches} / ${section.ventilation_switches}` },
    { label: t('rd.nh3'), value: averageMax(section.nh3_avg, section.nh3_max, format, 'ppm') },
    { label: t('rd.co2'), value: averageMax(section.co2_avg, section.co2_max, format, 'ppm') },
    { label: t('rd.alerts'), value: countsText(section.alerts_by_type, format, t('rd.noAlerts')) },
    { label: t('rd.inferredLabel'), value: t('rd.inferred', { ...section.inferred_alerts }) },
    { label: t('rd.faults'), value: countsText(section.device_faults, format, t('rd.noFaults')) },
  ];
}

// Thời tiết cả kỳ (ANALYTICS-FR-013); null khi không có dữ liệu
export function weatherFacts(report: HouseHealthReport, format: ReportFormat): ReportFact[] | null {
  const weather = report.house_metrics.weather;
  if (!weather) return null;
  const { t } = format;
  return [
    {
      label: t('detail.temperature'),
      value: weather.temperature_min === null || weather.temperature_max === null
        ? NO_VALUE
        : t('detail.temperatureRange', { min: format.number(weather.temperature_min), max: format.number(weather.temperature_max) }),
    },
    { label: t('detail.humidity'), value: percent(weather.humidity_avg, format) },
    { label: t('detail.rain'), value: weather.precipitation_mm === null ? NO_VALUE : `${format.number(weather.precipitation_mm)} mm` },
    { label: t('rd.rainDays'), value: String(weather.rain_days) },
  ];
}

export function incompleteDayCount(report: HouseHealthReport): number {
  return report.house_metrics.return_rate_trend.filter(day => !day.complete).length;
}

// Một dòng mỗi ngày của kỳ, cũ trước; ngày người xem chưa đánh giá không có trạng thái, lý do, đánh giá (BR-31)
export function reportDayRows(report: HouseHealthReport, format: ReportFormat): ReportDayRow[] {
  const { t } = format;
  const returnByDate = new Map(report.house_metrics.return_rate_trend.map(day => [day.date, day]));
  return [...report.days].sort((left, right) => left.date.localeCompare(right.date)).map(day => {
    const flock = returnByDate.get(day.date);
    const rate = flock?.return_rate ?? null;
    const returnRate = rate === null
      ? NO_VALUE
      : `${format.number(rate)} %${flock?.complete ? '' : ` (${t('rd.incomplete')})`}`;
    const ratings = (day.ratings ?? []).map(rating => {
      const verdict = rating.outcome === 'RATED' && rating.rating ? t(`status.${rating.rating}`) : t('detail.skipped');
      const note = rating.note ? ` — ${rating.note}` : '';
      return `${rating.by.full_name ?? NO_VALUE} (${t(`role.${rating.role}`)}): ${verdict}${note}`;
    });
    return {
      date: format.date(day.date),
      status: day.current_status ?? null,
      statusText: day.current_status ? t(`status.${day.current_status}`) : t('ratingState.PENDING'),
      returnRate,
      reasons: (day.current_reasons ?? []).map(reason => formatHealthReason(reason, t, format.number)),
      ratings,
    };
  });
}

// POST /health-reports: from ≤ to ≤ hôm nay (giờ VN), tối đa 31 ngày tính cả 2 đầu — kiểm trước khi gửi
export const MAX_REPORT_DAYS = 31;
export type ReportRangeError = 'create.errRequired' | 'create.errOrder' | 'create.errFuture' | 'create.errRange';

export function reportRangeError(from: string, to: string, today: string): ReportRangeError | null {
  if (!from || !to) return 'create.errRequired';
  if (from > to) return 'create.errOrder';
  if (to > today) return 'create.errFuture';
  const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 + 1;
  return days > MAX_REPORT_DAYS ? 'create.errRange' : null;
}
