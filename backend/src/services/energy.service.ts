import { SensorNode } from '@/models/device.model'
import { Zone } from '@/models/houseZone.model'
import { Telemetry } from '@/models/telemetry.model'
import { MAX_GAP_MS, RUNNING_MIN_RATIO } from '@/services/relayUsage.service'
import { assertHouseAccess } from '@/utils/farmAccess.util'
import { vnDayPeriod } from '@/utils/period.util'
import type { CurrentUser } from '@/types'

export type EnergyLoad = 'misting' | 'ventilation'

/** A-9: tải DC demo trên board của nhóm; tải 220 V chưa hỗ trợ */
export const LOAD_SUPPLY_VOLTAGE: Record<EnergyLoad, number> = { misting: 5, ventilation: 12 }

const MS_PER_KWH = 3_600_000 * 1000

const LOADS: Array<{ load: EnergyLoad; on: string; current: string; baseline: 'misting_a' | 'ventilation_a' }> = [
  { load: 'misting', on: '$misting_on', current: '$pump_current_a', baseline: 'misting_a' },
  { load: 'ventilation', on: '$ventilation_on', current: '$fan_current_a', baseline: 'ventilation_a' },
]

export interface EnergyMonth {
  /** Giờ VN */
  month: string
  /** null = tải không có dòng đo trong tháng */
  misting_kwh: number | null
  ventilation_kwh: number | null
}

const round3 = (n: number) => Math.round(n * 1000) / 1000

/** Ước tính, không phải số công tơ. Lọc theo zone_id trên từng dòng telemetry: dời controller thì điện cũ vẫn thuộc nhà cũ */
export async function houseEnergyByMonth(houseId: unknown, from: Date, to: Date): Promise<EnergyMonth[]> {
  const zoneIds = await Zone.find({ house_id: houseId }).distinct('_id')
  if (zoneIds.length === 0) return []

  // Ít controller nên đưa thẳng vào pipeline thay vì $lookup
  const baselines = await SensorNode.find({ actuator_baseline: { $exists: true } }).select('_id actuator_baseline').lean()
  const learned = (key: 'misting_a' | 'ventilation_a') => {
    const branches = baselines.filter(n => n.actuator_baseline?.[key])
      .map(n => ({ case: { $eq: ['$node_id', n._id] }, then: n.actuator_baseline![key]! * RUNNING_MIN_RATIO }))
    return branches.length ? { $switch: { branches, default: null } } : null
  }

  const contribution = ({ load, on, current, baseline }: (typeof LOADS)[number]) => ({
    [`${load}_wms`]: {
      $sum: {
        $cond: [
          {
            $and: [
              { $eq: [on, true] }, { $isNumber: current },
              { $let: { vars: { min: learned(baseline) }, in: { $or: [{ $eq: ['$$min', null] }, { $gt: [current, '$$min'] }] } } },
            ],
          },
          { $multiply: [LOAD_SUPPLY_VOLTAGE[load], current, '$dt'] },
          0,
        ],
      },
    },
    [`${load}_measured`]: { $sum: { $cond: [{ $isNumber: current }, 1, 0] } },
  })

  const rows: Array<Record<string, number> & { _id: string }> = await Telemetry.aggregate([
    { $match: { zone_id: { $in: zoneIds }, timestamp: { $gte: from, $lt: to } } },
    {
      $setWindowFields: {
        partitionBy: '$node_id',
        sortBy: { timestamp: 1 },
        output: { next: { $shift: { output: '$timestamp', by: 1 } } },
      },
    },
    {
      $set: {
        dt: {
          $let: {
            vars: { gap: { $cond: [{ $eq: ['$next', null] }, 0, { $subtract: ['$next', '$timestamp'] }] } },
            in: { $cond: [{ $lte: ['$$gap', MAX_GAP_MS] }, '$$gap', 0] },
          },
        },
      },
    },
    {
      $group: {
        _id: { $dateToString: { date: '$timestamp', format: '%Y-%m', timezone: '+07:00' } },
        ...contribution(LOADS[0]),
        ...contribution(LOADS[1]),
      },
    },
    { $sort: { _id: 1 } },
  ])

  const kwh = (row: Record<string, number>, load: EnergyLoad) =>
    row[`${load}_measured`] > 0 ? round3(row[`${load}_wms`] / MS_PER_KWH) : null
  return rows.map(row => ({ month: row._id, misting_kwh: kwh(row, 'misting'), ventilation_kwh: kwh(row, 'ventilation') }))
}

/** null khi tải không có dòng đo ở tháng nào */
export function totalEnergy(months: EnergyMonth[]): { misting_kwh: number | null; ventilation_kwh: number | null; total_kwh: number | null } {
  const sum = (load: EnergyLoad) => {
    const values = months.map(m => m[`${load}_kwh`]).filter((v): v is number => v !== null)
    return values.length ? round3(values.reduce((a, b) => a + b, 0)) : null
  }
  const misting = sum('misting')
  const ventilation = sum('ventilation')
  return {
    misting_kwh: misting, ventilation_kwh: ventilation,
    total_kwh: misting === null && ventilation === null ? null : round3((misting ?? 0) + (ventilation ?? 0)),
  }
}

export async function getHouseEnergy(user: CurrentUser, query: { houseId: string; from: Date; to: Date }) {
  // Quá 1 năm → 400
  const range = vnDayPeriod(query.from, query.to)
  const { house } = await assertHouseAccess(query.houseId, user)
  const months = await houseEnergyByMonth(house._id, range.from, range.to)
  return {
    house_id: String(house._id), from: range.from, to: range.to,
    supply_voltage: LOAD_SUPPLY_VOLTAGE,
    estimated: true,
    months,
    total: totalEnergy(months),
  }
}
