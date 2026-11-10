import { describe, expect, it } from 'vitest';
import {
  countsText, reportDayRows, reportPeriod, reportRangeError, zoneFacts, zoneHeader, type ReportFormat,
} from '@/components/features/farm-owner/health/healthReport.utils';
import { NO_VALUE } from '@/constants/display';
import { healthDict } from '@/constants/health.i18n';
import { formatDateTime, formatStandardDate, translate } from '@/lib/i18n';
import type { HouseHealthDay, HouseHealthReport } from '@/types';

const vi: ReportFormat = {
  t: (key, params) => translate(healthDict, 'vi', key, params),
  date: formatStandardDate,
  dateTime: formatDateTime,
  number: value => String(value),
};

const day = (date: string, extra: Partial<HouseHealthDay> = {}): HouseHealthDay => ({
  _id: `day-${date}`, house_id: 'house-1', house_name: 'Nhà A', farm_id: 'farm-1', date, weather: null,
  computed_at: `${date}T12:00:00Z`, my_rating_state: 'RATED', rating_deadline: `${date}T17:00:00Z`, ...extra,
});

const report: HouseHealthReport = {
  _id: 'report-1', farm_id: 'farm-1', house_id: 'house-1', house_name: 'Nhà A', kind: 'WEEKLY',
  period_start: '2026-10-26', period_end: '2026-10-27', generated_at: '2026-11-02T23:00:00Z', has_conclusion: false,
  house_metrics: {
    return_rate_trend: [
      { date: '2026-10-26', return_rate: 92.5, complete: true },
      { date: '2026-10-27', return_rate: 60, complete: false },
    ],
    avg_return_rate: 92.5,
    weather: null,
  },
  zone_sections: [],
  // Backend trả mới trước; ngày 27 người xem chưa đánh giá nên bị che (BR-31)
  days: [
    day('2026-10-27', { my_rating_state: 'PENDING' }),
    day('2026-10-26', {
      current_status: 'WATCH',
      current_reasons: [{ code: 'NOISE_EPISODES', source: 'noise', level: 'SLIGHT', values: { episodes: 2 } }],
      ratings: [{
        _id: 'rating-1', by: { _id: 'user-1', full_name: 'Lan' }, role: 'FARM_OWNER', outcome: 'RATED', rating: 'GOOD',
        note: 'chim về đủ', at: '2026-10-26T13:00:00Z', snapshot: { status: 'WATCH', reasons: [] },
      }],
    }),
  ],
  status_counts: { GOOD: 0, WATCH: 1, ACTION: 0, INSUFFICIENT_DATA: 0 },
  hidden_days: 1,
};

describe('reportDayRows', () => {
  it('xếp ngày cũ trước, ngày chưa đánh giá không có trạng thái, lý do, đánh giá', () => {
    const rows = reportDayRows(report, vi);
    expect(rows.map(row => row.date)).toEqual(['26/10/2026', '27/10/2026']);
    expect(rows[1]).toMatchObject({ status: null, statusText: 'Chưa đánh giá', reasons: [], ratings: [] });
  });

  it('ghi lý do, đánh giá kèm ghi chú và đánh dấu ngày thiếu phiên đếm', () => {
    const [first, second] = reportDayRows(report, vi);
    expect(first.statusText).toBe('Cần theo dõi');
    expect(first.reasons).toEqual(['Tiếng ồn: 2 đợt ồn bất thường (lệch nhẹ)']);
    expect(first.ratings).toEqual(['Lan (Chủ nhà yến): Tốt — chim về đủ']);
    expect(first.returnRate).toBe('92.5 %');
    expect(second.returnRate).toBe('60 % (thiếu phiên)');
  });

  it('không in id nội bộ (EXPERT-FR-013)', () => {
    const text = JSON.stringify(reportDayRows(report, vi));
    for (const id of ['day-2026-10-26', 'user-1', 'rating-1', 'house-1', 'farm-1']) expect(text).not.toContain(id);
  });
});

describe('reportPeriod', () => {
  it('kỳ 1 ngày in 1 ngày, kỳ dài in từ – đến', () => {
    expect(reportPeriod(report, vi)).toBe('26/10 – 27/10/2026');
    expect(reportPeriod({ ...report, period_end: '2026-10-26' }, vi)).toBe('26/10/2026');
    expect(reportPeriod({ ...report, kind: 'MONTHLY', period_start: '2026-10-01', period_end: '2026-10-31' }, vi)).toBe('Tháng 10/2026');
    expect(reportPeriod({ ...report, kind: 'CUSTOM', period_start: '2026-12-28', period_end: '2027-01-03' }, vi)).toBe('28/12/2026 – 03/01/2027');
  });
});

describe('countsText và zoneFacts', () => {
  it('dịch loại cảnh báo, mỗi loại 1 dòng, bỏ loại đếm 0, loại lạ giữ nguyên mã, không có gì thì —', () => {
    expect(countsText({ SENSOR_FAULT: 2, NODE_OFFLINE: 0, NEW_TYPE: 1 }, vi)).toBe('Lỗi cảm biến 2\nNEW_TYPE 1');
    expect(countsText({}, vi)).toBe(NO_VALUE);
  });

  it('số trống in _, cảnh báo suy luận chỉ ghi phần khác 0', () => {
    const facts = zoneFacts({
      zone_id: 'zone-1', zone_name: 'Tầng 1', sample_count: 10, temp_in_range_pct: null, humidity_in_range_pct: 80,
      auto_mode_pct: 100, misting_switches: 3, ventilation_switches: 1, alerts_by_type: {},
      inferred_alerts: { confirmed: 1, dismissed: 2, pending: 0 }, device_faults: {},
      nh3_avg: 5, nh3_max: 9, co2_avg: null, co2_max: null,
    }, vi);
    const byLabel = new Map(facts.map(fact => [fact.label, fact.value]));
    expect(byLabel.get('Nhiệt độ trong ngưỡng')).toBe('_');
    expect(byLabel.get('NH3 TB / cao nhất')).toBe('5 / 9 ppm');
    expect(byLabel.get('Cảnh báo suy luận')).toBe('1 xác nhận\n2 bác bỏ');
    expect(byLabel.get('Cảnh báo')).toBe(NO_VALUE);
    expect(zoneHeader({ zone_name: 'Tầng 1', sample_count: 288 } as Parameters<typeof zoneHeader>[0], vi)).toBe('Tầng 1 (288 mẫu)');
  });
});

describe('reportRangeError', () => {
  const today = '2026-11-03';
  it('theo đúng luật của POST /health-reports', () => {
    expect(reportRangeError('', today, today)).toBe('create.errRequired');
    expect(reportRangeError('2026-11-02', '2026-11-01', today)).toBe('create.errOrder');
    expect(reportRangeError('2026-11-01', '2026-11-04', today)).toBe('create.errFuture');
    expect(reportRangeError('2026-10-04', today, today)).toBe(null);
    expect(reportRangeError('2026-10-03', today, today)).toBe('create.errRange');
  });
});
