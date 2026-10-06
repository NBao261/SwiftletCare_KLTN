import { Types } from 'mongoose'
import { Telemetry } from '@/models/telemetry.model'
import { Zone, IZone } from '@/models/houseZone.model'
import { Alert } from '@/models/alert.model'
import { createAlert, OPEN_STATUSES } from '@/services/alert.service'
import { assertZoneAccess } from '@/utils/farmAccess.util'
import { backtestMae, fitHolt, forecastHolt } from '@/utils/forecast.util'
import type { CurrentUser } from '@/types'

const BUCKET_MS = 5 * 60_000
const HISTORY_MS = 6 * 3600_000
export const HORIZON_STEPS = 12      // 12 × 5 phút = 60 phút
const MIN_POINTS = 24                // ≥ 2 giờ dữ liệu mới dự báo
const MAX_STALENESS_MS = 15 * 60_000 // dữ liệu cũ hơn → thiết bị mất kết nối, không dự báo

type Metric = 'humidity' | 'temperature'
const METRIC_LABEL: Record<Metric, string> = { humidity: 'Độ ẩm', temperature: 'Nhiệt độ' }
const UNIT: Record<Metric, string> = { humidity: '%', temperature: '°C' }
const round1 = (v: number) => Math.round(v * 10) / 10

export interface MetricForecast {
  history: Array<{ timestamp: Date; value: number }>
  forecast: Array<{ timestamp: Date; value: number }>
  alpha: number
  beta: number
  /** Sai số tuyệt đối trung bình khi dự báo 30 / 60 phút, đánh giá lùi trên 6 giờ qua */
  mae30: number | null
  mae60: number | null
}

export interface PredictedBreach { metric: Metric; direction: 'above' | 'below'; limit: number; value: number; minutesAhead: number }

function forecastMetric(points: Array<{ timestamp: Date; value: number }>, metric: Metric): MetricForecast | null {
  if (points.length < MIN_POINTS) return null
  const values = points.map(p => p.value)
  const fit = fitHolt(values)
  if (!fit) return null
  const last = points[points.length - 1].timestamp.getTime()
  const clamp = (v: number) => (metric === 'humidity' ? Math.min(100, Math.max(0, v)) : v)
  return {
    history: points,
    forecast: forecastHolt(fit, HORIZON_STEPS).map((v, k) => ({ timestamp: new Date(last + (k + 1) * BUCKET_MS), value: round1(clamp(v)) })),
    alpha: fit.alpha,
    beta: fit.beta,
    mae30: backtestMae(values, 6, fit.alpha, fit.beta),
    mae60: backtestMae(values, HORIZON_STEPS, fit.alpha, fit.beta),
  }
}

/** ANALYTICS-FR-009 — dự báo độ ẩm/nhiệt độ 60 phút tới của 1 Zone + vượt ngưỡng dự kiến (nếu có). */
export async function computeZoneForecast(zone: Pick<IZone, '_id' | 'thresholds'>, now = new Date()) {
  const rows = await Telemetry.aggregate<{ _id: Date; humidity: number | null; temperature: number | null }>([
    { $match: { zone_id: new Types.ObjectId(String(zone._id)), timestamp: { $gte: new Date(now.getTime() - HISTORY_MS), $lte: now } } },
    {
      $group: {
        _id: { $toDate: { $subtract: [{ $toLong: '$timestamp' }, { $mod: [{ $toLong: '$timestamp' }, BUCKET_MS] }] } },
        humidity: { $avg: '$humidity' },
        temperature: { $avg: '$temperature' },
      },
    },
    { $sort: { _id: 1 } },
  ])
  const fresh = rows.length > 0 && now.getTime() - rows[rows.length - 1]._id.getTime() <= MAX_STALENESS_MS
  const pointsOf = (m: Metric) => rows.filter(r => typeof r[m] === 'number').map(r => ({ timestamp: r._id, value: round1(r[m]!) }))

  const humidity = fresh ? forecastMetric(pointsOf('humidity'), 'humidity') : null
  const temperature = fresh ? forecastMetric(pointsOf('temperature'), 'temperature') : null

  // Chỉ "sắp vượt" khi hiện tại còn trong ngưỡng — đã vượt thì THRESHOLD_BREACH lo
  const t = zone.thresholds
  const limits: Record<Metric, { min: number; max: number }> = {
    humidity: { min: t.humidity_min, max: t.humidity_max },
    temperature: { min: t.temp_min, max: t.temp_max },
  }
  let predicted: PredictedBreach | null = null
  for (const [metric, fc] of [['humidity', humidity], ['temperature', temperature]] as Array<[Metric, MetricForecast | null]>) {
    if (!fc || predicted) continue
    const current = fc.history[fc.history.length - 1].value
    const { min, max } = limits[metric]
    if (current < min || current > max) continue
    const idx = fc.forecast.findIndex(p => p.value < min || p.value > max)
    if (idx < 0) continue
    const value = fc.forecast[idx].value
    predicted = { metric, direction: value > max ? 'above' : 'below', limit: value > max ? max : min, value, minutesAhead: (idx + 1) * 5 }
  }

  return { horizonMinutes: HORIZON_STEPS * 5, bucketMinutes: BUCKET_MS / 60_000, humidity, temperature, thresholds: limits, predicted }
}

export async function getZoneForecast(user: CurrentUser, zoneId: string) {
  const { zone } = await assertZoneAccess(zoneId, user)
  return computeZoneForecast(zone)
}

/**
 * ALERT-FR-011 — cảnh báo sớm FORECAST_BREACH (mức LOW, không tự sinh ticket) cho
 * mọi Zone còn gửi telemetry trong 15 phút qua; tự đóng khi dự báo hết vượt hoặc
 * chỉ số đã vượt thật (THRESHOLD_BREACH tiếp quản). Gọi từ jobs/forecast.job.ts.
 */
export async function scanForecastBreaches(now = new Date()): Promise<{ raised: number; resolved: number }> {
  const zoneIds = await Telemetry.distinct('zone_id', { timestamp: { $gte: new Date(now.getTime() - MAX_STALENESS_MS) } })
  const zones = await Zone.find({ _id: { $in: zoneIds } }).select('_id farm_id name thresholds').lean()
  let raised = 0
  let resolved = 0

  for (const zone of zones) {
    const { predicted, humidity, temperature } = await computeZoneForecast(zone, now)
    if (predicted) {
      const fc = predicted.metric === 'humidity' ? humidity : temperature
      const mae = fc?.mae60 !== null && fc?.mae60 !== undefined ? ` (sai số dự báo trung bình ±${round1(fc.mae60)}${UNIT[predicted.metric]})` : ''
      const alert = await createAlert({
        farmId: String(zone.farm_id), zoneId: String(zone._id),
        type: 'FORECAST_BREACH',
        title: `${METRIC_LABEL[predicted.metric]} tại ${zone.name} có thể sắp vượt ngưỡng`,
        message: `Dự báo khoảng ${predicted.minutesAhead} phút nữa ${METRIC_LABEL[predicted.metric].toLowerCase()} ` +
          `${predicted.direction === 'above' ? 'lên' : 'xuống'} ${predicted.value}${UNIT[predicted.metric]} ` +
          `(ngưỡng ${predicted.limit}${UNIT[predicted.metric]})${mae}`,
        metadata: { predicted },
      })
      if (alert) raised++
    } else {
      const { modifiedCount } = await Alert.updateMany(
        { type: 'FORECAST_BREACH', zone_id: zone._id, status: { $in: OPEN_STATUSES } },
        { status: 'RESOLVED', resolved_at: now, acknowledgement_note: 'Dự báo không còn vượt ngưỡng' },
      )
      resolved += modifiedCount
    }
  }
  return { raised, resolved }
}
