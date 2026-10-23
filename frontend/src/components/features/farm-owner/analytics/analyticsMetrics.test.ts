import { describe, expect, it } from 'vitest';

import type { BirdCountDailyRecord } from '@/apis/farm-owner/analytics.api';
import {
  correlationStrength,
  groupBucketsByHour,
  mergeBirdCountBuckets,
  sumTodayBirdCounts,
  isOutsideRange,
  metricThresholdRange,
  pearsonCorrelation,
  summarizeWeeklyReturnRates,
} from '@/components/features/farm-owner/analytics/analyticsMetrics';
import type { Thresholds } from '@/types';

const THRESHOLDS: Thresholds = {
  temp_min: 27, temp_max: 31,
  humidity_min: 75, humidity_max: 90,
  light_max: 5, nh3_max: 10, co2_max: 1500,
};

// Bản ghi đếm chim theo ngày cho test
function dailyRecord(date: string, returnRate: number | null): BirdCountDailyRecord {
  return { date, morning_exit: 100, evening_entry: 90, return_rate: returnRate };
}

describe('pearsonCorrelation', () => {
  it('trả 1 với 2 chuỗi cùng chiều tuyệt đối', () => {
    expect(pearsonCorrelation([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
  });

  it('trả -1 với 2 chuỗi ngược chiều', () => {
    expect(pearsonCorrelation([1, 2, 3], [6, 4, 2])).toBeCloseTo(-1);
  });

  it('trả null khi thiếu điểm hoặc một chuỗi không đổi', () => {
    expect(pearsonCorrelation([1], [1])).toBeNull();
    expect(pearsonCorrelation([1, 2, 3], [5, 5, 5])).toBeNull();
  });
});

describe('correlationStrength', () => {
  it('xếp mức theo trị tuyệt đối', () => {
    expect(correlationStrength(-0.8)).toBe('strong');
    expect(correlationStrength(0.5)).toBe('moderate');
    expect(correlationStrength(0.25)).toBe('weak');
    expect(correlationStrength(0.1)).toBe('none');
  });
});

describe('summarizeWeeklyReturnRates', () => {
  it('gộp theo tuần bắt đầu thứ Hai và bỏ ngày chưa có số đếm', () => {
    const weeks = summarizeWeeklyReturnRates([
      dailyRecord('2026-10-19', 80),
      dailyRecord('2026-10-21', 90),
      dailyRecord('2026-10-22', null),
      dailyRecord('2026-10-12', 70),
    ]);
    expect(weeks).toEqual([
      { weekStart: '2026-10-12', averageReturnRate: 70, dayCount: 1 },
      { weekStart: '2026-10-19', averageReturnRate: 85, dayCount: 2 },
    ]);
  });

  it('trả mảng rỗng khi chưa có ngày nào có số đếm', () => {
    expect(summarizeWeeklyReturnRates([dailyRecord('2026-10-19', null)])).toEqual([]);
  });
});

describe('metricThresholdRange và isOutsideRange', () => {
  it('nhiệt độ có 2 đầu ngưỡng', () => {
    const range = metricThresholdRange('temperature', THRESHOLDS);
    expect(isOutsideRange(26.5, range)).toBe(true);
    expect(isOutsideRange(29, range)).toBe(false);
    expect(isOutsideRange(31.5, range)).toBe(true);
  });

  it('NH3 chỉ có trần', () => {
    const range = metricThresholdRange('nh3_ppm', THRESHOLDS);
    expect(range).toEqual({ max: 10 });
    expect(isOutsideRange(0, range)).toBe(false);
    expect(isOutsideRange(12, range)).toBe(true);
  });
});

describe('groupBucketsByHour', () => {
  it('cộng các khoảng 5 phút cùng giờ và xếp giờ cũ trước', () => {
    const firstHour = new Date(2026, 9, 22, 18, 0);
    const secondHour = new Date(2026, 9, 22, 19, 0);
    const bucketAt = (hour: Date, minute: number, entry: number, exit: number) => ({
      bucket_start: new Date(hour.getTime() + minute * 60_000).toISOString(),
      entry_count: entry,
      exit_count: exit,
    });
    const hours = groupBucketsByHour([
      bucketAt(secondHour, 5, 40, 2),
      bucketAt(firstHour, 0, 10, 1),
      bucketAt(firstHour, 55, 20, 3),
    ]);
    expect(hours).toEqual([
      { hourStart: firstHour.toISOString(), entryCount: 30, exitCount: 4 },
      { hourStart: secondHour.toISOString(), entryCount: 40, exitCount: 2 },
    ]);
  });
});

describe('mergeBirdCountBuckets', () => {
  it('cộng các nhà theo cùng mốc thời gian', () => {
    const merged = mergeBirdCountBuckets([
      [{ bucket_start: '2026-10-22T11:00:00.000Z', entry_count: 5, exit_count: 1 }],
      [
        { bucket_start: '2026-10-22T11:00:00.000Z', entry_count: 3, exit_count: 2 },
        { bucket_start: '2026-10-22T10:55:00.000Z', entry_count: 1, exit_count: 0 },
      ],
    ]);
    expect(merged).toEqual([
      { bucket_start: '2026-10-22T10:55:00.000Z', entry_count: 1, exit_count: 0 },
      { bucket_start: '2026-10-22T11:00:00.000Z', entry_count: 8, exit_count: 3 },
    ]);
  });
});

describe('sumTodayBirdCounts', () => {
  // Số đếm hôm nay của 1 nhà cho test
  const house = (netExit: number, netEntry: number, hasBoth: boolean, updatedAt: string | null) => ({
    house_id: 'h', date: '2026-10-22', updated_at: updatedAt,
    morning_entry: 1, morning_exit: netExit + 1, evening_entry: netEntry + 1, evening_exit: 1,
    net_exit: netExit, net_entry: netEntry, return_rate: null,
    has_morning: hasBoth, has_evening: hasBoth,
  });

  it('tính lại tỷ lệ về từ số ròng của các nhà đủ 2 phiên', () => {
    const today = sumTodayBirdCounts([house(100, 90, true, '2026-10-22T10:00:00Z'), house(100, 70, true, '2026-10-22T11:00:00Z'), house(50, 0, false, null)]);
    expect(today.returnRate).toBeCloseTo(80);
    expect(today.morningExit).toBe(101 + 101 + 51);
    expect(today.updatedAt).toBe('2026-10-22T11:00:00Z');
  });

  it('chưa nhà nào đủ 2 phiên thì tỷ lệ về là null', () => {
    expect(sumTodayBirdCounts([house(100, 0, false, null)]).returnRate).toBeNull();
  });
});
