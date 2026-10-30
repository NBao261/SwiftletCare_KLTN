import { Types } from 'mongoose'
import { ZoneHealthReport, IZoneHealthReport, ZoneHealthMetrics } from '@/models/zoneHealthReport.model'
import { Alert } from '@/models/alert.model'
import { averageReturnRate, houseDailyCounts, vnDate } from '@/services/birdCount.service'
import { Zone, IZone } from '@/models/houseZone.model'
import { Telemetry } from '@/models/telemetry.model'
import { autonomyBetween, inRangeSum, pct, switchedSum } from '@/services/analytics.service'
import { logAction } from '@/services/auditLog.service'
import { findFarmExperts, findRecipients, notifyUser } from '@/services/notification.service'
import { assertFarmAccess, assertZoneAccess, listActiveZoneIds } from '@/utils/farmAccess.util'
import { BadRequestError, ForbiddenError, NotFoundError } from '@/utils/appError.util'
import { paginate } from '@/utils/helpers.util'
import logger from '@/utils/logger.util'
import type { CurrentUser } from '@/types'

const DAY_MS = 86400_000
/** EXPERT-FR-005 — độ dài kỳ báo cáo tự động; lịch chạy đặt ở jobs/healthReport.job.ts */
export const REPORT_PERIOD_DAYS = Number(process.env.HEALTH_REPORT_DAYS) > 0 ? Number(process.env.HEALTH_REPORT_DAYS) : 7
/** Xem theo khoảng bất kỳ: chặn khoảng quá dài để 1 request không quét cả năm telemetry */
const MAX_PREVIEW_DAYS = 30

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

/** Chủ farm + đồng sở hữu — cùng luật người nhận với cảnh báo vận hành (notification.findRecipients) */
async function ownerIdsOf(farmId: unknown): Promise<string[]> {
  return (await findRecipients(String(farmId))).map(u => String(u._id))
}

/**
 * EXPERT-FR-005/007 — tổng hợp báo cáo cho mọi Zone của farm còn hoạt động, kỳ là
 * REPORT_PERIOD_DAYS ngày tính tới `now`. Chạy lại trong cùng kỳ không tạo trùng; Zone
 * không có mẫu telemetry nào trong kỳ thì bỏ qua (chưa lắp thiết bị/đã ngừng). Báo cho
 * Farm Owner và Domain Expert của farm. Trả số báo cáo đã tạo.
 */
export async function generateWeeklyReports(at = new Date()): Promise<number> {
  // Làm tròn xuống phút: hai lần chạy do cùng một nhịp cron cho cùng `period_end`, để
  // unique index (zone_id, period_end) chặn được báo cáo trùng
  const now = new Date(Math.floor(at.getTime() / 60_000) * 60_000)
  const periodStart = new Date(now.getTime() - REPORT_PERIOD_DAYS * DAY_MS)
  const zones = await Zone.find({ _id: { $in: await listActiveZoneIds() } }).select('name farm_id house_id thresholds').lean()

  let created = 0
  for (const zone of zones) {
    // Một Zone lỗi (dữ liệu hỏng, aggregate quá tải) không được làm các Zone sau mất báo cáo kỳ này
    try {
      if (await generateZoneReport(zone, periodStart, now)) created++
    } catch (err) {
      logger.error('Tạo báo cáo sức khỏe Zone thất bại', { err, zoneId: String(zone._id) })
    }
  }
  return created
}

async function generateZoneReport(
  zone: Pick<IZone, '_id' | 'name' | 'farm_id' | 'house_id' | 'thresholds'>, periodStart: Date, now: Date,
): Promise<boolean> {
  // Đã có báo cáo phủ phần lớn kỳ này (job chạy 2 lần, hoặc khởi động lại) → bỏ qua
  const recent = await ZoneHealthReport.exists({ zone_id: zone._id, period_end: { $gt: new Date(now.getTime() - (REPORT_PERIOD_DAYS - 0.5) * DAY_MS) } })
  if (recent) return false

  const metrics = await buildZoneMetrics(zone, periodStart, now)
  if (metrics.sample_count === 0) return false

  let report
  try {
    report = await ZoneHealthReport.create({
      farm_id: zone.farm_id, zone_id: zone._id, period_start: periodStart, period_end: now, metrics, generated_at: now,
    })
  } catch (err) {
    // Lần chạy song song đã tạo báo cáo của đúng kỳ này — nó cũng lo phần thông báo
    if ((err as { code?: number }).code === 11000) return false
    throw err
  }

  const recipients = [...await ownerIdsOf(zone.farm_id), ...await findFarmExperts(zone.farm_id)]
  await Promise.all(recipients.map(id => notifyUser(id, {
    title: `Báo cáo sức khỏe ${zone.name}`,
    body: `Báo cáo ${REPORT_PERIOD_DAYS} ngày của ${zone.name} đã sẵn sàng: ${metrics.humidity_in_range_pct ?? '—'}% thời gian độ ẩm trong ngưỡng, ${metrics.auto_mode_pct ?? '—'}% thời gian tự động. (Mã báo cáo ${report._id})`,
    ref: { kind: 'health_report', id: String(report._id) },
  })))
  return true
}

/** EXPERT-FR-005 — danh sách báo cáo của 1 Zone, mới nhất trước */
export async function listHealthReports(user: CurrentUser, query: { zoneId: string; page?: number; limit?: number }) {
  await assertZoneAccess(query.zoneId, user)
  const { page, skip, limit } = paginate(query.page, query.limit)
  const filter = { zone_id: query.zoneId }
  const [records, total] = await Promise.all([
    ZoneHealthReport.find(filter).sort({ period_end: -1 }).skip(skip).limit(limit)
      .populate('expert_conclusion.by', 'full_name').lean(),
    ZoneHealthReport.countDocuments(filter),
  ])
  return { records, total, page, limit }
}

export async function getHealthReport(id: string, user: CurrentUser): Promise<IZoneHealthReport> {
  const report = await ZoneHealthReport.findById(id).populate('expert_conclusion.by', 'full_name')
  if (!report) throw NotFoundError('Không tìm thấy báo cáo sức khỏe')
  await assertFarmAccess(String(report.farm_id), user)
  return report
}

/** EXPERT-FR-005 — xem số liệu theo khoảng bất kỳ, không lưu */
export async function previewHealthReport(user: CurrentUser, query: { zoneId: string; from: string; to?: string }) {
  const { zone } = await assertZoneAccess(query.zoneId, user)
  // `to` ở tương lai thì phần chưa xảy ra bị tính vào mẫu số của tỷ lệ thời gian tự động
  const now = new Date()
  const to = query.to && new Date(query.to) < now ? new Date(query.to) : now
  const from = new Date(query.from)
  if (!(from < to)) throw BadRequestError('from phải trước to')
  if (to.getTime() - from.getTime() > MAX_PREVIEW_DAYS * DAY_MS) throw BadRequestError(`Khoảng xem tối đa ${MAX_PREVIEW_DAYS} ngày`)
  return { zone_id: zone._id, farm_id: zone.farm_id, period_start: from, period_end: to, metrics: await buildZoneMetrics(zone, from, to) }
}

/**
 * EXPERT-FR-006 — Domain Expert viết kết luận và khuyến nghị cho 1 báo cáo. Người viết
 * sửa được kết luận của mình (lưu thời điểm sửa); chuyên gia khác không ghi đè. Farm
 * Owner nhận thông báo để đọc.
 */
export async function setReportConclusion(id: string, user: CurrentUser, text: string): Promise<IZoneHealthReport> {
  const report = await ZoneHealthReport.findById(id)
  if (!report) throw NotFoundError('Không tìm thấy báo cáo sức khỏe')
  await assertFarmAccess(String(report.farm_id), user)
  if (report.expert_conclusion && String(report.expert_conclusion.by) !== user._id) {
    throw ForbiddenError('Kết luận này do chuyên gia khác viết — chỉ người viết mới sửa được')
  }

  const isEdit = !!report.expert_conclusion
  const now = new Date()
  report.expert_conclusion = isEdit
    ? { text, by: user._id as never, at: report.expert_conclusion!.at, edited_at: now }
    : { text, by: user._id as never, at: now }
  await report.save()
  // farmId: vào lịch sử hoạt động chuyên gia (EXPERT-FR-009); Farm Owner đã được báo ngay dưới (EXPERT-FR-006)
  await logAction(user._id, 'HEALTH_REPORT_CONCLUDED', 'zone_health_report', String(report._id), {
    zone_id: String(report.zone_id), isEdit,
  }, { farmId: String(report.farm_id) })

  const zone = await Zone.findById(report.zone_id).select('name').lean()
  // Không chờ gửi: kết luận đã lưu, Telegram chậm không được giữ response
  for (const ownerId of await ownerIdsOf(report.farm_id)) {
    void notifyUser(ownerId, {
      title: `Chuyên gia ${isEdit ? 'đã sửa' : 'đã có'} kết luận cho ${zone?.name ?? 'Zone'}`,
      body: text.length > 300 ? `${text.slice(0, 300)}…` : text,
      ref: { kind: 'health_report', id: String(report._id) },
    })
  }
  // Cùng hình dạng với GET /health-reports/:id (`by` = {_id, full_name}) để client thay cache được
  return report.populate('expert_conclusion.by', 'full_name')
}
