import { Types } from 'mongoose'
import { Telemetry } from '@/models/telemetry.model'
import { SensorNode, IN_SERVICE } from '@/models/device.model'
import { RELAY_SERVICE_LIMITS } from '@/services/relayUsage.service'
import { BirdCountRecord } from '@/models/birdCountRecord.model'
import { assertZoneAccess } from '@/utils/farmAccess.util'
import { BadRequestError } from '@/utils/appError.util'
import type { CurrentUser } from '@/types'

/** ANALYTICS-FR-001 — các khoảng thời gian dashboard hỗ trợ */
const RANGE_MS: Record<string, number> = {
  '1h': 3600_000,
  '6h': 6 * 3600_000,
  '24h': 24 * 3600_000,
  '7d': 7 * 86400_000,
  '30d': 30 * 86400_000,
}

/**
 * Số điểm dữ liệu tối đa trả về cho biểu đồ. Telemetry ghi mỗi ~10s nên 30 ngày
 * là ~260k bản ghi — phải gom nhóm theo bucket thời gian, không thể trả thô cho
 * frontend vẽ (vỡ trình duyệt + PERF-NFR-003 P95 ≤ 500ms).
 */
const MAX_BUCKETS = 120

function resolveRange(range: string) {
  const ms = RANGE_MS[range]
  if (!ms) throw BadRequestError(`range phải là 1 trong: ${Object.keys(RANGE_MS).join(', ')}`)
  const to = new Date()
  const from = new Date(to.getTime() - ms)
  // Gom nhóm sao cho ra tối đa MAX_BUCKETS điểm, làm tròn lên phút cho dễ đọc
  const bucketMs = Math.max(60_000, Math.ceil(ms / MAX_BUCKETS / 60_000) * 60_000)
  return { from, to, bucketMs }
}

/** ANALYTICS-FR-001 — chuỗi thời gian đã gom nhóm + min/max/avg từng chỉ số */
export async function getEnvSummary(user: CurrentUser, query: { zoneId: string; range: string }) {
  await assertZoneAccess(query.zoneId, user)
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

  return { range: query.range, from, to, bucketMs, series, stats: stats ?? null }
}

/**
 * ANALYTICS-FR-008 — hiệu quả bộ điều khiển mờ của 1 Zone (ENV-FR-010/011/021):
 * chuỗi độ ẩm/nhiệt độ × % phun/quạt theo bucket, % mẫu nằm trong ngưỡng hiện tại
 * của Zone, số lần relay đóng cắt/giờ, kèm các lần chỉnh hệ số trong khoảng để
 * người vận hành so trước/sau. Chỉ tính mẫu có `misting_pct` (firmware ≥ 1.1.0).
 */
export async function getControlPerformance(user: CurrentUser, query: { zoneId: string; range: string }) {
  const { zone } = await assertZoneAccess(query.zoneId, user)
  const { from, to, bucketMs } = resolveRange(query.range)
  const t = zone.thresholds
  const match = {
    $match: { zone_id: new Types.ObjectId(query.zoneId), timestamp: { $gte: from, $lte: to }, misting_pct: { $exists: true } },
  }
  const inRange = (field: string, min: number, max: number) =>
    ({ $sum: { $cond: [{ $and: [{ $gte: [field, min] }, { $lte: [field, max] }] }, 1, 0] } })
  // Relay chỉ đổi trạng thái ở chu kỳ PID 10s còn mẫu lưu mỗi ~10s, nên đếm lần đổi
  // giữa 2 mẫu liên tiếp CỦA CÙNG 1 ESP32 (partitionBy node_id) ≈ số lần đóng cắt thật.
  const switched = (field: string, prev: string) =>
    ({ $sum: { $cond: [{ $and: [{ $ne: [prev, null] }, { $ne: [prev, field] }] }, 1, 0] } })

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
          humidityInRange:     inRange('$humidity', t.humidity_min, t.humidity_max),
          temperatureCount:    { $sum: { $cond: [{ $isNumber: '$temperature' }, 1, 0] } },
          temperatureInRange:  inRange('$temperature', t.temp_min, t.temp_max),
          mistingAvg:          { $avg: '$misting_pct' },
          ventilationAvg:      { $avg: '$ventilation_pct' },
          mistingSwitches:     switched('$misting_on', '$prevMisting'),
          ventilationSwitches: switched('$ventilation_on', '$prevVentilation'),
          firstAt:             { $min: '$timestamp' },
          lastAt:              { $max: '$timestamp' },
        },
      },
    ]),
    SensorNode.find({ zone_id: zone._id, ...IN_SERVICE }).select('device_id relay_usage').lean(),
  ])

  const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null)
  const hours = agg ? (agg.lastAt.getTime() - agg.firstAt.getTime()) / 3600_000 : 0
  const perHour = (n: number) => (hours >= 0.25 ? Math.round((n / hours) * 10) / 10 : null) // < 15' dữ liệu: chưa đủ để quy ra /giờ

  return {
    range: query.range, from, to, bucketMs,
    thresholds: { humidity_min: t.humidity_min, humidity_max: t.humidity_max, temp_min: t.temp_min, temp_max: t.temp_max },
    fuzzy_tuning: zone.fuzzy_tuning,
    tuning_changes: zone.fuzzy_tuning_history
      .filter(h => h.changed_at >= from)
      .map(h => ({ changed_at: h.changed_at, new_values: h.new_values })),
    series,
    // TICKET-FR-018 — tiến độ tới mốc bảo trì theo thời gian chạy của từng thiết bị
    service_limits: RELAY_SERVICE_LIMITS,
    relay_usage: nodes.map(n => ({
      device_id: n.device_id,
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

/** ANALYTICS-FR-005 — so sánh nhiều Zone cạnh nhau trên cùng khoảng thời gian */
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

/**
 * VISION-FR-008/010 — thống kê đếm chim theo ngày.
 * LƯU Ý: trả rỗng cho tới khi module VISION (Raspberry Pi + YOLO) đi vào hoạt
 * động và publish `vision/bird-count` — hiện chưa lắp phần cứng camera nên chưa
 * có nguồn dữ liệu, KHÔNG phải lỗi truy vấn.
 */
export async function getBirdCountDaily(
  user: CurrentUser, zoneId: string, query: { from?: string; to?: string },
) {
  await assertZoneAccess(zoneId, user)
  const to = query.to ? new Date(query.to) : new Date()
  const from = query.from ? new Date(query.from) : new Date(to.getTime() - 30 * 86400_000)

  const records = await BirdCountRecord.aggregate([
    { $match: { zone_id: new Types.ObjectId(zoneId), timestamp: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
        morning_exit:  { $max: { $cond: [{ $eq: ['$session_type', 'MORNING_EXIT'] }, '$exit_count', 0] } },
        evening_entry: { $max: { $cond: [{ $eq: ['$session_type', 'EVENING_ENTRY'] }, '$entry_count', 0] } },
        return_rate:   { $avg: '$return_rate' },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, date: '$_id', morning_exit: 1, evening_entry: 1, return_rate: 1 } },
  ])

  return { from, to, records, note: records.length === 0 ? 'Chưa có dữ liệu đếm chim — module VISION chưa triển khai' : undefined }
}

/** VISION-FR-009/011, ANALYTICS-FR-002 — xu hướng return rate + cảnh báo giảm >20% */
export async function getBirdCountTrends(user: CurrentUser, zoneId: string, query: { days: number }) {
  const { records } = await getBirdCountDaily(user, zoneId, {
    from: new Date(Date.now() - query.days * 86400_000).toISOString(),
  })

  const rates = records.map(r => r.return_rate).filter((v): v is number => typeof v === 'number')
  const avg = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null
  const latest = rates.at(-1) ?? null

  // VISION-FR-011: giảm >20% so với trung bình kỳ trước là dấu hiệu đàn bỏ tổ
  const dropPercent = avg && latest !== null ? +(((avg - latest) / avg) * 100).toFixed(1) : null

  return {
    days: query.days,
    records,
    avg_return_rate: avg ? +avg.toFixed(1) : null,
    latest_return_rate: latest,
    drop_percent: dropPercent,
    is_significant_drop: dropPercent !== null && dropPercent > 20,
  }
}

/**
 * ANALYTICS-FR-003 — tương quan môi trường vs return rate.
 * Ghép theo NGÀY: mỗi ngày lấy trung bình môi trường + return rate của ngày đó,
 * để trả lời câu hỏi nghiệp vụ "ngày nào nóng quá thì chim có bỏ về ít hơn không".
 */
export async function getEnvBirdCorrelation(user: CurrentUser, zoneId: string, query: { days: number }) {
  await assertZoneAccess(zoneId, user)
  const from = new Date(Date.now() - query.days * 86400_000)

  const [envDaily, birdDaily] = await Promise.all([
    Telemetry.aggregate([
      { $match: { zone_id: new Types.ObjectId(zoneId), timestamp: { $gte: from } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          avg_temperature: { $avg: '$temperature' },
          avg_humidity:    { $avg: '$humidity' },
          max_temperature: { $max: '$temperature' },
        },
      },
    ]),
    BirdCountRecord.aggregate([
      { $match: { zone_id: new Types.ObjectId(zoneId), timestamp: { $gte: from } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }, return_rate: { $avg: '$return_rate' } } },
    ]),
  ])

  const birdByDate = new Map(birdDaily.map(b => [b._id as string, b.return_rate as number]))
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
