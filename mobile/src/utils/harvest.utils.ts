import type { HarvestBatch, NestType } from '@/types'
import { getVietnamDate } from '@/utils/date.utils'

export interface MonthYield {
  kg: number
  nests: number
  // Số lần thu: nhiều loại yến cùng zone, cùng ngày tính là 1 lần — như web (groupHarvests)
  batches: number
  // Lần thu gần nhất trong tháng
  lastHarvestAt: string
}

const GRAMS_PER_KG = 1000

// Năm-tháng theo giờ Việt Nam, dạng "2026-11"
function getVietnamMonth(time: number): string {
  return getVietnamDate(time).slice(0, 7)
}

// Sản lượng tháng này (giờ Việt Nam) của một nhà: cộng các đợt thu của các zone thuộc nhà, bỏ đợt đã xoá mềm
// (HARVEST-FR-005). Cách tính như ô "Sản lượng tháng" của web; tháng chưa thu thì null
export function summarizeHouseMonthYield(
  batches: HarvestBatch[],
  zoneIds: readonly string[],
  now: number = Date.now(),
): MonthYield | null {
  const zoneIdSet = new Set(zoneIds)
  const month = getVietnamMonth(now)
  const runKeys = new Set<string>()
  let grams = 0
  let nests = 0
  let lastHarvestAt: string | null = null

  for (const batch of batches) {
    if (batch.is_deleted || !zoneIdSet.has(batch.zone_id)) continue
    if (getVietnamMonth(Date.parse(batch.harvest_date)) !== month) continue
    grams += batch.weight_grams
    nests += batch.nest_count
    runKeys.add(`${batch.zone_id}|${batch.harvest_date}`)
    if (!lastHarvestAt || batch.harvest_date > lastHarvestAt) lastHarvestAt = batch.harvest_date
  }

  if (!lastHarvestAt) return null
  return { kg: grams / GRAMS_PER_KG, nests, batches: runKeys.size, lastHarvestAt }
}

// Ba loại tổ theo thứ tự xếp chồng từ dưới lên, như web: yến trắng → hồng → huyết
export const NEST_TYPES: readonly NestType[] = ['RAW', 'CLEANED', 'PREMIUM']

// Gộp sản lượng theo tháng, quý của một năm, hoặc theo từng năm có dữ liệu (ANALYTICS-FR-004)
export type HarvestPeriod = 'month' | 'quarter' | 'year'

export interface HarvestPeriodTotals {
  // Số thứ tự từng cột: tháng 1–12, quý 1–4, hoặc năm
  buckets: number[]
  // Kg và số tổ của từng loại tổ trong từng cột, để xếp chồng theo loại
  kilogramsByType: Record<NestType, number[]>
  nestsByType: Record<NestType, number[]>
  // Số lần thu trong từng cột: nhiều loại yến cùng zone, cùng ngày tính là 1 lần
  runs: number[]
}

const MONTHS_PER_QUARTER = 3

// Năm, tháng theo giờ Việt Nam của một ngày thu
function getVietnamYearMonth(isoDate: string): { year: number; month: number } {
  const [year, month] = getVietnamDate(Date.parse(isoDate)).split('-').map(Number)
  return { year, month }
}

// Đợt thu còn hiệu lực của các zone đang xem (bỏ đợt đã xoá mềm — HARVEST-FR-005)
function filterBatches(batches: HarvestBatch[], zoneIds: readonly string[]): HarvestBatch[] {
  const zoneIdSet = new Set(zoneIds)
  return batches.filter(batch => !batch.is_deleted && zoneIdSet.has(batch.zone_id))
}

// Tổng kg, số tổ theo loại tổ và số lần thu của từng cột — cùng cách tính biểu đồ năm của web (harvestTotalsByPeriod)
export function harvestTotalsByPeriod(
  batches: HarvestBatch[],
  zoneIds: readonly string[],
  period: HarvestPeriod,
  year: number,
): HarvestPeriodTotals {
  const valid = filterBatches(batches, zoneIds)
  const buckets =
    period === 'year'
      ? [...new Set(valid.map(batch => getVietnamYearMonth(batch.harvest_date).year))].sort(
          (first, second) => first - second,
        )
      : Array.from({ length: period === 'month' ? 12 : 4 }, (_, index) => index + 1)
  const indexByBucket = new Map(buckets.map((bucket, index) => [bucket, index]))
  const emptyByType = (): Record<NestType, number[]> => ({
    RAW: new Array<number>(buckets.length).fill(0),
    CLEANED: new Array<number>(buckets.length).fill(0),
    PREMIUM: new Array<number>(buckets.length).fill(0),
  })
  const kilogramsByType = emptyByType()
  const nestsByType = emptyByType()
  const runKeys = buckets.map(() => new Set<string>())

  for (const batch of valid) {
    const harvestMonth = getVietnamYearMonth(batch.harvest_date)
    if (period !== 'year' && harvestMonth.year !== year) continue
    const bucket =
      period === 'year'
        ? harvestMonth.year
        : period === 'month'
          ? harvestMonth.month
          : Math.floor((harvestMonth.month - 1) / MONTHS_PER_QUARTER) + 1
    const index = indexByBucket.get(bucket)
    if (index === undefined) continue
    kilogramsByType[batch.nest_type][index] += batch.weight_grams / GRAMS_PER_KG
    nestsByType[batch.nest_type][index] += batch.nest_count
    runKeys[index].add(`${batch.zone_id}|${batch.harvest_date}`)
  }
  return { buckets, kilogramsByType, nestsByType, runs: runKeys.map(keys => keys.size) }
}

// Các năm có đợt thu của các zone đang xem (luôn gồm năm hiện tại), mới nhất trước — cho bộ chuyển năm
export function harvestYears(batches: HarvestBatch[], zoneIds: readonly string[], currentYear: number): number[] {
  const years = new Set<number>([currentYear])
  for (const batch of filterBatches(batches, zoneIds)) years.add(getVietnamYearMonth(batch.harvest_date).year)
  return [...years].sort((first, second) => second - first)
}
