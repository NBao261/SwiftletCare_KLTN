import { Types } from 'mongoose'
import { Alert } from '@/models/alert.model'
import {
  HouseHealthReport, type HouseReportKind, type HouseReportMetrics, type HouseReportZoneSection, type IHouseHealthReport,
} from '@/models/houseHealthReport.model'
import { House, Zone } from '@/models/houseZone.model'
import { WeatherObservation } from '@/models/weatherObservation.model'
import { DEVICE_ALERT_TYPES, INFERRED_ALERT_TYPES } from '@/services/alert.service'
import { logAction } from '@/services/auditLog.service'
import { houseDailyCounts, vnDate } from '@/services/birdCount.service'
import { RAIN_MM_PER_HOUR, addDays, isFlockDayComplete, vnDayStart } from '@/services/healthAssessment.service'
import { MAX_DAY_RANGE, presentHouseDays } from '@/services/healthDay.service'
import { buildZoneMetrics } from '@/services/healthReport.service'
import { findFarmExperts, findRecipients, notifyUser } from '@/services/notification.service'
import { assertHouseAccess, listActiveHouseIds, listFarmHouseIds } from '@/utils/farmAccess.util'
import { BadRequestError, ForbiddenError, NotFoundError } from '@/utils/appError.util'
import { paginate } from '@/utils/helpers.util'
import logger from '@/utils/logger.util'
import type { CurrentUser, HealthStatus } from '@/types'

/** BR-33: mỗi Zone một mục; trạng thái các ngày dựng lúc đọc như /health-reports/days */

const KIND_LABEL: Record<HouseReportKind, string> = { DAILY: 'ngày', WEEKLY: 'tuần', MONTHLY: 'tháng', CUSTOM: 'theo yêu cầu' }
const round1 = (v: number | null | undefined) => (typeof v === 'number' ? Math.round(v * 10) / 10 : null)

/** Tính cả 2 đầu */
function datesBetween(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

async function zoneAlertSummary(zoneId: unknown, start: Date, end: Date) {
  const rows = await Alert.aggregate<{ _id: { type: string; verdict: string | null }; count: number }>([
    { $match: { zone_id: new Types.ObjectId(String(zoneId)), created_at: { $gte: start, $lt: end } } },
    { $group: { _id: { type: '$type', verdict: { $ifNull: ['$expert_verdict.result', null] } }, count: { $sum: 1 } } },
  ])
  const inferred = { confirmed: 0, dismissed: 0, pending: 0 }
  const deviceFaults: Record<string, number> = {}
  for (const { _id, count } of rows) {
    if (INFERRED_ALERT_TYPES.includes(_id.type as never)) {
      if (_id.verdict === 'CONFIRMED') inferred.confirmed += count
      else if (_id.verdict === 'REJECTED') inferred.dismissed += count
      else inferred.pending += count
    } else if (DEVICE_ALERT_TYPES.includes(_id.type as never)) {
      deviceFaults[_id.type] = (deviceFaults[_id.type] ?? 0) + count
    }
  }
  return { inferred_alerts: inferred, device_faults: deviceFaults }
}

/** null khi không có giờ nào */
async function periodWeather(farmId: unknown, start: Date, end: Date): Promise<HouseReportMetrics['weather']> {
  const rows = await WeatherObservation.find({ farm_id: farmId, hour: { $gte: start, $lt: end } }).lean()
  if (rows.length === 0) return null
  const nums = (key: 'temperature' | 'humidity' | 'precipitation_mm') =>
    rows.map(r => r[key]).filter((v): v is number => typeof v === 'number')
  const temps = nums('temperature')
  const hums = nums('humidity')
  const rain = nums('precipitation_mm')
  return {
    temperature_min: temps.length ? Math.min(...temps) : null,
    temperature_max: temps.length ? Math.max(...temps) : null,
    humidity_avg: hums.length ? round1(hums.reduce((a, b) => a + b, 0) / hums.length) : null,
    precipitation_mm: rain.length ? round1(rain.reduce((a, b) => a + b, 0)) : null,
    rain_days: new Set(rows.filter(r => (r.precipitation_mm ?? 0) >= RAIN_MM_PER_HOUR).map(r => vnDate(r.hour))).size,
  }
}

/** Kỳ đang diễn ra chỉ tính tới now. Không ghi */
export async function buildHouseReport(
  house: { _id: unknown; farm_id: unknown }, from: string, to: string, now = new Date(),
): Promise<{ house_metrics: HouseReportMetrics; zone_sections: HouseReportZoneSection[] }> {
  const start = vnDayStart(from)
  const end = new Date(Math.min(vnDayStart(addDays(to, 1)).getTime(), now.getTime()))
  const zones = await Zone.find({ house_id: house._id }).select('name house_id thresholds').sort({ name: 1 }).lean()

  const [zone_sections, counts, weather] = await Promise.all([
    Promise.all(zones.map(async zone => ({
      zone_id: zone._id,
      zone_name: zone.name,
      ...await buildZoneMetrics(zone, start, end),
      ...await zoneAlertSummary(zone._id, start, end),
    }))),
    houseDailyCounts(String(house._id), { from, to }),
    periodWeather(house.farm_id, start, end),
  ])

  const byDate = new Map(counts.map(d => [d.date, d]))
  const return_rate_trend = datesBetween(from, to).map(date => {
    const day = byDate.get(date)
    return { date, return_rate: day?.return_rate ?? null, complete: isFlockDayComplete(day) }
  })
  return { house_metrics: { return_rate_trend, avg_return_rate: averageReturnRate(return_rate_trend), weather }, zone_sections }
}

/** Các ngày đủ phiên */
function averageReturnRate(trend: HouseReportMetrics['return_rate_trend']): number | null {
  const complete = trend.filter(d => d.complete && d.return_rate !== null)
  return complete.length
    ? round1(complete.reduce((s, d) => s + (d.return_rate as number), 0) / complete.length)
    : null
}

/** Đã có thì tính lại và giữ kết luận. created = lần đầu */
export async function generateHouseReport(
  kind: HouseReportKind, houseId: string, from: string, to: string, now = new Date(),
): Promise<{ report: IHouseHealthReport; created: boolean } | null> {
  const house = await House.findById(houseId).select('farm_id').lean()
  if (!house) return null
  const data = await buildHouseReport(house, from, to, now)
  const run = (upsert: boolean) => HouseHealthReport.findOneAndUpdate(
    { house_id: house._id, kind, period_start: from, period_end: to },
    { $set: { farm_id: house.farm_id, generated_at: now, ...data } },
    { upsert, new: true, includeResultMetadata: true },
  )
  let result
  try {
    result = await run(true)
  } catch (err) {
    // Hai lần chạy song song: lần thua chỉ cập nhật
    if ((err as { code?: number }).code !== 11000) throw err
    result = await run(false)
  }
  if (!result.value) return null
  return { report: result.value, created: !result.lastErrorObject?.updatedExisting }
}

async function notifyReportReady(report: IHouseHealthReport): Promise<void> {
  const house = await House.findById(report.house_id).select('name').lean()
  const owners = (await findRecipients(String(report.farm_id))).map(u => String(u._id))
  const recipients = [...owners, ...await findFarmExperts(report.farm_id)]
  const period = report.period_start === report.period_end ? report.period_start : `${report.period_start} – ${report.period_end}`
  await Promise.all(recipients.map(id => notifyUser(id, {
    title: `Báo cáo ${KIND_LABEL[report.kind]} của ${house?.name ?? 'nhà yến'}`,
    body: `Báo cáo sức khoẻ ${period} đã sẵn sàng.`,
    ref: { kind: 'health_report', id: String(report._id) },
  })))
}

/** Lỗi ở một nhà không bỏ qua nhà sau */
async function generateForAllHouses(
  kind: HouseReportKind, from: string, to: string, now: Date, opts: { notify: boolean }, onlyHouseIds?: string[],
): Promise<number> {
  let created = 0
  for (const id of onlyHouseIds ?? await listActiveHouseIds()) {
    try {
      const result = await generateHouseReport(kind, String(id), from, to, now)
      if (result?.created) {
        created++
        if (opts.notify) await notifyReportReady(result.report)
      }
    } catch (err) {
      logger.error('Tạo báo cáo sức khỏe nhà yến thất bại', { houseId: String(id), kind, from, to, err })
    }
  }
  return created
}

/** Tính lại báo cáo hôm qua cho đủ ngày. Không gửi thông báo riêng */
export async function generateDailyReports(date = vnDate(new Date()), now = new Date(), onlyHouseIds?: string[]): Promise<number> {
  const created = await generateForAllHouses('DAILY', date, date, now, { notify: false }, onlyHouseIds)
  const yesterday = addDays(date, -1)
  for (const id of onlyHouseIds ?? await listActiveHouseIds()) {
    try {
      if (await HouseHealthReport.exists({ house_id: id, kind: 'DAILY', period_start: yesterday })) {
        await generateHouseReport('DAILY', String(id), yesterday, yesterday, now)
      }
    } catch (err) {
      logger.error('Tính lại báo cáo ngày hôm qua thất bại', { houseId: String(id), date: yesterday, err })
    }
  }
  return created
}

export async function generateWeeklyHouseReports(now = new Date()): Promise<number> {
  const today = vnDate(now)
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7 // thứ Hai = 0
  const to = addDays(today, -weekday - 1)
  return generateForAllHouses('WEEKLY', addDays(to, -6), to, now, { notify: true })
}

export async function generateMonthlyHouseReports(now = new Date()): Promise<number> {
  const today = vnDate(now)
  const to = addDays(`${today.slice(0, 8)}01`, -1)
  return generateForAllHouses('MONTHLY', `${to.slice(0, 8)}01`, to, now, { notify: true })
}

export interface ListHouseReportsQuery {
  houseId?: string
  farmId?: string
  kind?: HouseReportKind
  from?: string
  to?: string
  // false: chưa có kết luận (đếm "chờ kết luận")
  hasConclusion?: boolean
  page?: number
  limit?: number
}

export async function listHouseReports(user: CurrentUser, query: ListHouseReportsQuery) {
  let houseIds: unknown[]
  if (query.houseId) houseIds = [(await assertHouseAccess(query.houseId, user)).house._id]
  else if (query.farmId) houseIds = await listFarmHouseIds(query.farmId, user)
  else throw BadRequestError('Cần houseId hoặc farmId')
  if (query.from && query.to && query.from > query.to) throw BadRequestError('from phải không sau to')

  const filter = {
    house_id: { $in: houseIds },
    ...(query.kind && { kind: query.kind }),
    ...(query.from && { period_end: { $gte: query.from } }),
    ...(query.to && { period_start: { $lte: query.to } }),
    ...(query.hasConclusion !== undefined && { expert_conclusion: query.hasConclusion ? { $ne: null } : null }),
  }
  const { page, skip, limit } = paginate(query.page, query.limit)
  const [rows, total] = await Promise.all([
    HouseHealthReport.find(filter).select('-house_metrics -zone_sections').sort({ period_end: -1, kind: 1 })
      .skip(skip).limit(limit).lean(),
    HouseHealthReport.countDocuments(filter),
  ])
  const names = new Map((await House.find({ _id: { $in: rows.map(r => r.house_id) } }).select('name').lean())
    .map(h => [String(h._id), h.name]))
  const records = rows.map(r => ({
    _id: String(r._id), farm_id: String(r.farm_id), house_id: String(r.house_id), house_name: names.get(String(r.house_id)) ?? '',
    kind: r.kind, period_start: r.period_start, period_end: r.period_end, generated_at: r.generated_at,
    has_conclusion: !!r.expert_conclusion,
  }))
  return { records, total, page, limit }
}

async function presentHouseReport(report: IHouseHealthReport, user: CurrentUser, now: Date) {
  const { house } = await assertHouseAccess(String(report.house_id), user)
  await report.populate('expert_conclusion.by', 'full_name')
  const days = await presentHouseDays(user, house, report.period_start, report.period_end, now)
  const status_counts: Record<HealthStatus, number> = { GOOD: 0, WATCH: 0, ACTION: 0, INSUFFICIENT_DATA: 0 }
  for (const day of days) status_counts[day.current_status]++
  const plain = report.toObject()
  const metrics: HouseReportMetrics = plain.house_metrics
  // Bản cũ có thể thiếu object rỗng: bù lại cho đúng api-spec
  const sections: Partial<HouseReportZoneSection>[] = plain.zone_sections ?? []
  const zone_sections = sections.map(section => ({
    ...section,
    alerts_by_type: section.alerts_by_type ?? {},
    device_faults: section.device_faults ?? {},
  }))
  return {
    ...plain,
    _id: String(report._id), farm_id: String(report.farm_id), house_id: String(report.house_id), house_name: house.name,
    zone_sections,
    expert_conclusion: plain.expert_conclusion ?? null,
    has_conclusion: !!report.expert_conclusion,
    house_metrics: metrics,
    days, status_counts,
  }
}

export async function getReport(id: string, user: CurrentUser, now = new Date()) {
  const report = await HouseHealthReport.findById(id)
  if (!report) throw NotFoundError('Không tìm thấy báo cáo sức khỏe')
  return presentHouseReport(report, user, now)
}

/** Đã có cùng khoảng thì tính lại và trả bản đó. Không gửi thông báo */
export async function createCustomReport(user: CurrentUser, input: { houseId: string; from: string; to: string }, now = new Date()) {
  await assertHouseAccess(input.houseId, user)
  if (input.from > input.to) throw BadRequestError('from phải không sau to')
  if (input.to > vnDate(now)) throw BadRequestError('to không được sau hôm nay')
  if (datesBetween(input.from, input.to).length > MAX_DAY_RANGE) throw BadRequestError(`Khoảng tối đa ${MAX_DAY_RANGE} ngày`)
  const result = await generateHouseReport('CUSTOM', input.houseId, input.from, input.to, now)
  if (!result) throw NotFoundError('Không tìm thấy nhà yến')
  return { data: await presentHouseReport(result.report, user, now), created: result.created }
}

/** Chỉ tác giả sửa được kết luận của mình */
export async function setConclusion(id: string, user: CurrentUser, text: string, now = new Date()) {
  const report = await HouseHealthReport.findById(id)
  if (!report) throw NotFoundError('Không tìm thấy báo cáo sức khỏe')
  const { house } = await assertHouseAccess(String(report.house_id), user)
  if (report.expert_conclusion && String(report.expert_conclusion.by) !== user._id) {
    throw ForbiddenError('Kết luận này do chuyên gia khác viết — chỉ người viết mới sửa được')
  }
  const isEdit = !!report.expert_conclusion
  report.expert_conclusion = isEdit
    ? { text, by: user._id as never, at: report.expert_conclusion!.at, edited_at: now }
    : { text, by: user._id as never, at: now }
  await report.save()
  // Để lọc lịch sử chuyên gia theo nhà (EXPERT-FR-009)
  await logAction(user._id, 'HEALTH_REPORT_CONCLUDED', 'house_health_report', String(report._id), {
    house_id: String(report.house_id), kind: report.kind, isEdit,
  }, { farmId: String(report.farm_id) })

  // Không chờ gửi: Telegram chậm không được giữ response
  for (const owner of await findRecipients(String(report.farm_id))) {
    void notifyUser(String(owner._id), {
      title: `Chuyên gia ${isEdit ? 'đã sửa' : 'đã có'} kết luận cho báo cáo ${KIND_LABEL[report.kind]} của ${house.name}`,
      body: text.length > 300 ? `${text.slice(0, 300)}…` : text,
      ref: { kind: 'health_report', id: String(report._id) },
    })
  }
  return presentHouseReport(report, user, now)
}
