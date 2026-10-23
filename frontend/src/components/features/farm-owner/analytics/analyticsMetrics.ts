import { format, parseISO, startOfHour, startOfISOWeek } from 'date-fns';

import type { BirdCountBucket, BirdCountCurrentResponse, BirdCountDailyRecord } from '@/apis/farm-owner/analytics.api';
import type { CompareMetricKey } from '@/components/features/farm-owner/analytics/analytics.constants';
import type { Thresholds } from '@/types';

export type CorrelationStrength = 'strong' | 'moderate' | 'weak' | 'none';

export interface WeeklyReturnRate {
  weekStart: string;
  averageReturnRate: number;
  dayCount: number;
}

export interface HourlyBirdCount {
  hourStart: string;
  entryCount: number;
  exitCount: number;
}

export interface ThresholdRange {
  min?: number;
  max?: number;
}

// Hệ số tương quan Pearson giữa 2 chuỗi cùng độ dài, null khi thiếu điểm hoặc một chuỗi không đổi
export function pearsonCorrelation(firstValues: number[], secondValues: number[]): number | null {
  const count = Math.min(firstValues.length, secondValues.length);
  if (count < 2) return null;

  let firstSum = 0;
  let secondSum = 0;
  for (let index = 0; index < count; index += 1) {
    firstSum += firstValues[index];
    secondSum += secondValues[index];
  }
  const firstMean = firstSum / count;
  const secondMean = secondSum / count;

  let covariance = 0;
  let firstVariance = 0;
  let secondVariance = 0;
  for (let index = 0; index < count; index += 1) {
    const firstDelta = firstValues[index] - firstMean;
    const secondDelta = secondValues[index] - secondMean;
    covariance += firstDelta * secondDelta;
    firstVariance += firstDelta * firstDelta;
    secondVariance += secondDelta * secondDelta;
  }
  if (firstVariance === 0 || secondVariance === 0) return null;
  return covariance / Math.sqrt(firstVariance * secondVariance);
}

// Mức tương quan theo trị tuyệt đối của r
export function correlationStrength(coefficient: number): CorrelationStrength {
  const absolute = Math.abs(coefficient);
  if (absolute >= 0.7) return 'strong';
  if (absolute >= 0.4) return 'moderate';
  if (absolute >= 0.2) return 'weak';
  return 'none';
}

// Gộp tỷ lệ chim về theo tuần (thứ Hai đầu tuần), bỏ ngày chưa có số đếm, xếp tuần cũ trước
export function summarizeWeeklyReturnRates(records: BirdCountDailyRecord[]): WeeklyReturnRate[] {
  const weeks = new Map<string, { total: number; dayCount: number }>();
  for (const record of records) {
    if (record.return_rate === null) continue;
    const weekStart = format(startOfISOWeek(parseISO(record.date.slice(0, 10))), 'yyyy-MM-dd');
    const week = weeks.get(weekStart) ?? { total: 0, dayCount: 0 };
    week.total += record.return_rate;
    week.dayCount += 1;
    weeks.set(weekStart, week);
  }

  const result: WeeklyReturnRate[] = [];
  for (const [weekStart, week] of weeks) {
    result.push({ weekStart, averageReturnRate: week.total / week.dayCount, dayCount: week.dayCount });
  }
  return result.sort((first, second) => first.weekStart.localeCompare(second.weekStart));
}

// Khoảng ngưỡng của 1 chỉ số theo cấu hình Zone (nhiệt, ẩm có 2 đầu; ánh sáng, NH3, CO2 chỉ có trần)
export function metricThresholdRange(metric: CompareMetricKey, thresholds: Thresholds): ThresholdRange {
  if (metric === 'temperature') return { min: thresholds.temp_min, max: thresholds.temp_max };
  if (metric === 'humidity') return { min: thresholds.humidity_min, max: thresholds.humidity_max };
  if (metric === 'light_lux') return { max: thresholds.light_max };
  if (metric === 'nh3_ppm') return { max: thresholds.nh3_max };
  return { max: thresholds.co2_max };
}

// Giá trị nằm ngoài khoảng ngưỡng
export function isOutsideRange(value: number, range: ThresholdRange): boolean {
  if (range.min !== undefined && value < range.min) return true;
  if (range.max !== undefined && value > range.max) return true;
  return false;
}

// Gộp số đếm 5 phút thành từng giờ theo giờ máy (Việt Nam), xếp giờ cũ trước
export function groupBucketsByHour(buckets: BirdCountBucket[]): HourlyBirdCount[] {
  const hours = new Map<string, HourlyBirdCount>();
  for (const bucket of buckets) {
    const hourStart = startOfHour(parseISO(bucket.bucket_start)).toISOString();
    const hour = hours.get(hourStart) ?? { hourStart, entryCount: 0, exitCount: 0 };
    hour.entryCount += bucket.entry_count;
    hour.exitCount += bucket.exit_count;
    hours.set(hourStart, hour);
  }
  return [...hours.values()].sort((first, second) => first.hourStart.localeCompare(second.hourStart));
}

// Cộng số đếm 5 phút của nhiều nhà yến theo cùng mốc thời gian, xếp mốc cũ trước
export function mergeBirdCountBuckets(lists: BirdCountBucket[][]): BirdCountBucket[] {
  const byStart = new Map<string, BirdCountBucket>();
  for (const list of lists) {
    for (const bucket of list) {
      const merged = byStart.get(bucket.bucket_start) ?? { bucket_start: bucket.bucket_start, entry_count: 0, exit_count: 0 };
      merged.entry_count += bucket.entry_count;
      merged.exit_count += bucket.exit_count;
      byStart.set(bucket.bucket_start, merged);
    }
  }
  return [...byStart.values()].sort((first, second) => first.bucket_start.localeCompare(second.bucket_start));
}

export interface TodayBirdCount {
  morningExit: number;
  eveningExit: number;
  morningEntry: number;
  eveningEntry: number;
  // Số ròng chim về chia số ròng chim ra của các nhà đã đủ 2 phiên, null khi chưa nhà nào đủ
  returnRate: number | null;
  updatedAt: string | null;
}

// Cộng số đếm hôm nay của nhiều nhà yến; tỷ lệ chim về tính lại từ số ròng như backend (net_entry / net_exit × 100)
export function sumTodayBirdCounts(list: BirdCountCurrentResponse[]): TodayBirdCount {
  const today: TodayBirdCount = { morningExit: 0, eveningExit: 0, morningEntry: 0, eveningEntry: 0, returnRate: null, updatedAt: null };
  let netExit = 0;
  let netEntry = 0;
  for (const house of list) {
    today.morningExit += house.morning_exit;
    today.eveningExit += house.evening_exit;
    today.morningEntry += house.morning_entry;
    today.eveningEntry += house.evening_entry;
    if (house.has_morning && house.has_evening) {
      netExit += house.net_exit;
      netEntry += house.net_entry;
    }
    if (house.updated_at && (!today.updatedAt || house.updated_at > today.updatedAt)) today.updatedAt = house.updated_at;
  }
  if (netExit > 0) today.returnRate = (netEntry / netExit) * 100;
  return today;
}
