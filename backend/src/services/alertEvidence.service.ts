import { Types } from 'mongoose'
import { Alert, IAlert } from '@/models/alert.model'
import { Zone } from '@/models/houseZone.model'
import { Telemetry } from '@/models/telemetry.model'
import { DEVICE_ALERT_TYPES, INFERRED_ALERT_TYPES, OPEN_STATUSES, getAlert } from '@/services/alert.service'
import { inRangeSum, pct } from '@/services/analytics.service'
import { sumHouseBuckets } from '@/services/birdCount.service'
import { BadRequestError } from '@/utils/appError.util'
import type { CurrentUser } from '@/types'

/** ALERT-FR-014 — bằng chứng lấy trong khoảng này quanh lúc cảnh báo được tạo */
export const EVIDENCE_WINDOW_MS = 30 * 60 * 1000
/** EXPERT-FR-003 — số kết luận trước cùng loại, cùng nơi được kèm theo */
const EARLIER_VERDICTS_LIMIT = 10
const DAY_MS = 86_400_000
const VN_OFFSET_MS = 7 * 3600_000

/** Nguồn không có mẫu nào trong cửa sổ là `missing`, không phải 0 (ALERT-FR-014) */
type Source<K extends string, T> = { status: 'ok' | 'missing' } & Record<K, T[]>
const source = <K extends string, T>(key: K, rows: T[]): Source<K, T> =>
  ({ status: rows.length > 0 ? 'ok' : 'missing', [key]: rows }) as Source<K, T>

/** Ngày Việt Nam "YYYY-MM-DD" → [00:00, 24:00) giờ Việt Nam */
function vnDayRange(date: string): { from: Date; to: Date } {
  const from = new Date(new Date(`${date}T00:00:00Z`).getTime() - VN_OFFSET_MS)
  return { from, to: new Date(from.getTime() + DAY_MS) }
}

async function earlierVerdicts(alert: IAlert) {
  return Alert.find({
    _id: { $ne: alert._id },
    type: alert.type,
    ...(alert.zone_id ? { zone_id: alert.zone_id } : { house_id: alert.house_id }),
    'expert_verdict.result': { $exists: true },
    created_at: { $lt: alert.created_at },
  }).sort({ created_at: -1 }).limit(EARLIER_VERDICTS_LIMIT).populate('expert_verdict.by', 'full_name').lean()
}

/**
 * ALERT-FR-014, BR-23 — dữ liệu nhiều nguồn quanh 1 cảnh báo suy luận để người kết luận tự xem;
 * hệ thống chỉ trình bày, không kết luận.
 * - NOISE_ANOMALY, SENSOR_ANOMALY, FORECAST_BREACH: ±30 phút — telemetry của zone, số đếm 5 phút của
 *   nhà chứa zone, cảnh báo thiết bị đang mở của zone;
 * - LOW_RETURN_RATE: ngày của phiên — % thời gian trong ngưỡng của từng zone trong nhà, NOISE_ANOMALY
 *   và cảnh báo thiết bị của nhà trong ngày.
 * Quyền như xem cảnh báo (getAlert): người không có quyền trên farm → 403.
 */
export async function getAlertEvidence(alertId: string, user: CurrentUser) {
  const alert = await getAlert(alertId, user)
  if (!INFERRED_ALERT_TYPES.includes(alert.type)) {
    throw BadRequestError(`Chỉ cảnh báo suy luận có bằng chứng (${INFERRED_ALERT_TYPES.join(', ')})`)
  }
  const base = { alert_id: String(alert._id), type: alert.type, earlier_verdicts: await earlierVerdicts(alert) }

  if (alert.type === 'LOW_RETURN_RATE') {
    const sessionDate = (alert.metadata?.sessionDate as string | undefined) ?? new Date(alert.created_at.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10)
    const window = vnDayRange(sessionDate)
    const zones = await Zone.find({ house_id: alert.house_id }).select('name thresholds').lean()
    const zoneIds = zones.map(z => z._id)

    const zonesInRange = await Promise.all(zones.map(async zone => {
      const t = zone.thresholds
      const [row] = await Telemetry.aggregate<{ temperatureCount: number; temperatureInRange: number; humidityCount: number; humidityInRange: number }>([
        { $match: { zone_id: zone._id, timestamp: { $gte: window.from, $lt: window.to } } },
        {
          $group: {
            _id: null,
            temperatureCount: { $sum: { $cond: [{ $isNumber: '$temperature' }, 1, 0] } },
            temperatureInRange: inRangeSum('$temperature', t.temp_min, t.temp_max),
            humidityCount: { $sum: { $cond: [{ $isNumber: '$humidity' }, 1, 0] } },
            humidityInRange: inRangeSum('$humidity', t.humidity_min, t.humidity_max),
          },
        },
      ])
      const hasData = !!row && (row.temperatureCount > 0 || row.humidityCount > 0)
      return {
        zone_id: String(zone._id), name: zone.name, status: hasData ? 'ok' : 'missing',
        temp_in_range_pct: row ? pct(row.temperatureInRange, row.temperatureCount) : null,
        humidity_in_range_pct: row ? pct(row.humidityInRange, row.humidityCount) : null,
      }
    }))
    const inDay = { created_at: { $gte: window.from, $lt: window.to } }
    const [noiseAlerts, deviceAlerts] = await Promise.all([
      Alert.find({ type: 'NOISE_ANOMALY', zone_id: { $in: zoneIds }, ...inDay }).sort({ created_at: 1 }).lean(),
      Alert.find({
        type: { $in: DEVICE_ALERT_TYPES }, $or: [{ zone_id: { $in: zoneIds } }, { house_id: alert.house_id }], ...inDay,
      }).sort({ created_at: 1 }).lean(),
    ])
    return { ...base, window, zones_in_range: zonesInRange, noise_alerts: noiseAlerts, device_alerts: deviceAlerts }
  }

  const window = {
    from: new Date(alert.created_at.getTime() - EVIDENCE_WINDOW_MS),
    to: new Date(alert.created_at.getTime() + EVIDENCE_WINDOW_MS),
  }
  const zone = alert.zone_id ? await Zone.findById(alert.zone_id).select('house_id').lean() : null
  const [samples, buckets, deviceAlerts] = await Promise.all([
    zone
      ? Telemetry.find({ zone_id: zone._id, timestamp: { $gte: window.from, $lte: window.to } })
        .select('-_id timestamp temperature humidity nh3_ppm co2_ppm sound_db').sort({ timestamp: 1 }).lean()
      : [],
    zone ? sumHouseBuckets(zone.house_id, window.from, window.to) : [],
    zone
      ? Alert.find({ zone_id: new Types.ObjectId(String(zone._id)), type: { $in: DEVICE_ALERT_TYPES }, status: { $in: OPEN_STATUSES } })
        .sort({ created_at: -1 }).lean()
      : [],
  ])
  return {
    ...base, window,
    telemetry: source('samples', samples),
    bird_counts: source('buckets', buckets),
    device_alerts: deviceAlerts,
  }
}
