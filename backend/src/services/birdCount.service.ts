import { Types } from 'mongoose'
import { CameraNode, IN_SERVICE } from '@/models/device.model'
import { Zone } from '@/models/houseZone.model'
import { BirdCountRecord } from '@/models/birdCountRecord.model'
import { BirdCountBucket } from '@/models/birdCountBucket.model'
import { emitBirdCountUpdate } from '@/socket'
import { createAlert, resolveAlertsForNode } from '@/services/alert.service'
import { assertZoneAccess } from '@/utils/farmAccess.util'
import { resolveDetectionTuning } from '@/utils/detectionTuning.util'
import { BadRequestError, NotFoundError } from '@/utils/appError.util'
import type { BirdCountPayload, CurrentUser, SessionType } from '@/types'

const SESSION_TYPES: SessionType[] = ['MORNING_EXIT', 'EVENING_ENTRY']
const VN_OFFSET_MS = 7 * 3600_000
const DAY_MS = 86_400_000

/** VISION-FR-011 — "so với trung bình 7 ngày trước" */
const BASELINE_DAYS = 7
/** ponytail: tối thiểu 3 ngày nền chọn tay, không có nguồn — ít hơn thì 1 ngày lệch đã thành cảnh báo (SRS §0.5) */
const MIN_BASELINE_DAYS = 3
/** ponytail: khoảng tối đa 1 lần đọc bucket chọn tay (7 ngày ≈ 2016 khoảng/camera), không có nguồn (SRS §0.5) */
const MAX_BUCKET_RANGE_MS = 7 * DAY_MS

const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0
/** Ngày theo giờ Việt Nam — phiên sáng 05:30 VN là 22:30 UTC hôm trước */
export const vnDate = (d: Date) => new Date(d.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10)
/** Số ròng: chim lượn qua lại vạch đếm làm cả hai chiều phồng lên, phép trừ triệt tiêu phần đó */
const net = (main: number, opposite: number) => Math.max(main - opposite, 0)

/** VISION-FR-006/008/009/017 — gọi từ mqtt/handlers/birdCount.handler.ts */
export async function ingestBirdCount(payload: BirdCountPayload): Promise<void> {
  const { deviceId, entry_count, exit_count } = payload
  if (typeof deviceId !== 'string' || !deviceId || !isCount(entry_count) || !isCount(exit_count)) {
    throw BadRequestError('Payload bird-count không hợp lệ')
  }

  const node = await CameraNode.findOne({ device_id: deviceId, ...IN_SERVICE }).select('zone_id').lean()
  if (!node) throw NotFoundError(`Không tìm thấy CameraNode với device_id="${deviceId}"`)

  // VISION-FR-017: số đếm theo khoảng 5 phút, có cả ngoài phiên
  if (payload.kind === 'BUCKET') {
    if (!Number.isFinite(payload.bucket_start)) throw BadRequestError('Thiếu bucket_start')
    await BirdCountBucket.updateOne(
      { camera_node_id: node._id, bucket_start: new Date(payload.bucket_start as number) },
      { $set: { zone_id: node.zone_id, entry_count, exit_count } },
      { upsert: true },
    )
    return
  }

  const sessionType = payload.session_type
  if (!sessionType || !SESSION_TYPES.includes(sessionType)) throw BadRequestError('session_type không hợp lệ')

  const timestamp = new Date(Number.isFinite(payload.timestamp) ? payload.timestamp as number : Date.now())
  const sessionDate = vnDate(timestamp)

  // VISION-FR-009: tỷ lệ chim về = số ròng về buổi chiều / số ròng ra buổi sáng cùng ngày.
  // Có thể vượt 100% (chim về nhiều hơn số đã đếm ra) — không kẹp, để người xem thấy.
  let returnRate: number | undefined
  if (sessionType === 'EVENING_ENTRY') {
    const morning = await BirdCountRecord.findOne({
      camera_node_id: node._id, session_type: 'MORNING_EXIT', session_date: sessionDate,
    }).select('entry_count exit_count').lean()
    const left = morning ? net(morning.exit_count, morning.entry_count) : 0
    if (left > 0) returnRate = +((net(entry_count, exit_count) / left) * 100).toFixed(2)
  }

  await BirdCountRecord.updateOne(
    { camera_node_id: node._id, session_type: sessionType, session_date: sessionDate },
    {
      $set: {
        zone_id: node.zone_id, timestamp, entry_count, exit_count, // số thô của cả hai chiều vẫn được lưu
        ...(payload.confidence_avg !== undefined && Number.isFinite(payload.confidence_avg) && { confidence_avg: payload.confidence_avg }),
        ...(returnRate !== undefined && { return_rate: returnRate }),
      },
    },
    { upsert: true },
  )

  emitBirdCountUpdate(String(node.zone_id), {
    zoneId: String(node.zone_id), entryCount: entry_count, exitCount: exit_count,
    returnRate: returnRate ?? 0, sessionType, timestamp: timestamp.toISOString(),
  })
}

/**
 * VISION-FR-011 — tỷ lệ chim về giảm quá ngưỡng của Zone so với trung bình 7 ngày có dữ liệu
 * trước đó. Gọi từ jobs/returnRate.job.ts sau khi phiên chiều kết thúc, không dựa vào tin `final`
 * của pipeline (pipeline khởi động lại đúng lúc đổi phiên thì tin đó không bao giờ tới).
 * Chạy lại nhiều lần vẫn an toàn: `createAlert` gộp cảnh báo còn mở của cùng camera.
 * Ngày đã hồi lại thì đóng cảnh báo cũ — nếu không, dedup nuốt mọi lần giảm của những ngày sau.
 * Trả số cảnh báo mới.
 */
export async function checkReturnRateDrops(sessionDate = vnDate(new Date())): Promise<number> {
  const today = await BirdCountRecord.find({
    session_type: 'EVENING_ENTRY', session_date: sessionDate, return_rate: { $type: 'number' },
  }).select('camera_node_id zone_id return_rate').lean()

  let created = 0
  for (const rec of today) {
    const previous = await BirdCountRecord.find({
      camera_node_id: rec.camera_node_id, session_type: 'EVENING_ENTRY',
      session_date: { $lt: sessionDate }, return_rate: { $type: 'number' },
    }).sort({ session_date: -1 }).limit(BASELINE_DAYS).select('return_rate').lean()
    if (previous.length < MIN_BASELINE_DAYS) continue

    const rate = rec.return_rate as number
    const avg = previous.reduce((sum, r) => sum + (r.return_rate as number), 0) / previous.length
    const dropPct = avg > 0 ? ((avg - rate) / avg) * 100 : 0

    const zone = await Zone.findById(rec.zone_id).select('farm_id name detection_tuning').lean()
    if (!zone) continue
    // EXPERT-FR-008: Domain Expert chỉnh mức giảm theo Zone (mặc định 20%)
    const limit = resolveDetectionTuning(zone.detection_tuning).return_rate_drop_pct
    const nodeId = String(rec.camera_node_id)

    if (dropPct <= limit) {
      await resolveAlertsForNode(nodeId, 'Tỷ lệ chim về đã trở lại mức bình thường', 'LOW_RETURN_RATE')
      continue
    }

    const alert = await createAlert({
      farmId: String(zone.farm_id), zoneId: String(rec.zone_id), nodeId,
      type: 'LOW_RETURN_RATE',
      title: `Tỷ lệ chim về giảm tại ${zone.name}`,
      message: `Tỷ lệ chim về ${rate.toFixed(1)}%, giảm ${dropPct.toFixed(1)}% so với trung bình ${previous.length} ngày trước (${avg.toFixed(1)}%)`,
      metadata: { sessionDate, returnRate: rate, avg: +avg.toFixed(2), dropPct: +dropPct.toFixed(1), limit },
    })
    if (alert) created++
  }
  return created
}

/**
 * VISION-FR-017 — số chim ra/vào theo khoảng 5 phút của 1 Zone, cộng dồn các camera của Zone.
 * Dùng cho biểu đồ theo giờ và màn kiểm chứng cảnh báo của Domain Expert (±30 phút, EXPERT-FR-003).
 */
export async function getBirdCountBuckets(user: CurrentUser, zoneId: string, query: { from?: string; to?: string }) {
  await assertZoneAccess(zoneId, user)
  const to = query.to ? new Date(query.to) : new Date()
  const from = query.from ? new Date(query.from) : new Date(to.getTime() - DAY_MS)
  if (from >= to) throw BadRequestError('from phải trước to')
  if (to.getTime() - from.getTime() > MAX_BUCKET_RANGE_MS) throw BadRequestError('Khoảng thời gian tối đa 7 ngày')

  const buckets = await BirdCountBucket.aggregate<{ bucket_start: Date; entry_count: number; exit_count: number }>([
    { $match: { zone_id: new Types.ObjectId(zoneId), bucket_start: { $gte: from, $lt: to } } },
    { $group: { _id: '$bucket_start', entry_count: { $sum: '$entry_count' }, exit_count: { $sum: '$exit_count' } } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, bucket_start: '$_id', entry_count: 1, exit_count: 1 } },
  ])
  return { from, to, buckets }
}
