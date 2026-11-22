import { Types } from 'mongoose'
import { Telemetry } from '@/models/telemetry.model'
import { WeatherObservation } from '@/models/weatherObservation.model'
import { SensorNode, IN_SERVICE } from '@/models/device.model'
import { RELAY_SERVICE_LIMITS } from '@/services/relayUsage.service'
import { houseDailyCounts, vnDate, type HouseDayCounts } from '@/services/birdCount.service'
import { isFlockDayComplete } from '@/services/healthAssessment.service'
import { assertHouseAccessByParams, assertZoneAccess } from '@/utils/farmAccess.util'
import { resolveBirdCountTuning } from '@/utils/detectionTuning.util'
import { manualTimeInZone } from '@/services/relayOverrideLog.service'
import { BadRequestError } from '@/utils/appError.util'
import type { CurrentUser } from '@/types'

const RANGE_MS: Record<string, number> = {
  '1h': 3600_000,
  '6h': 6 * 3600_000,
  '24h': 24 * 3600_000,
  '7d': 7 * 86400_000,
  '30d': 30 * 86400_000,
}

// Telemetry ~10s nên 30 ngày ~260k bản ghi: phải gom bucket
const MAX_BUCKETS = 120
const HOUR_MS = 3600_000

function resolveRange(range: string) {
  // Object.hasOwn: RANGE_MS['constructor'] trả hàm của prototype → NaN → 500
  const ms = Object.hasOwn(RANGE_MS, range) ? RANGE_MS[range] : undefined
  if (!ms) throw BadRequestError(`range phải là 1 trong: ${Object.keys(RANGE_MS).join(', ')}`)
  const to = new Date()
  const from = new Date(to.getTime() - ms)
  const bucketMs = Math.max(60_000, Math.ceil(ms / MAX_BUCKETS / 60_000) * 60_000)
  return { from, to, bucketMs }
}

export async function getEnvSummary(user: CurrentUser, query: { zoneId: string; range: string }) {
  const { zone } = await assertZoneAccess(query.zoneId, user)
  const { from, to, bucketMs } = resolveRange(query.range)

  const series = await Telemetry.aggregate([
    { $match: { zone_id: new Types.ObjectId(query.zoneId), timestamp: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: { $toDate: { $subtract: [{ $toLong: '$timestamp' }, { $mod: [{ $toLong: '$timestamp' }, bucketMs] }] } },
        temperature: { $avg: '$temperature' },
        humidity:    { $avg: '$humidity' },
        light_lux:   { $avg: '$light_lux' },
        nh3_ppm:     { $avg: '$nh3_ppm' },
        co2_ppm:     { $avg: '$co2_ppm' },
        sound_db:    { $avg: '$sound_db' },
        anomalyCount:{ $sum: { $cond: ['$is_anomaly', 1, 0] } },
        sampleCount: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, timestamp: '$_id', temperature: 1, humidity: 1, light_lux: 1, nh3_ppm: 1, co2_ppm: 1, sound_db: 1, anomalyCount: 1, sampleCount: 1 } },
  ])

  const [stats] = await Telemetry.aggregate([
    { $match: { zone_id: new Types.ObjectId(query.zoneId), timestamp: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: null,
        temp_min: { $min: '$temperature' }, temp_max: { $max: '$temperature' }, temp_avg: { $avg: '$temperature' },
        humidity_min: { $min: '$humidity' }, humidity_max: { $max: '$humidity' }, humidity_avg: { $avg: '$humidity' },
        anomalyCount: { $sum: { $cond: ['$is_anomaly', 1, 0] } },
        total: { $sum: 1 },
      },
    },
  ])

  return { range: query.range, from, to, bucketMs, series, stats: stats ?? null, outdoor: await outdoorSeries(zone.farm_id, from, to, bucketMs) }
}

// Cùng mốc bucket với series. Bản ghi giờ H chỉ có khi giờ đó đã qua, nên lấy từ đầu giờ chứa from
async function outdoorSeries(farmId: unknown, from: Date, to: Date, bucketMs: number) {
  const firstHour = new Date(from.getTime() - (from.getTime() % HOUR_MS))
  return WeatherObservation.aggregate([
    { $match: { farm_id: farmId, hour: { $gte: firstHour, $lte: to } } },
    {
      $group: {
        _id: { $toDate: { $subtract: [{ $toLong: '$hour' }, { $mod: [{ $toLong: '$hour' }, bucketMs] }] } },
        temperature: { $avg: '$temperature' },
        humidity: { $avg: '$humidity' },
        // Cả bucket thiếu thì null, không ghi 0 mm
        precipitation_mm: { $sum: '$precipitation_mm' },
        rainHours: { $sum: { $cond: [{ $eq: [{ $type: '$precipitation_mm' }, 'missing'] }, 0, 1] } },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0, timestamp: '$_id', temperature: 1, humidity: 1,
        precipitation_mm: { $cond: [{ $gt: ['$rainHours', 0] }, '$precipitation_mm', null] },
      },
    },
  ])
}

// null khi không có mẫu
export const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null)
export const inRangeSum = (field: string, min: number, max: number) =>
  ({ $sum: { $cond: [{ $and: [{ $gte: [field, min] }, { $lte: [field, max] }] }, 1, 0] } })
// Đếm lần đổi giữa 2 mẫu cùng ESP32 có trạng thái relay; mẫu buffer không có relay, tính vào sẽ phồng số
const isBool = (expr: string) => ({ $eq: [{ $type: expr }, 'bool'] })
export const switchedSum = (field: string, prev: string) =>
  ({ $sum: { $cond: [{ $and: [isBool(prev), isBool(field), { $ne: [prev, field] }] }, 1, 0] } })

// Chỉ mẫu có misting_pct (firmware >= 1.1.0)
export async function getControlPerformance(user: CurrentUser, query: { zoneId: string; range: string }) {
  const { zone } = await assertZoneAccess(query.zoneId, user)
  const { from, to, bucketMs } = resolveRange(query.range)
  const t = zone.thresholds
  const match = {
    $match: { zone_id: new Types.ObjectId(query.zoneId), timestamp: { $gte: from, $lte: to }, misting_pct: { $exists: true } },
  }

  const [series, [agg], nodes] = await Promise.all([
    Telemetry.aggregate([
      match,
      {
        $group: {
          _id: { $toDate: { $subtract: [{ $toLong: '$timestamp' }, { $mod: [{ $toLong: '$timestamp' }, bucketMs] }] } },
          humidity:        { $avg: '$humidity' },
          temperature:     { $avg: '$temperature' },
          misting_pct:     { $avg: '$misting_pct' },
          ventilation_pct: { $avg: '$ventilation_pct' },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, timestamp: '$_id', humidity: 1, temperature: 1, misting_pct: 1, ventilation_pct: 1 } },
    ]),
    Telemetry.aggregate([
      match,
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
          mistingAvg:          { $avg: '$misting_pct' },
          ventilationAvg:      { $avg: '$ventilation_pct' },
          mistingSwitches:     switchedSum('$misting_on', '$prevMisting'),
          ventilationSwitches: switchedSum('$ventilation_on', '$prevVentilation'),
          firstAt:             { $min: '$timestamp' },
          lastAt:              { $max: '$timestamp' },
        },
      },
    ]),
    SensorNode.find({ zone_id: zone._id, ...IN_SERVICE }).select('device_id relay_usage simulated').lean(),
  ])

  const hours = agg ? (agg.lastAt.getTime() - agg.firstAt.getTime()) / 3600_000 : 0
  const perHour = (n: number) => (hours >= 0.25 ? Math.round((n / hours) * 10) / 10 : null) // Dưới 15 phút dữ liệu chưa quy ra /giờ được

  return {
    range: query.range, from, to, bucketMs,
    thresholds: { humidity_min: t.humidity_min, humidity_max: t.humidity_max, temp_min: t.temp_min, temp_max: t.temp_max },
    fuzzy_tuning: zone.fuzzy_tuning,
    tuning_changes: zone.fuzzy_tuning_history
      .filter(h => h.changed_at >= from)
      .map(h => ({ changed_at: h.changed_at, new_values: h.new_values })),
    series,
    service_limits: RELAY_SERVICE_LIMITS,
    relay_usage: nodes.map(n => ({
      device_id: n.device_id,
      simulated: n.simulated ?? false,
      misting: { hours: Math.round(n.relay_usage?.misting?.since_service_hours ?? 0), switches: n.relay_usage?.misting?.since_service_switches ?? 0 },
      ventilation: { hours: Math.round(n.relay_usage?.ventilation?.since_service_hours ?? 0), switches: n.relay_usage?.ventilation?.since_service_switches ?? 0 },
    })),
    stats: agg ? {
      sampleCount: agg.total,
      humidityInRangePct:    pct(agg.humidityInRange, agg.humidityCount),
      temperatureInRangePct: pct(agg.temperatureInRange, agg.temperatureCount),
      mistingAvgPct:     agg.mistingAvg === null ? null : Math.round(agg.mistingAvg),
      ventilationAvgPct: agg.ventilationAvg === null ? null : Math.round(agg.ventilationAvg),
      mistingSwitchesPerHour:     perHour(agg.mistingSwitches),
      ventilationSwitchesPerHour: perHour(agg.ventilationSwitches),
    } : null,
  }
}

export async function compareZones(user: CurrentUser, zoneIds: string[], range: string) {
  if (zoneIds.length === 0) throw BadRequestError('Cần ít nhất 1 zoneId')
  if (zoneIds.length > 6) throw BadRequestError('So sánh tối đa 6 zone cùng lúc')

  const { from, to } = resolveRange(range)

  const results = await Promise.all(
    zoneIds.map(async zoneId => {
      const { zone } = await assertZoneAccess(zoneId, user)
      const [agg] = await Telemetry.aggregate([
        { $match: { zone_id: new Types.ObjectId(zoneId), timestamp: { $gte: from, $lte: to } } },
        {
          $group: {
            _id: null,
            temperature: { $avg: '$temperature' },
            humidity:    { $avg: '$humidity' },
            light_lux:   { $avg: '$light_lux' },
            nh3_ppm:     { $avg: '$nh3_ppm' },
            co2_ppm:     { $avg: '$co2_ppm' },
            anomalyCount:{ $sum: { $cond: ['$is_anomaly', 1, 0] } },
            sampleCount: { $sum: 1 },
          },
        },
      ])
      return { zoneId, zoneName: zone.name, thresholds: zone.thresholds, metrics: agg ?? null }
    }),
  )

  return { range, from, to, zones: results }
}

// zoneId cũ: quy ra House chứa Zone
export interface BirdCountScope { houseId?: string; zoneId?: string }

// Rỗng tới khi nút AI publish, không phải lỗi
export async function getBirdCountDaily(user: CurrentUser, scope: BirdCountScope, query: { from?: string; to?: string }) {
  const { house } = await assertHouseAccessByParams(scope, user)
  return { house_id: String(house._id), ...(await dailyBirdCounts(String(house._id), query)) }
}

// Caller đã kiểm quyền
async function dailyBirdCounts(houseId: string, query: { from?: string; to?: string }) {
  const to = query.to ? new Date(query.to) : new Date()
  const from = query.from ? new Date(query.from) : new Date(to.getTime() - 30 * 86400_000)

  const days = await houseDailyCounts(houseId, { from: vnDate(from), to: vnDate(to) })
  const records = days.map(({ updated_at: _updatedAt, ...day }) => day)

  return { from, to, records, note: records.length === 0 ? 'Chưa có dữ liệu đếm chim trong khoảng này' : undefined }
}

// Override bắt đầu trước khi có lịch sử không được tính
export async function getAutonomy(user: CurrentUser, query: { zoneId: string; range: string }) {
  await assertZoneAccess(query.zoneId, user)
  const { from, to } = resolveRange(query.range)
  return { range: query.range, ...(await autonomyBetween(query.zoneId, from, to)) }
}

export async function autonomyBetween(zoneId: string, from: Date, to: Date) {
  const { manualMs, overrideCount } = await manualTimeInZone(zoneId, from, to)
  const totalMs = to.getTime() - from.getTime()
  return {
    from, to,
    auto_mode_pct: totalMs > 0 ? +(100 * (1 - manualMs / totalMs)).toFixed(1) : null,
    manual_minutes: Math.round(manualMs / 60_000),
    override_count: overrideCount,
  }
}

export async function getBirdCountTrends(user: CurrentUser, scope: BirdCountScope, query: { days: number }) {
  const { house } = await assertHouseAccessByParams(scope, user)
  const dropThreshold = resolveBirdCountTuning(house.bird_count_tuning).return_rate_drop_pct
  const { records } = await dailyBirdCounts(String(house._id), {
    from: new Date(Date.now() - query.days * 86400_000).toISOString(),
  })

  const rates = records.filter(r => !r.incomplete).map(r => r.return_rate).filter((v): v is number => typeof v === 'number')
  const avg = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null
  const latest = rates.at(-1) ?? null
  // 7 ngày có dữ liệu trước ngày mới nhất, không gồm nó; có thể trải dài hơn 7 ngày lịch
  const prev = rates.slice(-8, -1)
  const baseline = prev.length ? prev.reduce((a, b) => a + b, 0) / prev.length : null

  const dropPercent = baseline && latest !== null ? +(((baseline - latest) / baseline) * 100).toFixed(1) : null

  return {
    house_id: String(house._id),
    days: query.days,
    records,
    flock_trend: flockTrend(records),
    avg_return_rate: avg ? +avg.toFixed(1) : null,
    latest_return_rate: latest,
    drop_percent: dropPercent,
    drop_threshold_pct: dropThreshold,
    is_significant_drop: dropPercent !== null && dropPercent > dropThreshold,
  }
}

export interface FlockPeriod {
  // Tuần: thứ Hai đầu tuần; tháng: 'YYYY-MM'
  period: string
  days: number
  mean_morning_exit: number
  // null khi kỳ trước không có ngày đủ phiên
  change_pct: number | null
}

const round1 = (n: number) => Math.round(n * 10) / 10
const DAY_MS = 86_400_000
const mondayOf = (date: string) => {
  const d = new Date(`${date}T00:00:00Z`)
  return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY_MS).toISOString().slice(0, 10)
}
const previousWeek = (monday: string) => new Date(Date.parse(`${monday}T00:00:00Z`) - 7 * DAY_MS).toISOString().slice(0, 10)
const previousMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

type FlockDay = Pick<HouseDayCounts, 'date' | 'net_exit' | 'has_morning' | 'has_evening' | 'return_rate' | 'incomplete'>

function meanByPeriod(days: FlockDay[], keyOf: (date: string) => string, prevOf: (key: string) => string): FlockPeriod[] {
  const groups = new Map<string, number[]>()
  for (const d of days) groups.set(keyOf(d.date), [...(groups.get(keyOf(d.date)) ?? []), d.net_exit])
  const means = new Map([...groups].map(([k, v]) => [k, v.reduce((a, b) => a + b, 0) / v.length]))
  return [...groups.keys()].sort().map(period => {
    const mean = means.get(period) as number
    const prev = means.get(prevOf(period))
    return {
      period, days: groups.get(period)!.length, mean_morning_exit: round1(mean),
      change_pct: prev ? round1(((mean - prev) / prev) * 100) : null,
    }
  })
}

// Số ròng phiên sáng, theo tuần (từ thứ Hai) và tháng; bỏ ngày thiếu phiên
export function flockTrend(days: FlockDay[]): { weekly: FlockPeriod[]; monthly: FlockPeriod[] } {
  const complete = days.filter(isFlockDayComplete)
  return {
    weekly: meanByPeriod(complete, mondayOf, previousWeek),
    monthly: meanByPeriod(complete, date => date.slice(0, 7), previousMonth),
  }
}

// Ghép theo ngày
export async function getEnvBirdCorrelation(user: CurrentUser, zoneId: string, query: { days: number }) {
  const { house } = await assertZoneAccess(zoneId, user)
  const from = new Date(Date.now() - query.days * 86400_000)

  const [envDaily, birdDaily] = await Promise.all([
    Telemetry.aggregate([
      { $match: { zone_id: new Types.ObjectId(zoneId), timestamp: { $gte: from } } },
      {
        $group: {
          // Giờ VN để khớp session_date
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp', timezone: 'Asia/Ho_Chi_Minh' } },
          avg_temperature: { $avg: '$temperature' },
          avg_humidity:    { $avg: '$humidity' },
          max_temperature: { $max: '$temperature' },
        },
      },
    ]),
    houseDailyCounts(String(house._id), { from: vnDate(from) }),
  ])

  // tỷ lệ của ngày không đầy đủ thấp vì thiếu số
  const birdByDate = new Map(birdDaily.filter(b => !b.incomplete).map(b => [b.date, b.return_rate]))
  const points = envDaily
    .map(e => ({
      date: e._id as string,
      avg_temperature: e.avg_temperature as number,
      max_temperature: e.max_temperature as number,
      avg_humidity: e.avg_humidity as number,
      return_rate: birdByDate.get(e._id as string) ?? null,
    }))
    .filter(p => p.return_rate !== null)
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    days: query.days,
    points,
    note: points.length === 0
      ? 'Chưa đủ dữ liệu ghép cặp môi trường + đếm chim (module VISION chưa triển khai)'
      : undefined,
  }
}
