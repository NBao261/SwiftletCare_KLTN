import { Types } from 'mongoose'
import type { ZoneHealthMetrics } from '@/models/houseHealthReport.model'
import { Alert } from '@/models/alert.model'
import { averageReturnRate, houseDailyCounts, vnDate } from '@/services/birdCount.service'
import type { IZone } from '@/models/houseZone.model'
import { Telemetry } from '@/models/telemetry.model'
import { autonomyBetween, inRangeSum, pct, switchedSum } from '@/services/analytics.service'

/**
 * Số liệu theo Zone của báo cáo sức khoẻ theo nhà (BR-33, `houseHealthReport.service`). Báo cáo tuần theo Zone kiểu cũ
 * đã được chuyển vào báo cáo nhà (`npm run migrate:zone-reports`, Report 4 §6.4) và không còn đường đọc riêng.
 */
const round1 = (v: number | null | undefined) => (typeof v === 'number' ? Math.round(v * 10) / 10 : null)

/**
 * EXPERT-FR-005 — số liệu sức khỏe của 1 Zone trong [from, to]: % thời gian nhiệt/ẩm
 * trong ngưỡng, % thời gian tự động, số lần đóng cắt relay, số cảnh báo theo loại,
 * tỷ lệ chim về, NH3/CO2 trung bình và cực đại. Hàm thuần đọc — không ghi gì.
 */
export async function buildZoneMetrics(zone: Pick<IZone, '_id' | 'house_id' | 'thresholds'>, from: Date, to: Date): Promise<ZoneHealthMetrics> {
  const zoneId = new Types.ObjectId(String(zone._id))
  const t = zone.thresholds

  const [[tele], alertRows, birdDays, autonomy] = await Promise.all([
    Telemetry.aggregate([
      { $match: { zone_id: zoneId, timestamp: { $gte: from, $lte: to } } },
      // Chỉ mang các trường cần dùng qua $setWindowFields — stage này giữ cả partition
      // trong bộ nhớ (giới hạn 100 MB); kỳ dài thì cho phép tràn ra đĩa.
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
    // Tỷ lệ chim về là của cả nhà yến chứa Zone (SRS v2.1.8), cùng nguồn với /analytics/bird-count/*
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
