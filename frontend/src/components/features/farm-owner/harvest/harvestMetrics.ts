import { vnYearMonth } from '@/lib/helpers';
import { NEST_TYPES } from '@/components/features/farm-owner/harvest/harvest.constants';
import type { EnvSnapshot, HarvestBatch, NestType } from '@/types';

const GRAMS_PER_KILOGRAM = 1000;
const MONTHS_PER_YEAR = 12;
const QUARTERS_PER_YEAR = 4;
const MONTHS_PER_QUARTER = 3;

// % thay đổi so với giá trị trước; giá trị trước bằng 0 thì không so được
function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

// Số liệu gộp của 1 khoảng thời gian (quý hoặc năm)
export interface PeriodSummary {
  kilograms: number;
  nests: number;
  // Số nhà yến khác nhau có lần thu trong khoảng
  houses: number;
  // Số lần thu (nhiều loại yến cùng lần tính là 1)
  runs: number;
  // % kg so với khoảng liền trước; khoảng trước không thu thì null
  changePercent: number | null;
}

export interface HarvestOverview {
  // Lần thu mới nhất + % kg so với lần liền trước (chưa đủ 2 lần thì null)
  latest: { group: HarvestGroup; kilograms: number; changePercent: number | null } | null;
  quarter: PeriodSummary & { quarter: number; year: number };
  year: PeriodSummary & { year: number };
}

// Cộng dồn 1 khoảng: kg, số tổ, số lần thu, tập nhà yến
interface PeriodAccumulator { grams: number; nests: number; runs: number; houseIds: Set<string> }
const emptyAccumulator = (): PeriodAccumulator => ({ grams: 0, nests: 0, runs: 0, houseIds: new Set() });

function addRun(accumulator: PeriodAccumulator, group: HarvestGroup, houseId: string | undefined): void {
  accumulator.grams += group.weight_grams;
  accumulator.nests += group.nest_count;
  accumulator.runs += 1;
  if (houseId) accumulator.houseIds.add(houseId);
}

function toSummary(current: PeriodAccumulator, previous: PeriodAccumulator): PeriodSummary {
  return {
    kilograms: current.grams / GRAMS_PER_KILOGRAM,
    nests: current.nests,
    houses: current.houseIds.size,
    runs: current.runs,
    changePercent: percentChange(current.grams, previous.grams),
  };
}

// 3 thẻ tổng quan theo tầng quản lý (giờ VN): lần thu gần nhất · quý hiện tại so với quý trước · năm nay so với năm trước
export function summarizeHarvestOverview(groups: HarvestGroup[], now: Date, houseIdByZone: Map<string, string>): HarvestOverview {
  const current = vnYearMonth(now);
  const currentQuarter = Math.floor((current.month - 1) / MONTHS_PER_QUARTER) + 1;
  const previousQuarter = currentQuarter === 1 ? { year: current.year - 1, quarter: QUARTERS_PER_YEAR } : { year: current.year, quarter: currentQuarter - 1 };
  const quarterNow = emptyAccumulator();
  const quarterBefore = emptyAccumulator();
  const yearNow = emptyAccumulator();
  const yearBefore = emptyAccumulator();
  let latest: HarvestGroup | undefined;
  let secondLatest: HarvestGroup | undefined;

  for (const group of groups) {
    // Giữ 2 lần thu mới nhất trong 1 lượt duyệt
    if (!latest || group.harvest_date > latest.harvest_date) {
      secondLatest = latest;
      latest = group;
    } else if (!secondLatest || group.harvest_date > secondLatest.harvest_date) {
      secondLatest = group;
    }
    const harvestMonth = vnYearMonth(group.harvest_date);
    const quarter = Math.floor((harvestMonth.month - 1) / MONTHS_PER_QUARTER) + 1;
    const houseId = houseIdByZone.get(group.zone_id);
    if (harvestMonth.year === current.year) addRun(yearNow, group, houseId);
    if (harvestMonth.year === current.year - 1) addRun(yearBefore, group, houseId);
    if (harvestMonth.year === current.year && quarter === currentQuarter) addRun(quarterNow, group, houseId);
    if (harvestMonth.year === previousQuarter.year && quarter === previousQuarter.quarter) addRun(quarterBefore, group, houseId);
  }

  return {
    latest: latest
      ? {
        group: latest,
        kilograms: latest.weight_grams / GRAMS_PER_KILOGRAM,
        changePercent: secondLatest ? percentChange(latest.weight_grams, secondLatest.weight_grams) : null,
      }
      : null,
    quarter: { ...toSummary(quarterNow, quarterBefore), quarter: currentQuarter, year: current.year },
    year: { ...toSummary(yearNow, yearBefore), year: current.year },
  };
}

// Mốc thời gian gom số liệu biểu đồ
export type HarvestPeriod = 'month' | 'quarter' | 'year';

export interface PeriodTotals {
  // Số thứ tự của từng cột: tháng 1–12, quý 1–4, hoặc năm
  buckets: number[];
  kilograms: number[];
  nests: number[];
  // Số lần thu trong từng cột (nhiều loại yến cùng lần tính là 1), hiện ở tooltip
  batches: number[];
  // Kg và số tổ của từng loại tổ trong từng cột, để xếp chồng theo loại
  kilogramsByType: Record<NestType, number[]>;
  nestsByType: Record<NestType, number[]>;
}

// Mảng số 0 cho từng loại tổ
function emptyByType(length: number): Record<NestType, number[]> {
  return {
    RAW: new Array<number>(length).fill(0),
    CLEANED: new Array<number>(length).fill(0),
    PREMIUM: new Array<number>(length).fill(0),
  };
}

// Tổng kg, số tổ, số đợt theo tháng / quý của 1 năm hoặc theo từng năm có dữ liệu (giờ VN), tách thêm theo loại tổ
export function harvestTotalsByPeriod(batches: HarvestBatch[], period: HarvestPeriod, year: number): PeriodTotals {
  const buckets = period === 'year'
    ? [...new Set(batches.map(batch => vnYearMonth(batch.harvest_date).year))].sort((first, second) => first - second)
    : Array.from({ length: period === 'month' ? MONTHS_PER_YEAR : QUARTERS_PER_YEAR }, (_, index) => index + 1);
  const indexByBucket = new Map(buckets.map((bucket, index) => [bucket, index]));
  const kilograms = new Array<number>(buckets.length).fill(0);
  const nests = new Array<number>(buckets.length).fill(0);
  // Đếm số lần thu (nhóm) khác nhau trong từng cột, không đếm từng loại yến
  const groupKeysByBucket = buckets.map(() => new Set<string>());
  const kilogramsByType = emptyByType(buckets.length);
  const nestsByType = emptyByType(buckets.length);

  for (const batch of batches) {
    const harvestMonth = vnYearMonth(batch.harvest_date);
    if (period !== 'year' && harvestMonth.year !== year) continue;
    const bucket = period === 'year'
      ? harvestMonth.year
      : period === 'month' ? harvestMonth.month : Math.floor((harvestMonth.month - 1) / MONTHS_PER_QUARTER) + 1;
    const index = indexByBucket.get(bucket);
    if (index === undefined) continue;
    const batchKilograms = batch.weight_grams / GRAMS_PER_KILOGRAM;
    kilograms[index] += batchKilograms;
    nests[index] += batch.nest_count;
    groupKeysByBucket[index].add(harvestGroupKey(batch));
    kilogramsByType[batch.nest_type][index] += batchKilograms;
    nestsByType[batch.nest_type][index] += batch.nest_count;
  }
  return { buckets, kilograms, nests, batches: groupKeysByBucket.map(keys => keys.size), kilogramsByType, nestsByType };
}

// Các năm có đợt thu (luôn gồm năm hiện tại), mới nhất trước — dùng cho ô chọn năm
export function harvestYears(batches: HarvestBatch[], currentYear: number): number[] {
  const years = new Set<number>([currentYear]);
  for (const batch of batches) years.add(vnYearMonth(batch.harvest_date).year);
  return [...years].sort((first, second) => second - first);
}

export interface NestTypeShare {
  nestType: NestType;
  kilograms: number;
  // Tỉ lệ % theo khối lượng trên tổng mọi đợt; tổng bằng 0 thì 0
  percent: number;
}

// Phân bổ khối lượng theo loại tổ (trắng / hồng / huyết) trên mọi đợt thu, giữ đủ 3 loại theo thứ tự cố định
export function nestTypeBreakdown(batches: HarvestBatch[], nestTypes: NestType[]): { totalKilograms: number; shares: NestTypeShare[] } {
  const kilogramsByType = new Map<NestType, number>();
  let totalKilograms = 0;
  for (const batch of batches) {
    const kilograms = batch.weight_grams / GRAMS_PER_KILOGRAM;
    kilogramsByType.set(batch.nest_type, (kilogramsByType.get(batch.nest_type) ?? 0) + kilograms);
    totalKilograms += kilograms;
  }
  const shares = nestTypes.map(nestType => {
    const kilograms = kilogramsByType.get(nestType) ?? 0;
    return { nestType, kilograms, percent: totalKilograms > 0 ? (kilograms / totalKilograms) * 100 : 0 };
  });
  return { totalKilograms, shares };
}

// Lỗi của 1 dòng loại yến trong form tạo đợt thu
export type NestAmountError = 'negative' | 'nestsNotInteger' | 'incomplete';

export interface NestAmountCheck {
  nests: number;
  grams: number;
  // Có số liệu thu (cả số tổ và trọng lượng > 0)
  isFilled: boolean;
  error: NestAmountError | null;
}

// Kiểm 1 dòng loại yến: để trống = không thu (tính là 0, không bắt gõ số 0); cấm số âm, số tổ lẻ, hoặc chỉ điền 1 trong 2 ô
export function checkNestAmount(nestsText: string, gramsText: string): NestAmountCheck {
  const nests = nestsText.trim() === '' ? 0 : Number(nestsText);
  const grams = gramsText.trim() === '' ? 0 : Number(gramsText);
  if (Number.isNaN(nests) || Number.isNaN(grams) || nests < 0 || grams < 0) return { nests, grams, isFilled: false, error: 'negative' };
  if (!Number.isInteger(nests)) return { nests, grams, isFilled: false, error: 'nestsNotInteger' };
  if (nests === 0 && grams === 0) return { nests, grams, isFilled: false, error: null };
  if (nests === 0 || grams === 0) return { nests, grams, isFilled: false, error: 'incomplete' };
  return { nests, grams, isFilled: true, error: null };
}

// Nhiệt độ + độ ẩm TB 7 ngày trước thu cho cột bảng; thiếu số hoặc chưa đủ dữ liệu thì null
export function environmentSummary(snapshot: EnvSnapshot | undefined): { temperature: number; humidity: number } | null {
  if (!snapshot || snapshot.insufficient_data) return null;
  if (snapshot.avg_temperature === undefined || snapshot.avg_humidity === undefined) return null;
  return { temperature: snapshot.avg_temperature, humidity: snapshot.avg_humidity };
}

// 1 lần thu: các đợt (mỗi loại yến 1 đợt) cùng zone + cùng ngày thu — backend lưu mỗi loại 1 đợt, không có mã nhóm
export interface HarvestGroup {
  key: string;
  zone_id: string;
  harvest_date: string;
  // Đợt của từng loại, theo thứ tự yến trắng → hồng → huyết
  batches: HarvestBatch[];
  nestTypes: NestType[];
  nest_count: number;
  weight_grams: number;
  env_snapshot?: EnvSnapshot;
  product_images: string[];
}

// Khoá nhóm của 1 đợt
export function harvestGroupKey(batch: Pick<HarvestBatch, 'zone_id' | 'harvest_date'>): string {
  return `${batch.zone_id}|${batch.harvest_date}`;
}

// Gom các đợt thành lần thu, giữ thứ tự xuất hiện của danh sách gốc (API đã sắp ngày mới nhất trước)
export function groupHarvests(batches: HarvestBatch[]): HarvestGroup[] {
  const groupByKey = new Map<string, HarvestBatch[]>();
  for (const batch of batches) {
    const key = harvestGroupKey(batch);
    const members = groupByKey.get(key);
    if (members) members.push(batch);
    else groupByKey.set(key, [batch]);
  }
  const typeOrder = new Map(NEST_TYPES.map((nestType, index) => [nestType, index]));
  return [...groupByKey.entries()].map(([key, members]) => {
    const sorted = [...members].sort((first, second) => (typeOrder.get(first.nest_type) ?? 0) - (typeOrder.get(second.nest_type) ?? 0));
    const first = sorted[0];
    return {
      key,
      zone_id: first.zone_id,
      harvest_date: first.harvest_date,
      batches: sorted,
      nestTypes: sorted.map(batch => batch.nest_type),
      nest_count: sorted.reduce((sum, batch) => sum + batch.nest_count, 0),
      weight_grams: sorted.reduce((sum, batch) => sum + batch.weight_grams, 0),
      env_snapshot: first.env_snapshot,
      product_images: first.product_images,
    };
  });
}
