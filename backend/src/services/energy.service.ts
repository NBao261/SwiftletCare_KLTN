import { Zone } from '@/models/houseZone.model'
import { Telemetry } from '@/models/telemetry.model'
import { MAX_GAP_MS } from '@/services/relayUsage.service'
import { assertHouseAccess } from '@/utils/farmAccess.util'
import { vnDayPeriod } from '@/utils/period.util'
import type { CurrentUser } from '@/types'

export type EnergyLoad = 'misting' | 'ventilation'

/**
 * A-9, BR-45 — điện áp nguồn của từng tải: tải DC demo trên board của nhóm, bơm phun sương 5 V và quạt 12 V (Report 4
 * §3, hàng Controller board). Tải nguồn lưới (220 V) chưa hỗ trợ.
 */
export const LOAD_SUPPLY_VOLTAGE: Record<EnergyLoad, number> = { misting: 5, ventilation: 12 }

const MS_PER_KWH = 3_600_000 * 1000

const LOADS: Array<{ load: EnergyLoad; on: string; current: string }> = [
  { load: 'misting', on: '$misting_on', current: '$pump_current_a' },
  { load: 'ventilation', on: '$ventilation_on', current: '$fan_current_a' },
]

export interface EnergyMonth {
  /** 'YYYY-MM' theo giờ VN */
  month: string
  /** kWh ước tính; null = tải không có dòng đo trong tháng (not available) */
  misting_kwh: number | null
  ventilation_kwh: number | null
}

const round3 = (n: number) => Math.round(n * 1000) / 1000

/**
 * ANALYTICS-FR-017, BR-45 — điện năng ước tính của bơm và quạt của 1 nhà theo tháng: Σ điện áp × dòng đo × thời gian,
 * mỗi mẫu telemetry lúc relay BẬT và có dòng đo được tính tới mẫu kế tiếp của cùng controller. Relay bật mà dòng bằng 0
 * (tải hỏng) thì góp 0. Controller không đo dòng thì tải đó "not available". Ước tính, không phải số công tơ; telemetry
 * chỉ giữ 90 ngày (BR-36) nên tháng cũ hơn không có số.
 *
 * Lệch BR-45 đã biết: BR-45 chỉ tính tải đang chạy khi dòng trên 50 % dòng bình thường (BR-32), nhưng backend chưa biết
 * mức dòng bình thường firmware học được, nên mọi mẫu relay BẬT có dòng đều được cộng (tải kẹt hút ít dòng vẫn góp điện).
 * Sẽ áp mức 50 % khi firmware báo mức đã học.
 *
 * Lọc theo `zone_id` của chính dòng telemetry (zone lúc đo), không theo zone hiện tại của controller: controller dời sang
 * nhà khác thì điện đã dùng vẫn thuộc nhà cũ, và controller đã gỡ vẫn được tính.
 */
export async function houseEnergyByMonth(houseId: unknown, from: Date, to: Date): Promise<EnergyMonth[]> {
  const zoneIds = await Zone.find({ house_id: houseId }).distinct('_id')
  if (zoneIds.length === 0) return []

  const contribution = ({ load, on, current }: (typeof LOADS)[number]) => ({
    [`${load}_wms`]: {
      $sum: {
        $cond: [
          { $and: [{ $eq: [on, true] }, { $isNumber: current }] },
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

/** Tổng của các tháng; tải không có dòng đo ở tháng nào thì null */
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

/** GET /analytics/energy — Farm Owner, chuyên gia (đọc), thợ ở nhà được giao (Report 3 §2.4, analytics) */
export async function getHouseEnergy(user: CurrentUser, query: { houseId: string; from: Date; to: Date }) {
  // Trọn ngày giờ VN, tối đa 1 năm (Report 3 §4.5) → 400
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
