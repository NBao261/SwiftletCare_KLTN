import { describe, expect, it } from 'vitest';
import { formatHealthReason, isRatingDeadlineNear, lastRatingDay, shiftDate, vietnamDate } from '@/components/common/healthDay.utils';
import { healthDict, type HealthTranslate } from '@/constants/health.i18n';
import { formatStandardDate, translate } from '@/lib/i18n';
import type { HealthReason } from '@/types';

const vi: HealthTranslate = (key, params) => translate(healthDict, 'vi', key, params);
const en: HealthTranslate = (key, params) => translate(healthDict, 'en', key, params);
const plain = (value: number) => String(value);
const reason = (code: HealthReason['code'], source: HealthReason['source'] = null, values = {}, level: HealthReason['level'] = null): HealthReason =>
  ({ code, source, level, values });

describe('formatHealthReason', () => {
  it('đổi mã + số liệu thành câu theo ngôn ngữ, kèm mức', () => {
    const drop = reason('FLOCK_DROP', 'flock', { return_rate: 70, drop_pct: 30, baseline_avg: 100, baseline_days: 3 }, 'CLEAR');
    expect(formatHealthReason(drop, vi, plain)).toBe('Đàn chim: tỷ lệ chim về 70 %, giảm 30 % so với trung bình 3 ngày trước (100 %) (lệch rõ)');
    expect(formatHealthReason(drop, en, plain)).toBe('Flock: return rate 70 %, 30 % below the mean of the 3 previous days (100 %) (clear)');
  });

  it('thiếu dữ liệu: phân biệt môi trường (theo Zone) và đàn chim (theo phiên)', () => {
    const env = reason('MISSING_DATA', 'environment', { min_pct: 80, zones: [{ zone_name: 'Tầng 1', valid_pct: 42.5 }] });
    expect(formatHealthReason(env, vi, plain)).toBe('Thiếu dữ liệu môi trường: mẫu nhiệt độ, độ ẩm hợp lệ dưới 80 % (Tầng 1 42.5 %)');
    expect(formatHealthReason(reason('MISSING_DATA', 'environment', { no_zones: true }), en, plain)).toBe('Missing environment data: the house has no zone');
    expect(formatHealthReason(reason('MISSING_DATA', 'flock', { missing: 'EVENING' }), vi, plain)).toBe('Thiếu dữ liệu đàn chim: thiếu phiên chiều');
  });

  it('nguồn tuỳ chọn không xét, thời tiết, mưa', () => {
    expect(formatHealthReason(reason('NOT_ASSESSED', 'air'), en, plain)).toBe('Air quality not assessed (missing NH3, CO2 samples)');
    expect(formatHealthReason(reason('NOT_ASSESSED', 'noise'), vi, plain)).toBe('Chưa xét tiếng ồn (thiếu mẫu độ ồn)');
    expect(formatHealthReason(reason('WEATHER_UNAVAILABLE'), vi, plain)).toBe('Không có dữ liệu thời tiết');
    // BR-46 — nhà dẫn dụ: không xét đàn chim
    expect(formatHealthReason(reason('ATTRACTING_STAGE', 'flock'), vi, plain)).toBe('Đàn chim: nhà đang ở giai đoạn dẫn dụ, không xét tỷ lệ chim về');
    expect(formatHealthReason(reason('ATTRACTING_STAGE', 'flock'), en, plain)).toBe('Flock: the house is in the attracting stage, the return rate is not assessed');
    expect(formatHealthReason(reason('RAIN_DOWNGRADE', null, { mm_per_hour: 1 }), vi, plain))
      .toBe('Mưa từ 1 mm/giờ trùng phiên đếm và đợt ồn nên hạ từ Cần xử lý xuống Cần theo dõi');
  });

  it('thiếu số liệu thì để trống, không in "undefined"', () => {
    expect(formatHealthReason(reason('NOISE_EPISODES', 'noise', {}, 'SLIGHT'), vi, plain)).not.toContain('undefined');
  });
});

describe('ngày giờ Việt Nam', () => {
  it('17:30 UTC đã là ngày hôm sau ở Việt Nam', () => {
    expect(vietnamDate(new Date('2026-11-01T17:30:00Z'))).toBe('2026-11-02');
  });

  it('lùi qua đầu tháng', () => {
    expect(shiftDate('2026-11-02', -6)).toBe('2026-10-27');
  });

  it('hạn chấm là 00:00 ngày thứ 8 (giờ VN), ngày cuối còn chấm là ngày trước đó', () => {
    // ngày 01/11 → hạn 00:00 09/11 giờ VN = 17:00 08/11 UTC
    expect(formatStandardDate(lastRatingDay('2026-11-08T17:00:00.000Z'))).toBe('08/11/2026');
  });

  it('hạn sắp hết khi ngày cuối còn chấm là hôm nay hoặc ngày mai (giờ VN)', () => {
    const deadline = '2026-11-08T17:00:00.000Z'; // ngày cuối 08/11
    expect(isRatingDeadlineNear(deadline, new Date('2026-11-06T05:00:00Z'))).toBe(false); // 06/11: còn 2 ngày
    expect(isRatingDeadlineNear(deadline, new Date('2026-11-06T17:30:00Z'))).toBe(true); // đã 07/11 ở VN
    expect(isRatingDeadlineNear(deadline, new Date('2026-11-08T16:00:00Z'))).toBe(true); // 23:00 ngày 08/11
  });
});
