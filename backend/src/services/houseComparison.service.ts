import { Types } from 'mongoose'
import { HarvestCycle } from '@/models/harvestCycle.model'
import { HouseHealthDay } from '@/models/houseHealthDay.model'
import { House } from '@/models/houseZone.model'
import { houseDailyCounts, vnDate, type HouseDayCounts } from '@/services/birdCount.service'
import { houseEnergyByMonth, totalEnergy } from '@/services/energy.service'
import { openAlertCounts, simulatedHouses, type FarmHouse } from '@/services/farmOverview.service'
import { isFlockDayComplete } from '@/services/healthAssessment.service'
import { collectAlertSamples, opsRow, siteCauseCounts } from '@/services/opsMetrics.service'
import type { SiteCause } from '@/models/workOrder.model'
import { assertFarmAccess } from '@/utils/farmAccess.util'
import { vnDayPeriod } from '@/utils/period.util'
import type { CurrentUser } from '@/types'

// không có cột điểm tổng hay xếp hạng
export const COMPARISON_SORT_KEYS = [
  'name', 'time_in_range_pct', 'good_days_pct', 'return_rate_avg', 'flock_trend_pct',
  'alerts_raised', 'alerts_open', 'mttr_min', 'energy_kwh', 'last_cycle_yield_g',
] as const
export type ComparisonSortKey = typeof COMPARISON_SORT_KEYS[number]

export interface ComparisonRow {
  house_id: string
  name: string
  time_in_range_pct: number | null
  good_days_pct: number | null
  return_rate_avg: number | null
  flock_trend_pct: number | null
  alerts_raised: number
  alerts_open: number
  mttr_min: number | null
  energy_kwh: number | null
  energy: { misting_kwh: number | null; ventilation_kwh: number | null }
  // Chu kỳ là của tầng: cộng chu kỳ đóng gần nhất ở mỗi tầng
  last_cycle_yield_g: number | null
  site_causes: Partial<Record<SiteCause, number>>
  simulated: boolean
}

const round1 = (n: number) => Math.round(n * 10) / 10
const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null)

function flockChange(days: HouseDayCounts[], prevFrom: string, from: string): number | null {
  const complete = days.filter(isFlockDayComplete)
  const before = mean(complete.filter(d => d.date >= prevFrom && d.date < from).map(d => d.net_exit))
  const during = mean(complete.filter(d => d.date >= from).map(d => d.net_exit))
  return before && during !== null ? round1(((during - before) / before) * 100) : null
}

// Ô trống luôn xuống cuối
export function sortComparison(rows: ComparisonRow[], key: ComparisonSortKey, order: 'asc' | 'desc'): ComparisonRow[] {
  const sign = order === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const x = a[key]
    const y = b[key]
    const byId = a.house_id.localeCompare(b.house_id)
    if (x === null || y === null) return x === y ? byId : x === null ? 1 : -1
    const diff = typeof x === 'string' && typeof y === 'string' ? x.localeCompare(y, 'vi') : (x as number) - (y as number)
    // Thứ tự không đổi giữa các lần gọi
    return diff === 0 ? byId : sign * diff
  })
}

// null khi chưa có chu kỳ đóng
export async function lastClosedCycleYield(houseId: unknown): Promise<number | null> {
  const latest = await HarvestCycle.aggregate<{ weight: number }>([
    // aggregate không tự đổi chuỗi sang ObjectId
    { $match: { house_id: new Types.ObjectId(String(houseId)), status: { $in: ['CLOSED', 'CONCLUDED'] }, closing_harvest: { $exists: true } } },
    { $sort: { end_date: -1 } },
    { $group: { _id: '$zone_id', weight: { $first: '$closing_harvest.weight_grams' } } },
  ])
  return latest.length ? round1(latest.reduce((sum, row) => sum + row.weight, 0)) : null
}

async function houseRow(
  house: FarmHouse, period: { from: Date; to: Date; fromDate: string; toDate: string; prevFromDate: string },
  health: Map<string, Array<{ status: string; environment: number | null }>>,
  samples: Map<string, Parameters<typeof opsRow>[0]>, openAlerts: Map<string, number>,
): Promise<Omit<ComparisonRow, 'simulated'>> {
  const id = String(house._id)
  const [counts, energyMonths, lastYield] = await Promise.all([
    houseDailyCounts(id, { from: period.prevFromDate, to: period.toDate }),
    houseEnergyByMonth(house._id, period.from, period.to),
    lastClosedCycleYield(house._id),
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
    last_cycle_yield_g: lastYield,
    site_causes: siteCauseCounts(samples.get(id) ?? []),
  }
}

// Không tính điểm tổng hay xếp hạng
export async function getHouseComparison(
  user: CurrentUser, query: { farmId: string; from: Date; to: Date; sort?: ComparisonSortKey; order?: 'asc' | 'desc' },
) {
  // Kỳ liền trước cùng số ngày; quá 1 năm → 400
  const range = vnDayPeriod(query.from, query.to)
  const farm = await assertFarmAccess(query.farmId, user)
  const houses = await House.find({ farm_id: farm._id }).select('name stage').lean<FarmHouse[]>()
  const houseIds = houses.map(h => h._id)
  const span = range.to.getTime() - range.from.getTime()
  const period = {
    from: range.from, to: range.to,
    fromDate: vnDate(range.from),
    toDate: vnDate(new Date(range.to.getTime() - 1)),
    prevFromDate: vnDate(new Date(range.from.getTime() - span)),
  }

  const [days, { byHouse }, openAlerts] = await Promise.all([
    HouseHealthDay.find({ house_id: { $in: houseIds }, date: { $gte: period.fromDate, $lte: period.toDate } })
      .select('house_id current_status indicators.environment.value').lean(),
    collectAlertSamples(farm._id, houseIds, range.from, range.to),
    openAlertCounts(farm._id, houses),
  ])
  const simulated = await simulatedHouses(houses)
  const health = new Map<string, Array<{ status: string; environment: number | null }>>()
  for (const d of days) {
    const id = String(d.house_id)
    health.set(id, [...(health.get(id) ?? []), { status: d.current_status, environment: d.indicators?.environment?.value ?? null }])
  }

  const rows = (await Promise.all(houses.map(h => houseRow(h, period, health, byHouse, openAlerts))))
    .map(row => ({ ...row, simulated: simulated.has(row.house_id) }))
  return {
    farm_id: String(farm._id), from: range.from, to: range.to, days: range.days,
    sort: query.sort ?? 'name', order: query.order ?? 'asc',
    rows: sortComparison(rows, query.sort ?? 'name', query.order ?? 'asc'),
  }
}
