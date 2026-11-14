import { HouseHealthDay } from '@/models/houseHealthDay.model'
import { House } from '@/models/houseZone.model'
import { houseDailyCounts, vnDate, type HouseDayCounts } from '@/services/birdCount.service'
import { houseEnergyByMonth, totalEnergy } from '@/services/energy.service'
import { openAlertCounts, type FarmHouse } from '@/services/farmOverview.service'
import { isFlockDayComplete } from '@/services/healthAssessment.service'
import { collectAlertSamples, opsRow } from '@/services/opsMetrics.service'
import { BadRequestError } from '@/utils/appError.util'
import { assertFarmAccess } from '@/utils/farmAccess.util'
import type { CurrentUser } from '@/types'

/** Các cột sắp xếp được của BR-44 (cùng tên trường trong mỗi hàng); không có cột điểm tổng hay xếp hạng */
export const COMPARISON_SORT_KEYS = [
  'name', 'time_in_range_pct', 'good_days_pct', 'return_rate_avg', 'flock_trend_pct',
  'alerts_raised', 'alerts_open', 'mttr_min', 'energy_kwh', 'last_cycle_yield_g',
] as const
export type ComparisonSortKey = typeof COMPARISON_SORT_KEYS[number]

export interface ComparisonRow {
  house_id: string
  name: string
  /** Trung bình theo ngày của chỉ số môi trường BR-28 (% thời gian trong ngưỡng) */
  time_in_range_pct: number | null
  /** % ngày GOOD trên số ngày đã đánh giá đủ dữ liệu */
  good_days_pct: number | null
  return_rate_avg: number | null
  /** % đổi của trung bình số chim ra buổi sáng so với kỳ liền trước cùng độ dài (ANALYTICS-FR-002) */
  flock_trend_pct: number | null
  alerts_raised: number
  alerts_open: number
  mttr_min: number | null
  /** kWh ước tính của bơm và quạt (BR-45); null = không tải nào có dòng đo (not available) */
  energy_kwh: number | null
  energy: { misting_kwh: number | null; ventilation_kwh: number | null }
  /** Sản lượng chu kỳ đã đóng gần nhất (BR-43) — chưa có tới khi có chu kỳ thu hoạch (G-26) */
  last_cycle_yield_g: number | null
}

const round1 = (n: number) => Math.round(n * 10) / 10
const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null)

function flockChange(days: HouseDayCounts[], prevFrom: string, from: string): number | null {
  const complete = days.filter(isFlockDayComplete)
  const before = mean(complete.filter(d => d.date >= prevFrom && d.date < from).map(d => d.net_exit))
  const during = mean(complete.filter(d => d.date >= from).map(d => d.net_exit))
  return before && during !== null ? round1(((during - before) / before) * 100) : null
}

/** Sắp theo 1 cột; ô trống (null) luôn xuống cuối dù tăng hay giảm */
export function sortComparison(rows: ComparisonRow[], key: ComparisonSortKey, order: 'asc' | 'desc'): ComparisonRow[] {
  const sign = order === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const x = a[key]
    const y = b[key]
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1
    if (typeof x === 'string' && typeof y === 'string') return sign * x.localeCompare(y, 'vi')
    return sign * ((x as number) - (y as number))
  })
}

async function houseRow(
  house: FarmHouse, period: { from: Date; to: Date; fromDate: string; toDate: string; prevFromDate: string },
  health: Map<string, Array<{ status: string; environment: number | null }>>,
  samples: Map<string, Parameters<typeof opsRow>[0]>, openAlerts: Map<string, number>,
): Promise<ComparisonRow> {
  const id = String(house._id)
  const [counts, energyMonths] = await Promise.all([
    houseDailyCounts(id, { from: period.prevFromDate, to: period.toDate }),
    houseEnergyByMonth(house._id, period.from, period.to),
  ])
  const days = health.get(id) ?? []
  const assessed = days.filter(d => d.status !== 'INSUFFICIENT_DATA')
  const inRange = mean(days.map(d => d.environment).filter((v): v is number => v !== null))
  const rates = counts.filter(d => d.date >= period.fromDate && isFlockDayComplete(d)).map(d => d.return_rate as number)
  const returnRate = mean(rates)
  const energy = totalEnergy(energyMonths)
  return {
    house_id: id,
    name: house.name,
    time_in_range_pct: inRange === null ? null : round1(inRange),
    good_days_pct: assessed.length ? round1((100 * assessed.filter(d => d.status === 'GOOD').length) / assessed.length) : null,
    return_rate_avg: returnRate === null ? null : round1(returnRate),
    flock_trend_pct: flockChange(counts, period.prevFromDate, period.fromDate),
    alerts_raised: (samples.get(id) ?? []).length,
    alerts_open: openAlerts.get(id) ?? 0,
    mttr_min: opsRow(samples.get(id) ?? []).mttr_min,
    energy_kwh: energy.total_kwh,
    energy: { misting_kwh: energy.misting_kwh, ventilation_kwh: energy.ventilation_kwh },
    last_cycle_yield_g: null,
  }
}

/**
 * ANALYTICS-FR-016, BR-44 — so sánh các nhà của 1 farm trong [from, to): thời gian trong ngưỡng, tỷ lệ ngày GOOD, tỷ lệ
 * chim về trung bình, xu hướng đàn, số cảnh báo đã có và đang mở, MTTR, điện năng ước tính, sản lượng chu kỳ gần nhất.
 * Sắp theo từng cột; không tính điểm tổng hay xếp hạng. Farm Owner và Domain Expert (đọc).
 */
export async function getHouseComparison(
  user: CurrentUser, query: { farmId: string; from: Date; to: Date; sort?: ComparisonSortKey; order?: 'asc' | 'desc' },
) {
  if (query.from >= query.to) throw BadRequestError('`from` phải trước `to`')
  const farm = await assertFarmAccess(query.farmId, user)
  const houses = await House.find({ farm_id: farm._id }).select('name stage').lean<FarmHouse[]>()
  const houseIds = houses.map(h => h._id)
  const span = query.to.getTime() - query.from.getTime()
  const period = {
    from: query.from, to: query.to,
    fromDate: vnDate(query.from),
    // `to` không tính: ngày cuối là ngày của mili giây trước `to`
    toDate: vnDate(new Date(query.to.getTime() - 1)),
    prevFromDate: vnDate(new Date(query.from.getTime() - span)),
  }

  const [days, { byHouse }, openAlerts] = await Promise.all([
    HouseHealthDay.find({ house_id: { $in: houseIds }, date: { $gte: period.fromDate, $lte: period.toDate } })
      .select('house_id current_status indicators.environment.value').lean(),
    collectAlertSamples(farm._id, houseIds, query.from, query.to),
    openAlertCounts(farm._id, houses),
  ])
  const health = new Map<string, Array<{ status: string; environment: number | null }>>()
  for (const d of days) {
    const id = String(d.house_id)
    health.set(id, [...(health.get(id) ?? []), { status: d.current_status, environment: d.indicators?.environment?.value ?? null }])
  }

  const rows = await Promise.all(houses.map(h => houseRow(h, period, health, byHouse, openAlerts)))
  return {
    farm_id: String(farm._id), from: query.from, to: query.to,
    sort: query.sort ?? 'name', order: query.order ?? 'asc',
    rows: sortComparison(rows, query.sort ?? 'name', query.order ?? 'asc'),
  }
}
