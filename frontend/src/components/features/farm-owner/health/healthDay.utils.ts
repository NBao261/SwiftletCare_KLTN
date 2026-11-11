import type { HealthTranslate } from '@/constants/health.i18n';
import type { HealthReason } from '@/types';

// Nút phụ trắng của trang Sức khỏe (Mức chỉ số, Tải CSV, Đánh giá): rê chuột đổi sang đen chữ trắng
export const HOVER_DARK_BUTTON = 'hover:border-charcoal hover:bg-charcoal hover:text-white';

// Ngày 'YYYY-MM-DD' theo giờ Việt Nam (backend đánh giá theo ngày giờ VN)
export function vietnamDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now);
}

// Cộng/trừ số ngày trên 'YYYY-MM-DD' (tính theo UTC nên không lệch vì múi giờ máy)
export function shiftDate(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

// rating_deadline là đầu ngày thứ 8 (đã hết hạn) — ngày cuối còn chấm được là ngay trước mốc đó
export function lastRatingDay(deadline: string): string {
  return new Date(Date.parse(deadline) - 1).toISOString();
}

// Hạn đánh giá sắp hết: ngày cuối còn chấm là hôm nay hoặc ngày mai (giờ VN) — bảng tô cam dòng hạn
export function isRatingDeadlineNear(deadline: string, now: Date = new Date()): boolean {
  return vietnamDate(new Date(lastRatingDay(deadline))) <= shiftDate(vietnamDate(now), 1);
}

// Số trong lý do: format theo ngôn ngữ; thiếu thì để trống thay vì in "undefined"
type FormatNumber = (value: number) => string;
const numberOf = (value: unknown, format: FormatNumber): string => (typeof value === 'number' ? format(value) : '');
const textOf = (value: unknown): string => (typeof value === 'string' ? value : '');

// Câu của 1 lý do trạng thái ngày theo ngôn ngữ đang chọn (api-spec HealthReason: mã + số liệu)
export function formatHealthReason(reason: HealthReason, t: HealthTranslate, format: FormatNumber): string {
  const values = reason.values ?? {};
  const level = reason.level ? t(`level.${reason.level}`).toLowerCase() : '';
  switch (reason.code) {
    case 'MISSING_DATA': {
      if (reason.source === 'flock') {
        const missing = values.missing;
        if (missing === 'MORNING' || missing === 'EVENING' || missing === 'NO_DEPARTURES') return t(`reason.MISSING_DATA.${missing}`);
        return t('reason.MISSING_DATA.MORNING');
      }
      if (values.no_zones) return t('reason.MISSING_DATA.noZones');
      const zones = Array.isArray(values.zones)
        ? (values.zones as Array<{ zone_name?: unknown; valid_pct?: unknown }>)
          .map(zone => `${textOf(zone.zone_name)} ${numberOf(zone.valid_pct, format)} %`).join(', ')
        : '';
      return t('reason.MISSING_DATA.environment', { pct: numberOf(values.min_pct, format), zones });
    }
    case 'NOT_ASSESSED':
      return t(reason.source === 'air' ? 'reason.NOT_ASSESSED.air' : 'reason.NOT_ASSESSED.noise');
    case 'ENV_IN_RANGE':
      return t('reason.ENV_IN_RANGE', { zone: textOf(values.zone_name), pct: numberOf(values.in_range_pct, format), level });
    case 'AIR_OVER_LIMIT':
      return t('reason.AIR_OVER_LIMIT', { zone: textOf(values.zone_name), hours: numberOf(values.hours, format), level });
    case 'FLOCK_DROP':
      return t('reason.FLOCK_DROP', {
        rate: numberOf(values.return_rate, format),
        drop: numberOf(values.drop_pct, format),
        days: numberOf(values.baseline_days, format),
        average: numberOf(values.baseline_avg, format),
        level,
      });
    case 'FLOCK_NO_BASELINE':
      return t('reason.FLOCK_NO_BASELINE', { days: numberOf(values.min_days, format) });
    case 'NOISE_EPISODES':
      return t('reason.NOISE_EPISODES', { episodes: numberOf(values.episodes, format), level });
    case 'RAIN_DOWNGRADE':
      return t('reason.RAIN_DOWNGRADE', { mm: numberOf(values.mm_per_hour, format) });
    case 'ALL_NORMAL':
    case 'WEATHER_UNAVAILABLE':
    case 'ATTRACTING_STAGE':
      return t(`reason.${reason.code}`);
  }
}
