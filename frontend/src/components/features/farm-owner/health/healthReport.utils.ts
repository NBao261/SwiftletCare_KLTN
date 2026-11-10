import { formatHealthReason } from '@/components/features/farm-owner/health/healthDay.utils';
import { NO_VALUE } from '@/constants/display';
import type { HealthTranslate } from '@/constants/health.i18n';
import type { HealthRatingValue, HealthReportZoneSection, HealthStatus, HouseHealthReport, HouseHealthReportSummary } from '@/types';

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
  // ISO lúc hệ thống tính trạng thái ngày
  computedAt: string;
  status: HealthStatus | null;
  statusText: string;
  returnRate: string;
  reasons: string[];
  // Chuỗi 1 dòng mỗi người (PDF)
  ratings: string[];
  // Cùng nội dung, tách phần để màn hình hiện badge; rating null = đã bỏ qua
  ratingItems: ReportRatingItem[];
}

export interface ReportRatingItem {
  name: string;
  role: string;
  rating: HealthRatingValue | null;
  note: string | null;
  // ISO lúc đánh giá hoặc bỏ qua
  at: string;
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

// Mỗi loại 1 dòng ("Lỗi cảm biến 2\nThiết bị mất kết nối 1"), bỏ loại đếm 0, không có gì thì "—";
// loại lạ (enum mới của backend) in nguyên mã thay vì bỏ
export function countsText(counts: Record<string, number>, format: ReportFormat): string {
  const entries = Object.entries(counts).filter(([, count]) => count > 0);
  if (entries.length === 0) return NO_VALUE;
  return entries.map(([type, count]) => {
    // Từ điển thiếu khoá thì translate trả undefined
    const label: string | undefined = format.t(`alertType.${type}` as Parameters<HealthTranslate>[0]);
    return `${label ?? type} ${count}`;
  }).join('\n');
}

// Cảnh báo suy luận theo kết luận của chuyên gia: chỉ phần khác 0, mỗi phần 1 dòng, không có gì thì "—"
export function inferredText(inferred: HealthReportZoneSection['inferred_alerts'], format: ReportFormat): string {
  const { t } = format;
  const parts = [
    inferred.confirmed > 0 ? t('rd.inferredConfirmed', { n: inferred.confirmed }) : null,
    inferred.dismissed > 0 ? t('rd.inferredDismissed', { n: inferred.dismissed }) : null,
    inferred.pending > 0 ? t('rd.inferredPending', { n: inferred.pending }) : null,
  ].filter((part): part is string => part !== null);
  return parts.length === 0 ? NO_VALUE : parts.join('\n');
}

// Tiêu đề cột 1 Zone: "Tầng 1 (288 mẫu)"
export function zoneHeader(section: HealthReportZoneSection, format: ReportFormat): string {
  return `${section.zone_name} (${format.t('rd.samples', { n: section.sample_count })})`;
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
    { label: t('rd.alerts'), value: countsText(section.alerts_by_type, format) },
    { label: t('rd.inferredLabel'), value: inferredText(section.inferred_alerts, format) },
    { label: t('rd.faults'), value: countsText(section.device_faults, format) },
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
    const ratingItems: ReportRatingItem[] = (day.ratings ?? []).map(rating => ({
      name: rating.by.full_name ?? NO_VALUE,
      role: t(`role.${rating.role}`),
      rating: rating.outcome === 'RATED' ? rating.rating : null,
      note: rating.note,
      at: rating.at,
    }));
    const ratings = ratingItems.map(item => {
      const verdict = item.rating ? t(`status.${item.rating}`) : t('detail.skipped');
      return `${item.name} (${item.role}): ${verdict}${item.note ? ` — ${item.note}` : ''}`;
    });
    return {
      date: format.date(day.date),
      computedAt: day.computed_at,
      status: day.current_status ?? null,
      statusText: day.current_status ? t(`status.${day.current_status}`) : t('ratingState.PENDING'),
      returnRate,
      reasons: (day.current_reasons ?? []).map(reason => formatHealthReason(reason, t, format.number)),
      ratings,
      ratingItems,
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
