import { describe, expect, it } from 'vitest';

import {
  checkNestAmount, environmentSummary, groupHarvests, harvestTotalsByPeriod, harvestYears, nestTypeBreakdown, summarizeHarvestOverview,
} from '@/components/features/farm-owner/harvest/harvestMetrics';
import type { HarvestBatch } from '@/types';

// Đợt thu giả chỉ đủ các trường hàm tính toán đọc
function batch(harvestDate: string, weightGrams: number, nestCount: number): HarvestBatch {
  return { harvest_date: harvestDate, weight_grams: weightGrams, nest_count: nestCount, nest_type: 'RAW' } as HarvestBatch;
}

const NOW = new Date('2026-10-20T03:00:00Z');

describe('summarizeHarvestOverview', () => {
  const houseIdByZone = new Map([['z1', 'h1'], ['z2', 'h2']]);
  // Lần thu giả: zone, ngày, gram, số tổ
  const run = (key: string, zoneId: string, date: string, grams: number, nests: number) =>
    groupHarvests([{ ...batch(date, grams, nests), _id: key, zone_id: zoneId, nest_type: 'RAW' } as HarvestBatch])[0];

  it('lần thu gần nhất so với lần liền trước; quý và năm hiện tại theo giờ VN', () => {
    const groups = [
      run('g1', 'z1', '2026-10-18T00:00:00Z', 1200, 120), // quý 4/2026
      run('g2', 'z2', '2026-09-30T18:00:00Z', 800, 80), // 01/10 giờ VN → quý 4
      run('g3', 'z1', '2026-08-10T00:00:00Z', 1000, 100), // quý 3
      run('g4', 'z1', '2025-05-10T00:00:00Z', 1500, 150), // năm trước
    ];
    const overview = summarizeHarvestOverview(groups, NOW, houseIdByZone);
    expect(overview.latest?.kilograms).toBe(1.2);
    expect(overview.latest?.changePercent).toBe(50);
    expect(overview.quarter).toMatchObject({ quarter: 4, year: 2026, kilograms: 2, nests: 200, houses: 2, runs: 2, changePercent: 100 });
    expect(overview.year).toMatchObject({ year: 2026, kilograms: 3, houses: 2, runs: 3, changePercent: 100 });
  });

  it('chưa có kỳ trước hoặc chưa đủ 2 lần thu thì không so sánh, không bịa số', () => {
    const overview = summarizeHarvestOverview([run('g1', 'z1', '2026-10-18T00:00:00Z', 1200, 120)], NOW, houseIdByZone);
    expect(overview.latest?.changePercent).toBeNull();
    expect(overview.quarter.changePercent).toBeNull();
    expect(overview.year.changePercent).toBeNull();
    expect(summarizeHarvestOverview([], NOW, houseIdByZone).latest).toBeNull();
  });
});

describe('harvestTotalsByPeriod', () => {
  const batches = [
    batch('2026-01-10T00:00:00Z', 1500, 15),
    batch('2026-02-20T00:00:00Z', 500, 5),
    batch('2026-11-20T00:00:00Z', 1000, 10),
    batch('2025-01-10T00:00:00Z', 9000, 90),
  ];

  it('theo tháng: 12 cột của đúng năm', () => {
    const totals = harvestTotalsByPeriod(batches, 'month', 2026);
    expect(totals.buckets).toHaveLength(12);
    expect(totals.kilograms[0]).toBe(1.5);
    expect(totals.nests[1]).toBe(5);
    expect(totals.batches[0]).toBe(1);
  });

  it('theo quý: tháng 1–2 vào quý 1, tháng 11 vào quý 4', () => {
    const totals = harvestTotalsByPeriod(batches, 'quarter', 2026);
    expect(totals.buckets).toEqual([1, 2, 3, 4]);
    expect(totals.kilograms[0]).toBe(2);
    expect(totals.nests[3]).toBe(10);
    expect(totals.batches[0]).toBe(2);
  });

  it('theo năm: mỗi năm có dữ liệu 1 cột, năm cũ trước', () => {
    const totals = harvestTotalsByPeriod(batches, 'year', 2026);
    expect(totals.buckets).toEqual([2025, 2026]);
    expect(totals.kilograms).toEqual([9, 3]);
    expect(totals.batches).toEqual([1, 3]);
  });

  it('tách kg theo loại tổ trong từng cột', () => {
    const typed = [
      { ...batch('2026-01-10T00:00:00Z', 1500, 15), nest_type: 'RAW' },
      { ...batch('2026-01-20T00:00:00Z', 500, 5), nest_type: 'PREMIUM' },
    ] as HarvestBatch[];
    const totals = harvestTotalsByPeriod(typed, 'month', 2026);
    expect(totals.kilogramsByType.RAW[0]).toBe(1.5);
    expect(totals.kilogramsByType.PREMIUM[0]).toBe(0.5);
    expect(totals.kilogramsByType.CLEANED[0]).toBe(0);
    expect(totals.nestsByType.PREMIUM[0]).toBe(5);
  });
});

describe('harvestYears', () => {
  it('gồm năm hiện tại và các năm có dữ liệu, mới nhất trước', () => {
    expect(harvestYears([batch('2024-05-01T00:00:00Z', 1, 1)], 2026)).toEqual([2026, 2024]);
  });
});

describe('environmentSummary', () => {
  it('trả nhiệt + ẩm khi đủ dữ liệu, null khi thiếu hoặc chưa đủ 7 ngày', () => {
    expect(environmentSummary({ avg_temperature: 29.5, avg_humidity: 82 })).toEqual({ temperature: 29.5, humidity: 82 });
    expect(environmentSummary({ avg_temperature: 29.5, avg_humidity: 82, insufficient_data: true })).toBeNull();
    expect(environmentSummary({ avg_temperature: 29.5 })).toBeNull();
    expect(environmentSummary(undefined)).toBeNull();
  });
});

describe('nestTypeBreakdown', () => {
  it('tính kg và % theo loại tổ, loại chưa có đợt nào vẫn hiện 0', () => {
    const batches = [
      { ...batch('2026-10-01T00:00:00Z', 3000, 30), nest_type: 'RAW' },
      { ...batch('2026-10-02T00:00:00Z', 1000, 10), nest_type: 'CLEANED' },
    ] as HarvestBatch[];
    const breakdown = nestTypeBreakdown(batches, ['RAW', 'CLEANED', 'PREMIUM']);
    expect(breakdown.totalKilograms).toBe(4);
    expect(breakdown.shares.map(share => share.percent)).toEqual([75, 25, 0]);
  });

  it('chưa có đợt nào thì tổng 0 và mọi tỉ lệ 0', () => {
    const breakdown = nestTypeBreakdown([], ['RAW']);
    expect(breakdown.totalKilograms).toBe(0);
    expect(breakdown.shares[0].percent).toBe(0);
  });
});

describe('checkNestAmount', () => {
  it('để trống cả 2 ô là không thu, không báo lỗi', () => {
    expect(checkNestAmount('', '')).toMatchObject({ isFilled: false, error: null, nests: 0, grams: 0 });
  });

  it('đủ số tổ và trọng lượng dương thì được ghi', () => {
    expect(checkNestAmount('120', '850.5')).toMatchObject({ isFilled: true, error: null, nests: 120, grams: 850.5 });
  });

  it('chặn số âm, số tổ lẻ và dòng chỉ điền 1 ô', () => {
    expect(checkNestAmount('-5', '100').error).toBe('negative');
    expect(checkNestAmount('5', '-1').error).toBe('negative');
    expect(checkNestAmount('2.5', '100').error).toBe('nestsNotInteger');
    expect(checkNestAmount('10', '').error).toBe('incomplete');
    expect(checkNestAmount('', '300').error).toBe('incomplete');
  });
});

describe('groupHarvests', () => {
  it('gom các loại yến cùng zone + ngày thành 1 lần thu, cộng tổng và xếp loại trắng → hồng → huyết', () => {
    const batches = [
      { ...batch('2026-10-20T00:00:00Z', 60, 40), _id: 'b1', zone_id: 'z1', nest_type: 'PREMIUM' },
      { ...batch('2026-10-20T00:00:00Z', 4000, 1000), _id: 'b2', zone_id: 'z1', nest_type: 'RAW' },
      { ...batch('2026-10-18T00:00:00Z', 500, 50), _id: 'b3', zone_id: 'z1', nest_type: 'CLEANED' },
    ] as HarvestBatch[];
    const groups = groupHarvests(batches);
    expect(groups).toHaveLength(2);
    expect(groups[0].nestTypes).toEqual(['RAW', 'PREMIUM']);
    expect(groups[0].nest_count).toBe(1040);
    expect(groups[0].weight_grams).toBe(4060);
  });

  it('khác zone thì là lần thu khác dù cùng ngày', () => {
    const batches = [
      { ...batch('2026-10-20T00:00:00Z', 100, 10), _id: 'b1', zone_id: 'z1', nest_type: 'RAW' },
      { ...batch('2026-10-20T00:00:00Z', 50, 5), _id: 'b2', zone_id: 'z1', nest_type: 'CLEANED' },
      { ...batch('2026-10-20T00:00:00Z', 70, 7), _id: 'b3', zone_id: 'z2', nest_type: 'RAW' },
    ] as HarvestBatch[];
    expect(groupHarvests(batches).map(group => group.batches.length)).toEqual([2, 1]);
  });
});
