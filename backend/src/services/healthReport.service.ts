import { Types } from 'mongoose'
import { ZoneHealthReport, IZoneHealthReport, ZoneHealthMetrics } from '@/models/zoneHealthReport.model'
import { Alert } from '@/models/alert.model'
import { BirdCountRecord } from '@/models/birdCountRecord.model'
import { Farm } from '@/models/farm.model'
import { Zone, IZone } from '@/models/houseZone.model'
import { Telemetry } from '@/models/telemetry.model'
import { autonomyBetween, inRangeSum, switchedSum } from '@/services/analytics.service'
import { logAction } from '@/services/auditLog.service'
import { notifyUser } from '@/services/notification.service'
import { assertFarmAccess, assertZoneAccess, listActiveZoneIds } from '@/utils/farmAccess.util'
import { BadRequestError, ForbiddenError, NotFoundError } from '@/utils/appError.util'
import { paginate } from '@/utils/helpers.util'
import type { CurrentUser } from '@/types'

const DAY_MS = 86400_000
/** EXPERT-FR-005 — độ dài kỳ báo cáo tự động; lịch chạy đặt ở jobs/healthReport.job.ts */
export const REPORT_PERIOD_DAYS = Number(process.env.HEALTH_REPORT_DAYS) > 0 ? Number(process.env.HEALTH_REPORT_DAYS) : 7
/** Xem theo khoảng bất kỳ: chặn khoảng quá dài để 1 request không quét cả năm telemetry */
const MAX_PREVIEW_DAYS = 92

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null)
const round1 = (v: number | null | undefined) => (typeof v === 'number' ? Math.round(v * 10) / 10 : null)

/**
 * EXPERT-FR-005 — số liệu sức khỏe của 1 Zone trong [from, to]: % thời gian nhiệt/ẩm
 * trong ngưỡng, % thời gian tự động, số lần đóng cắt relay, số cảnh báo theo loại,
 * tỷ lệ chim về, NH3/CO2 trung bình và cực đại. Hàm thuần đọc — không ghi gì.
 */
export async function buildZoneMetrics(zone: Pick<IZone, '_id' | 'thresholds'>, from: Date, to: Date): Promise<ZoneHealthMetrics> {
  const zoneId = new Types.ObjectId(String(zone._id))
  const t = zone.thresholds

  const [[tele], alertRows, [birds], autonomy] = await Promise.all([
    Telemetry.aggregate([
      { $match: { zone_id: zoneId, timestamp: { $gte: from, $lte: to } } },
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
    ]),
    Alert.aggregate<{ _id: string; count: number }>([
      { $match: { zone_id: zoneId, created_at: { $gte: from, $lte: to } } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]),
    BirdCountRecord.aggregate<{ avg: number | null }>([
      { $match: { zone_id: zoneId, timestamp: { $gte: from, $lte: to }, return_rate: { $type: 'number' } } },
      { $group: { _id: null, avg: { $avg: '$return_rate' } } },
    ]),
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
    avg_return_rate: round1(birds?.avg),
    nh3_avg: round1(tele?.nh3Avg), nh3_max: round1(tele?.nh3Max),
    co2_avg: round1(tele?.co2Avg), co2_max: round1(tele?.co2Max),
  }
}

/** Chủ farm + đồng sở hữu (không gồm Domain Expert) */
async function ownerIdsOf(farmId: unknown): Promise<string[]> {
  const farm = await Farm.findById(farmId).select('owner_id members').lean()
  if (!farm) return []
  const owners = farm.members.filter(m => m.role !== 'DOMAIN_EXPERT').map(m => String(m.user_id))
  return [...new Set([String(farm.owner_id), ...owners])]
}

async function expertIdsOf(farmId: unknown): Promise<string[]> {
  const farm = await Farm.findById(farmId).select('members').lean()
  return (farm?.members ?? []).filter(m => m.role === 'DOMAIN_EXPERT').map(m => String(m.user_id))
}

/**
 * EXPERT-FR-005/007 — tổng hợp báo cáo cho mọi Zone của farm còn hoạt động, kỳ là
 * REPORT_PERIOD_DAYS ngày tính tới `now`. Chạy lại trong cùng kỳ không tạo trùng; Zone
 * không có mẫu telemetry nào trong kỳ thì bỏ qua (chưa lắp thiết bị/đã ngừng). Báo cho
 * Farm Owner và Domain Expert của farm. Trả số báo cáo đã tạo.
 */
export async function generateWeeklyReports(now = new Date()): Promise<number> {
  const periodStart = new Date(now.getTime() - REPORT_PERIOD_DAYS * DAY_MS)
  const zones = await Zone.find({ _id: { $in: await listActiveZoneIds() } }).select('name farm_id thresholds').lean()

  let created = 0
  for (const zone of zones) {
    // Đã có báo cáo phủ phần lớn kỳ này (job chạy 2 lần, hoặc khởi động lại) → bỏ qua
    const recent = await ZoneHealthReport.exists({ zone_id: zone._id, period_end: { $gt: new Date(now.getTime() - (REPORT_PERIOD_DAYS - 0.5) * DAY_MS) } })
    if (recent) continue

    const metrics = await buildZoneMetrics(zone, periodStart, now)
    if (metrics.sample_count === 0) continue

    const report = await ZoneHealthReport.create({
      farm_id: zone.farm_id, zone_id: zone._id, period_start: periodStart, period_end: now, metrics, generated_at: now,
    })
    created++

    const recipients = [...await ownerIdsOf(zone.farm_id), ...await expertIdsOf(zone.farm_id)]
    await Promise.all(recipients.map(id => notifyUser(id, {
      title: `Báo cáo sức khỏe ${zone.name}`,
      body: `Báo cáo ${REPORT_PERIOD_DAYS} ngày của ${zone.name} đã sẵn sàng: ${metrics.humidity_in_range_pct ?? '—'}% thời gian độ ẩm trong ngưỡng, ${metrics.auto_mode_pct ?? '—'}% thời gian tự động. (Mã báo cáo ${report._id})`,
    })))
  }
  return created
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
  const to = query.to ? new Date(query.to) : new Date()
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
  report.expert_conclusion = { text, by: user._id as never, at: new Date() }
  await report.save()
  await logAction(user._id, 'HEALTH_REPORT_CONCLUDED', 'zone_health_report', String(report._id), { zone_id: String(report.zone_id), isEdit })

  const zone = await Zone.findById(report.zone_id).select('name').lean()
  await Promise.all((await ownerIdsOf(report.farm_id)).map(ownerId => notifyUser(ownerId, {
    title: `Chuyên gia ${isEdit ? 'đã sửa' : 'đã có'} kết luận cho ${zone?.name ?? 'Zone'}`,
    body: text.length > 300 ? `${text.slice(0, 300)}…` : text,
  })))
  return report
}
