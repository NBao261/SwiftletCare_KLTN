import { Types } from 'mongoose'
import { baselineAfter, stageOn } from '@/utils/houseStage.util'
import { Alert, type IAlert } from '@/models/alert.model'
import { HouseHealthDay, type HealthIndicators, type IDayWeather, type IHouseHealthDay } from '@/models/houseHealthDay.model'
import { House, Zone } from '@/models/houseZone.model'
import { Telemetry } from '@/models/telemetry.model'
import { WeatherObservation } from '@/models/weatherObservation.model'
import { BASELINE_DAYS, MIN_BASELINE_DAYS, houseDailyCounts, vnDate, type HouseDayCounts } from '@/services/birdCount.service'
import { findRecipients, notifyUser } from '@/services/notification.service'
import { overlaps, sessionWindows, type Interval } from '@/services/sessionRain.service'
import { listActiveHouseIds, listActiveHouseTechnicianIds } from '@/utils/farmAccess.util'
import { resolveBirdCountTuning, resolveHealthLevels } from '@/utils/detectionTuning.util'
import { DEFAULT_THRESHOLDS } from '@/utils/thresholds.util'
import logger from '@/utils/logger.util'
import type { HealthLevel, HealthLevels, HealthReason, HealthReasonCode, HealthSource, HealthStatus, Thresholds } from '@/types'

// gộp 4 nguồn theo đồng thuận. Chỉ ghi current_*, không đụng ratings và snapshot

export const COMPLETENESS_MIN_PCT = 80
// tối đa 1 mẫu/10 s/thiết bị
export const EXPECTED_SAMPLE_MS = 10_000
export const RAIN_MM_PER_HOUR = 1
export const RATING_WINDOW_DAYS = 7

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000
const SOURCES: HealthSource[] = ['environment', 'air', 'flock', 'noise']
// Client tự dịch; NORMAL không ghi
const reason = (
  code: HealthReasonCode, source: HealthSource | null = null, values: Record<string, unknown> = {}, level: HealthLevel | null = null,
): HealthReason => ({ code, source, level: level === 'SLIGHT' || level === 'CLEAR' ? level : null, values })
const round1 = (n: number) => Math.round(n * 10) / 10

export const vnDayStart = (date: string) => new Date(`${date}T00:00:00+07:00`)
export const addDays = (date: string, days: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)


interface ZoneSampleStats {
  zone_id: string
  zone_name: string
  env_pct: number      // % mẫu hợp lệ / kỳ vọng
  in_range_pct: number | null
  air_pct: number
  air_hours: number | null
  sound_pct: number
}

// Đếm theo khe 10 s để Zone nhiều thiết bị không tính trùng
async function zoneSampleStats(zone: { _id: unknown; name: string; thresholds?: Partial<Thresholds> }, start: Date, end: Date): Promise<ZoneSampleStats> {
  const t = { ...DEFAULT_THRESHOLDS, ...zone.thresholds }
  const num = (f: string) => ({ $isNumber: `$${f}` })
  const envValid = { $and: [num('temperature'), num('humidity')] }
  const envIn = {
    $and: [envValid,
      { $gte: ['$temperature', t.temp_min] }, { $lte: ['$temperature', t.temp_max] },
      { $gte: ['$humidity', t.humidity_min] }, { $lte: ['$humidity', t.humidity_max] }],
  }
  const airValid = { $and: [num('nh3_ppm'), num('co2_ppm')] }
  const airOver = { $and: [airValid, { $or: [{ $gt: ['$nh3_ppm', t.nh3_max] }, { $gt: ['$co2_ppm', t.co2_max] }] }] }
  const flag = (cond: unknown) => ({ $max: { $cond: [cond, 1, 0] } })

  const [row] = await Telemetry.aggregate<{ env: number; env_in: number; air: number; air_over: number; sound: number }>([
    { $match: { zone_id: new Types.ObjectId(String(zone._id)), timestamp: { $gte: start, $lt: end }, is_anomaly: { $ne: true } } },
    {
      $group: {
        _id: { $floor: { $divide: [{ $toLong: '$timestamp' }, EXPECTED_SAMPLE_MS] } },
        env: flag(envValid),
        env_out: flag({ $and: [envValid, { $not: [envIn] }] }),
        air: flag(airValid),
        air_over: flag(airOver),
        sound: flag(num('sound_db')),
      },
    },
    {
      $group: {
        _id: null,
        env: { $sum: '$env' },
        env_in: { $sum: { $cond: [{ $and: [{ $eq: ['$env', 1] }, { $eq: ['$env_out', 0] }] }, 1, 0] } },
        air: { $sum: '$air' },
        air_over: { $sum: '$air_over' },
        sound: { $sum: '$sound' },
      },
    },
  ])
  const expected = Math.max(Math.floor((end.getTime() - start.getTime()) / EXPECTED_SAMPLE_MS), 1)
  const pct = (n = 0) => (n / expected) * 100
  return {
    zone_id: String(zone._id),
    zone_name: zone.name,
    env_pct: pct(row?.env),
    in_range_pct: row?.env ? (row.env_in / row.env) * 100 : null,
    air_pct: pct(row?.air),
    air_hours: row?.air ? (row.air_over * EXPECTED_SAMPLE_MS) / HOUR_MS : null,
    sound_pct: pct(row?.sound),
  }
}

// Dưới mức là xấu
const belowLevel = (v: number, slight: number, clear: number): HealthLevel => (v < clear ? 'CLEAR' : v < slight ? 'SLIGHT' : 'NORMAL')
// Từ mức trở lên là xấu
const fromLevel = (v: number, slight: number, clear: number): HealthLevel => (v >= clear ? 'CLEAR' : v >= slight ? 'SLIGHT' : 'NORMAL')

export function isFlockDayComplete(
  day: Pick<HouseDayCounts, 'has_morning' | 'has_evening' | 'return_rate' | 'incomplete'> | undefined,
): boolean {
  return !!day && day.has_morning && day.has_evening && day.return_rate !== null && !day.incomplete
}

interface DayWeather { summary: IDayWeather | null; rainHours: Interval[] }

async function dayWeather(farmId: unknown, start: Date): Promise<DayWeather> {
  const rows = await WeatherObservation.find({ farm_id: farmId, hour: { $gte: start, $lt: new Date(start.getTime() + DAY_MS) } }).lean()
  if (rows.length === 0) return { summary: null, rainHours: [] }
  const nums = (key: 'temperature' | 'humidity' | 'precipitation_mm') =>
    rows.map(r => r[key]).filter((v): v is number => typeof v === 'number')
  const temps = nums('temperature')
  const hums = nums('humidity')
  const rain = nums('precipitation_mm')
  return {
    summary: {
      temperature_min: temps.length ? Math.min(...temps) : null,
      temperature_max: temps.length ? Math.max(...temps) : null,
      humidity_avg: hums.length ? round1(hums.reduce((a, b) => a + b, 0) / hums.length) : null,
      precipitation_mm: rain.length ? round1(rain.reduce((a, b) => a + b, 0)) : null,
      hours: rows.length,
    },
    rainHours: rows
      .filter(r => (r.precipitation_mm ?? 0) >= RAIN_MM_PER_HOUR)
      .map(r => ({ start: r.hour.getTime(), end: r.hour.getTime() + HOUR_MS })),
  }
}

export interface Assessment {
  indicators: HealthIndicators
  completeness: Record<HealthSource, boolean>
  current_status: HealthStatus
  current_reasons: HealthReason[]
  evidence: { noise_alert_ids: Types.ObjectId[] }
  weather: IDayWeather | null
}

// Ngày đang diễn ra thì kỳ vọng tính tới now; job tối hôm sau tính lại đủ
export async function computeHouseDay(houseId: string, date: string, now = new Date()): Promise<Assessment | null> {
  const house = await House.findById(houseId).select('farm_id name bird_count_tuning health_levels stage_history').lean()
  if (!house) return null
  // theo lịch sử để tính lại ngày cũ đúng giai đoạn
  const attracting = stageOn(house.stage_history, date) === 'ATTRACTING'
  const occupiedSince = baselineAfter(house.stage_history, date)
  const levels: HealthLevels = resolveHealthLevels(house.health_levels)
  const dropPct = resolveBirdCountTuning(house.bird_count_tuning).return_rate_drop_pct
  const start = vnDayStart(date)
  const end = new Date(Math.min(start.getTime() + DAY_MS, now.getTime()))

  const zones = await Zone.find({ house_id: houseId }).select('name thresholds').lean()
  const zoneStats = await Promise.all(zones.map(z => zoneSampleStats(z, start, end)))
  const complete = (key: 'env_pct' | 'air_pct' | 'sound_pct') =>
    zoneStats.length > 0 && zoneStats.every(z => z[key] >= COMPLETENESS_MIN_PCT)

  const reasons: HealthReason[] = []
  const missingReasons: HealthReason[] = []
  const indicators = {} as HealthIndicators

  // Zone thấp nhất
  const envComplete = complete('env_pct')
  const worstEnv = zoneStats.filter(z => z.in_range_pct !== null).sort((a, b) => (a.in_range_pct as number) - (b.in_range_pct as number))[0]
  const envValue = envComplete && worstEnv ? round1(worstEnv.in_range_pct as number) : null
  indicators.environment = {
    value: envValue,
    level: envValue === null ? null : belowLevel(envValue, levels.in_range_slight_pct, levels.in_range_clear_pct),
    // Để chu kỳ thu hoạch đọc lại
    details: { zones: zoneStats.map(z => ({ zone_id: z.zone_id, zone_name: z.zone_name, in_range_pct: z.in_range_pct === null ? null : round1(z.in_range_pct), valid_pct: round1(z.env_pct) })) },
  }
  if (!envComplete) {
    const short = zoneStats.filter(z => z.env_pct < COMPLETENESS_MIN_PCT).map(z => ({ zone_name: z.zone_name, valid_pct: round1(z.env_pct) }))
    missingReasons.push(zones.length === 0
      ? reason('MISSING_DATA', 'environment', { no_zones: true })
      : reason('MISSING_DATA', 'environment', { min_pct: COMPLETENESS_MIN_PCT, zones: short }))
  } else if (indicators.environment.level !== 'NORMAL') {
    reasons.push(reason('ENV_IN_RANGE', 'environment', { zone_name: worstEnv.zone_name, in_range_pct: envValue }, indicators.environment.level))
  }

  // Zone cao nhất
  const airComplete = complete('air_pct')
  const worstAir = zoneStats.filter(z => z.air_hours !== null).sort((a, b) => (b.air_hours as number) - (a.air_hours as number))[0]
  const airValue = airComplete && worstAir ? round1(worstAir.air_hours as number) : null
  indicators.air = {
    value: airValue,
    level: airValue === null ? null : fromLevel(airValue, levels.air_slight_h, levels.air_clear_h),
  }
  if (!airComplete) reasons.push(reason('NOT_ASSESSED', 'air'))
  else if (indicators.air.level !== 'NORMAL') {
    reasons.push(reason('AIR_OVER_LIMIT', 'air', { zone_name: worstAir.zone_name, hours: airValue }, indicators.air.level))
  }

  // So với các ngày đủ phiên trước đó
  const days = await houseDailyCounts(houseId, { from: addDays(date, -BASELINE_DAYS), to: date })
  const today = days.find(d => d.date === date)
  const flockComplete = isFlockDayComplete(today)
  const previous = days.filter(d => d.date < date && isFlockDayComplete(d) && (!occupiedSince || d.date > occupiedSince))
  let flockValue: number | null = null
  let flockLevel: HealthLevel | null = null
  if (attracting) {
    // không thành INSUFFICIENT_DATA vì thiếu số đếm
    reasons.push(reason('ATTRACTING_STAGE', 'flock'))
  } else if (flockComplete) {
    if (previous.length < MIN_BASELINE_DAYS) {
      flockLevel = 'NORMAL'
      reasons.push(reason('FLOCK_NO_BASELINE', 'flock', { min_days: MIN_BASELINE_DAYS, baseline_days: previous.length }))
    } else {
      const avg = previous.reduce((s, d) => s + (d.return_rate as number), 0) / previous.length
      flockValue = avg > 0 ? round1(((avg - (today!.return_rate as number)) / avg) * 100) : 0
      flockLevel = fromLevel(flockValue, dropPct / 2, dropPct)
      if (flockLevel !== 'NORMAL') {
        reasons.push(reason('FLOCK_DROP', 'flock', {
          return_rate: today!.return_rate, drop_pct: flockValue, baseline_avg: round1(avg), baseline_days: previous.length,
        }, flockLevel))
      }
    }
  } else {
    const missing = !today?.has_morning ? 'MORNING' : !today.has_evening ? 'EVENING' : today.incomplete ? 'INCOMPLETE' : 'NO_DEPARTURES'
    missingReasons.push(reason('MISSING_DATA', 'flock', { missing }))
  }
  indicators.flock = {
    value: flockValue,
    level: flockLevel,
    details: { return_rate: today?.return_rate ?? null, baseline_days: previous.length },
  }

  // Không tính đợt đã bị bác
  const noiseComplete = complete('sound_pct')
  const episodes = noiseComplete
    ? await Alert.find({
        type: 'NOISE_ANOMALY', zone_id: { $in: zones.map(z => z._id) },
        created_at: { $gte: start, $lt: new Date(start.getTime() + DAY_MS) }, status: { $ne: 'DISMISSED' },
      }).select('created_at last_seen_at').lean()
    : []
  indicators.noise = {
    value: noiseComplete ? episodes.length : null,
    level: noiseComplete ? fromLevel(episodes.length, levels.noise_slight, levels.noise_clear) : null,
  }
  if (!noiseComplete) reasons.push(reason('NOT_ASSESSED', 'noise'))
  else if (indicators.noise.level !== 'NORMAL') {
    reasons.push(reason('NOISE_EPISODES', 'noise', { episodes: episodes.length }, indicators.noise.level))
  }

  const lv = (s: HealthSource) => indicators[s].level
  const assessed = SOURCES.map(lv).filter((l): l is HealthLevel => l !== null)
  let status: HealthStatus
  if (!envComplete || (!flockComplete && !attracting)) status = 'INSUFFICIENT_DATA'
  else if (lv('flock') === 'CLEAR' && (['environment', 'air', 'noise'] as HealthSource[]).some(s => lv(s) === 'SLIGHT' || lv(s) === 'CLEAR')) status = 'ACTION'
  else if (assessed.includes('CLEAR') || assessed.filter(l => l === 'SLIGHT').length >= 2) status = 'WATCH'
  else status = 'GOOD'

  // mưa chỉ hạ ACTION khi nguồn quyết định là đàn chim + tiếng ồn
  const weather = await dayWeather(house.farm_id, start)
  if (!weather.summary) reasons.push(reason('WEATHER_UNAVAILABLE'))
  const flockAndNoiseOnly = lv('noise') !== 'NORMAL' && lv('noise') !== null
    && (lv('environment') === 'NORMAL') && (lv('air') === 'NORMAL' || lv('air') === null)
  if (status === 'ACTION' && flockAndNoiseOnly && weather.rainHours.length) {
    const windows = await sessionWindows(houseId, start)
    const episodeIntervals = episodes.map(e => ({
      start: e.created_at.getTime(),
      end: Math.max((e.last_seen_at ?? e.created_at).getTime(), e.created_at.getTime() + 1),
    }))
    const rainOnSession = weather.rainHours.some(r => windows.some(w => overlaps(r, w)))
    const rainOnNoise = weather.rainHours.some(r => episodeIntervals.some(e => overlaps(r, e)))
    if (rainOnSession && rainOnNoise) {
      status = 'WATCH'
      reasons.push(reason('RAIN_DOWNGRADE', null, { mm_per_hour: RAIN_MM_PER_HOUR }))
    }
  }

  const allReasons = status === 'INSUFFICIENT_DATA' ? [...missingReasons, ...reasons] : reasons
  if (status === 'GOOD') allReasons.unshift(reason('ALL_NORMAL'))

  return {
    indicators,
    completeness: { environment: envComplete, air: airComplete, flock: flockComplete, noise: noiseComplete },
    current_status: status,
    current_reasons: allReasons,
    evidence: { noise_alert_ids: episodes.map(e => e._id as Types.ObjectId) },
    weather: weather.summary,
  }
}

// ratings giữ nguyên. created = lần đầu có ngày này
export async function assessHouseDay(houseId: string, date: string, now = new Date()): Promise<{ day: IHouseHealthDay; created: boolean } | null> {
  const assessment = await computeHouseDay(houseId, date, now)
  if (!assessment) return null
  const house = await House.findById(houseId).select('farm_id').lean()
  if (!house) return null
  const update = {
    $set: { farm_id: house.farm_id, ...assessment, computed_at: now },
    $setOnInsert: { ratings: [] },
  }
  const run = (upsert: boolean) => HouseHealthDay.findOneAndUpdate(
    { house_id: houseId, date }, update, { upsert, new: true, includeResultMetadata: true },
  )
  let result
  try {
    result = await run(true)
  } catch (err) {
    // Hai lần tính song song: lần thua chỉ cập nhật
    if ((err as { code?: number }).code !== 11000) throw err
    result = await run(false)
  }
  if (!result.value) return null
  return { day: result.value, created: !result.lastErrorObject?.updatedExisting }
}

// Tính lại 7 ngày trước để nhận dữ liệu trễ. Lỗi ở một nhà không bỏ qua nhà sau
export async function assessAllHouses(date = vnDate(new Date()), now = new Date(), onlyHouseIds?: string[]): Promise<number> {
  const houseIds = onlyHouseIds ?? await listActiveHouseIds()
  let created = 0
  for (const id of houseIds) {
    const houseId = String(id)
    try {
      const result = await assessHouseDay(houseId, date, now)
      if (result?.created) {
        created++
        await notifyDayReady(result.day)
      }
      // Chỉ ngày đã có: nhà mới không bị sinh 7 ngày chờ chấm
      for (let back = 1; back <= RATING_WINDOW_DAYS; back++) {
        const day = addDays(date, -back)
        if (await HouseHealthDay.exists({ house_id: houseId, date: day })) await assessHouseDay(houseId, day, now)
      }
    } catch (err) {
      logger.error('Đánh giá sức khỏe nhà yến thất bại', { houseId, date, err })
    }
  }
  return created
}

// chỉ người chấm, Domain Expert không nhận
async function notifyDayReady(day: IHouseHealthDay): Promise<void> {
  const house = await House.findById(day.house_id).select('name').lean()
  const technicians = await listActiveHouseTechnicianIds(day.house_id)
  const owners = (await findRecipients(String(day.farm_id))).map(u => String(u._id))
  const recipients = [...new Set([...owners, ...technicians])]
  await Promise.all(recipients.map(id => notifyUser(id, {
    title: `Đánh giá ngày ${day.date} của ${house?.name ?? 'nhà yến'}`,
    body: 'Xem trạng thái hệ thống tính cho ngày này, rồi xác nhận hoặc sửa theo quan sát của bạn tại nhà yến.',
    ref: { kind: 'health_day', id: String(day._id) },
  })))
}

// Không throw: gọi sau khi việc chính đã xong
export async function recomputeHouseDayIfAssessed(houseId: string, date: string, now = new Date()): Promise<void> {
  try {
    if (date < addDays(vnDate(now), -RATING_WINDOW_DAYS)) return
    if (!(await HouseHealthDay.exists({ house_id: houseId, date }))) return
    await assessHouseDay(houseId, date, now)
  } catch (err) {
    logger.error('Tính lại sức khỏe ngày thất bại', { houseId, date, err })
  }
}

export async function recomputeForAlert(alert: Pick<IAlert, 'type' | 'zone_id' | 'created_at'>): Promise<void> {
  if (alert.type !== 'NOISE_ANOMALY' || !alert.zone_id) return
  const zone = await Zone.findById(alert.zone_id).select('house_id').lean().catch(() => null)
  if (zone) await recomputeHouseDayIfAssessed(String(zone.house_id), vnDate(alert.created_at))
}

