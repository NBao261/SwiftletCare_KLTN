import { Types } from 'mongoose'
import { Alert } from '@/models/alert.model'
import {
  HouseHealthReport, type HouseReportKind, type HouseReportMetrics, type HouseReportZoneSection, type IHouseHealthReport,
} from '@/models/houseHealthReport.model'
import { House, Zone } from '@/models/houseZone.model'
import { WeatherObservation } from '@/models/weatherObservation.model'
import { ZoneHealthReport } from '@/models/zoneHealthReport.model'
import { DEVICE_ALERT_TYPES, INFERRED_ALERT_TYPES } from '@/services/alert.service'
import { logAction } from '@/services/auditLog.service'
import { houseDailyCounts, vnDate } from '@/services/birdCount.service'
import { RAIN_MM_PER_HOUR, addDays, isFlockDayComplete, vnDayStart } from '@/services/healthAssessment.service'
import { MAX_DAY_RANGE, presentHouseDays } from '@/services/healthDay.service'
import { buildZoneMetrics, getHealthReport, setReportConclusion as setZoneReportConclusion } from '@/services/healthReport.service'
import { findFarmExperts, findRecipients, notifyUser } from '@/services/notification.service'
import { assertHouseAccess, listActiveHouseIds, listFarmHouseIds } from '@/utils/farmAccess.util'
import { BadRequestError, ForbiddenError, NotFoundError } from '@/utils/appError.util'
import { paginate } from '@/utils/helpers.util'
import logger from '@/utils/logger.util'
import type { CurrentUser, HealthStatus } from '@/types'

/**
 * EXPERT-FR-005, 006, 013, BR-31, BR-33, SM-09 — báo cáo sức khỏe theo nhà yến, mỗi Zone một mục: ngày, tuần,
 * tháng (job) và theo yêu cầu (tối đa 31 ngày). Trạng thái các ngày của kỳ dựng lúc đọc và che theo người
 * gọi như /health-reports/days. Báo cáo tuần theo Zone cũ (healthReport.service) vẫn chạy song song cho các
 * màn hiện có; `getReport` và `setConclusion` nhận cả hai loại id.
 */

const KIND_LABEL: Record<HouseReportKind, string> = { DAILY: 'ngày', WEEKLY: 'tuần', MONTHLY: 'tháng', CUSTOM: 'theo yêu cầu' }
const round1 = (v: number | null | undefined) => (typeof v === 'number' ? Math.round(v * 10) / 10 : null)

/** Các ngày 'YYYY-MM-DD' từ `from` tới `to`, tính cả 2 đầu */
function datesBetween(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

/** Cảnh báo suy luận theo kết luận và lỗi thiết bị theo loại của 1 Zone trong [start, end) */
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

/** Tóm tắt thời tiết của kỳ (ANALYTICS-FR-013); null khi không có giờ nào */
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

/**
 * EXPERT-FR-005 — số liệu của nhà cho các ngày `from`…`to` (giờ VN). Kỳ đang diễn ra thì chỉ tính tới `now`.
 * Hàm thuần đọc — không ghi gì.
 */
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

/** Trung bình tỷ lệ chim về của các ngày đủ phiên — dùng chung lúc tạo và lúc che theo người gọi */
function averageReturnRate(trend: HouseReportMetrics['return_rate_trend']): number | null {
  const complete = trend.filter(d => d.complete && d.return_rate !== null)
  return complete.length
    ? round1(complete.reduce((s, d) => s + (d.return_rate as number), 0) / complete.length)
    : null
}

/**
 * SM-09 (new) → GENERATED — tính rồi ghi báo cáo của nhà cho 1 kỳ. Đã có cùng nhà, loại, kỳ thì tính lại số
 * liệu và giữ kết luận. Trả bản ghi và `created` = lần đầu có báo cáo này.
 */
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
    // Hai lần chạy song song cùng tạo báo cáo: lần thua chỉ cập nhật
    if ((err as { code?: number }).code !== 11000) throw err
    result = await run(false)
  }
  if (!result.value) return null
  return { report: result.value, created: !result.lastErrorObject?.updatedExisting }
}

/** EXPERT-FR-005 — báo cáo mới: báo Farm Owner và chuyên gia trong ứng dụng, không kèm trạng thái (BR-31) */
async function notifyReportReady(report: IHouseHealthReport): Promise<void> {
  const house = await House.findById(report.house_id).select('name').lean()
  const owners = (await findRecipients(String(report.farm_id))).map(u => String(u._id))
  const recipients = [...owners, ...await findFarmExperts(report.farm_id)]
  const period = report.period_start === report.period_end ? report.period_start : `${report.period_start} – ${report.period_end}`
  await Promise.all(recipients.map(id => notifyUser(id, {
    title: `Báo cáo ${KIND_LABEL[report.kind]} của ${house?.name ?? 'nhà yến'}`,
    body: `Báo cáo sức khỏe ${period} đã sẵn sàng.`,
    ref: { kind: 'health_report', id: String(report._id) },
  })))
}

/** Sinh báo cáo của mọi nhà đang hoạt động cho 1 kỳ; lỗi ở một nhà không làm bỏ qua các nhà sau */
async function generateForAllHouses(
  kind: HouseReportKind, from: string, to: string, now: Date, opts: { notify: boolean },
): Promise<number> {
  let created = 0
  for (const id of await listActiveHouseIds()) {
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

/**
 * BR-33 — báo cáo ngày, gọi từ jobs/returnRate.job.ts ngay sau đánh giá ngày. Tính lại báo cáo hôm qua (đã
 * có) cho đủ cả ngày. Không gửi thông báo riêng: thông báo "ngày đã sẵn sàng" của đánh giá ngày đi cùng lúc.
 */
export async function generateDailyReports(date = vnDate(new Date()), now = new Date()): Promise<number> {
  const created = await generateForAllHouses('DAILY', date, date, now, { notify: false })
  const yesterday = addDays(date, -1)
  for (const id of await listActiveHouseIds()) {
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

/** BR-33 — thứ Hai 06:00: 7 ngày từ thứ Hai tới Chủ nhật tuần trước */
export async function generateWeeklyHouseReports(now = new Date()): Promise<number> {
  const today = vnDate(now)
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7 // thứ Hai = 0
  const to = addDays(today, -weekday - 1)
  return generateForAllHouses('WEEKLY', addDays(to, -6), to, now, { notify: true })
}

/** BR-33 — ngày 1 lúc 06:00: trọn tháng trước */
export async function generateMonthlyHouseReports(now = new Date()): Promise<number> {
  const today = vnDate(now)
  const to = addDays(`${today.slice(0, 8)}01`, -1)
  return generateForAllHouses('MONTHLY', `${to.slice(0, 8)}01`, to, now, { notify: true })
}

// ── Đọc ──────────────────────────────────────────────────────────────────────────────────────────

export interface ListHouseReportsQuery {
  houseId?: string
  farmId?: string
  kind?: HouseReportKind
  from?: string
  to?: string
  page?: number
  limit?: number
}

/** GET /health-reports?houseId|farmId — phần tóm tắt, mới nhất trước */
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

/** Báo cáo theo nhà cho người gọi: thêm các ngày của kỳ đã che (BR-31) và số ngày theo trạng thái */
async function presentHouseReport(report: IHouseHealthReport, user: CurrentUser, now: Date) {
  const { house } = await assertHouseAccess(String(report.house_id), user)
  await report.populate('expert_conclusion.by', 'full_name')
  const days = await presentHouseDays(user, house, report.period_start, report.period_end, now)
  const status_counts: Record<HealthStatus, number> = { GOOD: 0, WATCH: 0, ACTION: 0, INSUFFICIENT_DATA: 0 }
  const hiddenDates = new Set<string>()
  for (const day of days) {
    if ('current_status' in day) status_counts[day.current_status]++
    else hiddenDates.add(day.date)
  }
  const plain = report.toObject()
  // BR-31 — tỷ lệ chim về của ngày người gọi chưa chấm cũng che như `indicators` ở API ngày (chỉ số đàn
  // chim suy từ nó); trung bình tính lại trên các ngày người đó thấy. Dữ liệu lưu không đổi.
  const metrics: HouseReportMetrics = plain.house_metrics
  const return_rate_trend = metrics.return_rate_trend.map(d =>
    (hiddenDates.has(d.date) ? { ...d, return_rate: null } : d))
  return {
    ...plain,
    _id: String(report._id), farm_id: String(report.farm_id), house_id: String(report.house_id), house_name: house.name,
    has_conclusion: !!report.expert_conclusion,
    house_metrics: { ...metrics, return_rate_trend, avg_return_rate: averageReturnRate(return_rate_trend) },
    days, status_counts, hidden_days: hiddenDates.size,
  }
}

/** GET /health-reports/:id — báo cáo theo nhà; id của báo cáo Zone cũ thì trả nguyên kiểu cũ */
export async function getReport(id: string, user: CurrentUser, now = new Date()) {
  const report = await HouseHealthReport.findById(id)
  if (report) return presentHouseReport(report, user, now)
  return getHealthReport(id, user)
}

/**
 * POST /health-reports — EXPERT-FR-005: báo cáo theo yêu cầu cho các ngày `from`…`to`, tối đa 31 ngày.
 * Cùng nhà, cùng khoảng đã có thì tính lại và trả bản đó (`created: false`). Không gửi thông báo.
 */
export async function createCustomReport(user: CurrentUser, input: { houseId: string; from: string; to: string }, now = new Date()) {
  await assertHouseAccess(input.houseId, user)
  if (input.from > input.to) throw BadRequestError('from phải không sau to')
  if (input.to > vnDate(now)) throw BadRequestError('to không được sau hôm nay')
  if (datesBetween(input.from, input.to).length > MAX_DAY_RANGE) throw BadRequestError(`Khoảng tối đa ${MAX_DAY_RANGE} ngày`)
  const result = await generateHouseReport('CUSTOM', input.houseId, input.from, input.to, now)
  if (!result) throw NotFoundError('Không tìm thấy nhà yến')
  return { data: await presentHouseReport(result.report, user, now), created: result.created }
}

/**
 * PUT /health-reports/:id/conclusion — EXPERT-FR-006, SM-09 GENERATED → CONCLUDED. Chỉ Domain Expert (route);
 * chỉ tác giả sửa được kết luận của mình (lưu `edited_at`); báo mọi Farm Owner. Id của báo cáo Zone cũ thì
 * dùng nguyên luồng cũ.
 */
export async function setConclusion(id: string, user: CurrentUser, text: string, now = new Date()) {
  const report = await HouseHealthReport.findById(id)
  if (!report) {
    if (!(await ZoneHealthReport.exists({ _id: id }))) throw NotFoundError('Không tìm thấy báo cáo sức khỏe')
    return setZoneReportConclusion(id, user, text)
  }
  const { house } = await assertHouseAccess(String(report.house_id), user)
  if (report.expert_conclusion && String(report.expert_conclusion.by) !== user._id) {
    throw ForbiddenError('Kết luận này do chuyên gia khác viết — chỉ người viết mới sửa được')
  }
  const isEdit = !!report.expert_conclusion
  report.expert_conclusion = isEdit
    ? { text, by: user._id as never, at: report.expert_conclusion!.at, edited_at: now }
    : { text, by: user._id as never, at: now }
  await report.save()
  // farmId, house_id: vào lịch sử hoạt động chuyên gia và lọc được theo nhà (EXPERT-FR-009)
  await logAction(user._id, 'HEALTH_REPORT_CONCLUDED', 'house_health_report', String(report._id), {
    house_id: String(report.house_id), kind: report.kind, isEdit,
  }, { farmId: String(report.farm_id) })

  // Không chờ gửi: kết luận đã lưu, Telegram chậm không được giữ response
  for (const owner of await findRecipients(String(report.farm_id))) {
    void notifyUser(String(owner._id), {
      title: `Chuyên gia ${isEdit ? 'đã sửa' : 'đã có'} kết luận cho báo cáo ${KIND_LABEL[report.kind]} của ${house.name}`,
      body: text.length > 300 ? `${text.slice(0, 300)}…` : text,
      ref: { kind: 'health_report', id: String(report._id) },
    })
  }
  return presentHouseReport(report, user, now)
}
