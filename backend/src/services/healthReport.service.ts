import { Types } from 'mongoose'
import type { ZoneHealthMetrics } from '@/models/houseHealthReport.model'
import { Alert } from '@/models/alert.model'
import { averageReturnRate, houseDailyCounts, vnDate } from '@/services/birdCount.service'
import type { IZone } from '@/models/houseZone.model'
import { Telemetry } from '@/models/telemetry.model'
import { autonomyBetween, inRangeSum, pct, switchedSum } from '@/services/analytics.service'

const round1 = (v: number | null | undefined) => (typeof v === 'number' ? Math.round(v * 10) / 10 : null)

// Không ghi
export async function buildZoneMetrics(zone: Pick<IZone, '_id' | 'house_id' | 'thresholds'>, from: Date, to: Date): Promise<ZoneHealthMetrics> {
  const zoneId = new Types.ObjectId(String(zone._id))
  const t = zone.thresholds

  const [[tele], alertRows, birdDays, autonomy] = await Promise.all([
    Telemetry.aggregate([
      { $match: { zone_id: zoneId, timestamp: { $gte: from, $lte: to } } },
      // $setWindowFields giữ cả partition trong bộ nhớ (100 MB): chỉ mang trường cần dùng
      { $project: { node_id: 1, timestamp: 1, humidity: 1, temperature: 1, nh3_ppm: 1, co2_ppm: 1, misting_on: 1, ventilation_on: 1 } },
      {
        $setWindowFields: {
          partitionBy: '$node_id',
          sortBy: { timestamp: 1 },
          output: {
            prevMisting:     { $shift: { output: '$misting_on', by: -1 } },
            prevVentilation: { $shift: { output: '$ventilation_on', by: -1 } },
          },
        },
      },
      {
        $group: {
          _id: null,
          total:               { $sum: 1 },
          humidityCount:       { $sum: { $cond: [{ $isNumber: '$humidity' }, 1, 0] } },
          humidityInRange:     inRangeSum('$humidity', t.humidity_min, t.humidity_max),
          temperatureCount:    { $sum: { $cond: [{ $isNumber: '$temperature' }, 1, 0] } },
          temperatureInRange:  inRangeSum('$temperature', t.temp_min, t.temp_max),
          mistingSwitches:     switchedSum('$misting_on', '$prevMisting'),
          ventilationSwitches: switchedSum('$ventilation_on', '$prevVentilation'),
          nh3Avg: { $avg: '$nh3_ppm' }, nh3Max: { $max: '$nh3_ppm' },
          co2Avg: { $avg: '$co2_ppm' }, co2Max: { $max: '$co2_ppm' },
        },
      },
    ]).allowDiskUse(true),
    Alert.aggregate<{ _id: string; count: number }>([
      { $match: { zone_id: zoneId, created_at: { $gte: from, $lte: to } } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]),
    houseDailyCounts(String(zone.house_id), { from: vnDate(from), to: vnDate(to) }),
    autonomyBetween(String(zone._id), from, to),
  ])

  return {
    sample_count: tele?.total ?? 0,
    temp_in_range_pct:     tele ? pct(tele.temperatureInRange, tele.temperatureCount) : null,
    humidity_in_range_pct: tele ? pct(tele.humidityInRange, tele.humidityCount) : null,
    auto_mode_pct: autonomy.auto_mode_pct,
    misting_switches:     tele?.mistingSwitches ?? 0,
    ventilation_switches: tele?.ventilationSwitches ?? 0,
    alerts_by_type: Object.fromEntries(alertRows.map(r => [r._id, r.count])),
    avg_return_rate: round1(averageReturnRate(birdDays)),
    nh3_avg: round1(tele?.nh3Avg), nh3_max: round1(tele?.nh3Max),
    co2_avg: round1(tele?.co2Avg), co2_max: round1(tele?.co2Max),
  }
}
