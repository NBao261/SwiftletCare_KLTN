import { Types } from 'mongoose'
import { CameraNode, IN_SERVICE } from '@/models/device.model'
import { House } from '@/models/houseZone.model'
import { BirdCountRecord } from '@/models/birdCountRecord.model'
import { BirdCountBucket } from '@/models/birdCountBucket.model'
import { emitBirdCountUpdate } from '@/socket'
import { createAlert, resolveHouseAlerts } from '@/services/alert.service'
import { assertHouseAccessByParams } from '@/utils/farmAccess.util'
import { resolveBirdCountTuning } from '@/utils/detectionTuning.util'
import { BadRequestError, NotFoundError } from '@/utils/appError.util'
import logger from '@/utils/logger.util'
import type { BirdCountPayload, CurrentUser, SessionType } from '@/types'

const SESSION_TYPES: SessionType[] = ['MORNING_EXIT', 'EVENING_ENTRY']
const VN_OFFSET_MS = 7 * 3600_000
const DAY_MS = 86_400_000
/** VISION-FR-017 — khoảng 5 phút */
const BUCKET_MS = 5 * 60_000

/** VISION-FR-011 — "so với trung bình 7 ngày trước" */
export const BASELINE_DAYS = 7
/** ponytail: tối thiểu 3 ngày nền chọn tay, không có nguồn — ít hơn thì 1 ngày lệch đã thành cảnh báo (SRS §0.5) */
export const MIN_BASELINE_DAYS = 3
/** ponytail: khoảng tối đa 1 lần đọc bucket chọn tay (7 ngày ≈ 2016 khoảng/camera), không có nguồn (SRS §0.5) */
const MAX_BUCKET_RANGE_MS = 7 * DAY_MS
/** ponytail: khoảng đọc mặc định khi không gửi from (24 giờ gần nhất) chọn tay, không có nguồn (SRS §0.5) */
const DEFAULT_BUCKET_RANGE_MS = DAY_MS

const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0
/** Ngày theo giờ Việt Nam — phiên sáng 05:30 VN là 22:30 UTC hôm trước */
export const vnDate = (d: Date) => new Date(d.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10)
/** Số ròng: chim lượn qua lại vạch đếm làm cả hai chiều phồng lên, phép trừ triệt tiêu phần đó */
const net = (main: number, opposite: number) => Math.max(main - opposite, 0)

/**
 * Số đếm 1 ngày (giờ VN) của 1 nhà yến (House). Nguồn duy nhất cho `/current`, `/daily`, `/trends`,
 * `/correlation`, socket `BIRD_COUNT_UPDATE`, job `LOW_RETURN_RATE`, báo cáo sức khỏe Zone và ảnh chụp
 * đàn khi thu hoạch (Zone lấy số của House chứa nó).
 */
export interface HouseDayCounts {
  date: string
  /** Số thô, cộng mọi camera của nhà (1–2 cửa ra vào) */
  morning_entry: number
  morning_exit: number
  evening_entry: number
  evening_exit: number
  /** Ra − vào của phiên sáng, không âm */
  net_exit: number
  /** Vào − ra của phiên chiều, không âm */
  net_entry: number
  /** VISION-FR-009 — net_entry / net_exit × 100; null khi thiếu phiên sáng/chiều hoặc sáng không có chim ra */
  return_rate: number | null
  has_morning: boolean
  has_evening: boolean
  /** Tin mới nhất của ngày (null khi chưa có tin) */
  updated_at: Date | null
}

const sumIf = (session: SessionType, value: string | number) =>
  ({ $sum: { $cond: [{ $eq: ['$session_type', session] }, value, 0] } })

function toDayCounts(row: {
  _id: string; morning_entry: number; morning_exit: number; evening_entry: number; evening_exit: number
  mornings: number; evenings: number; updated_at: Date | null
}): HouseDayCounts {
  const netExit = net(row.morning_exit, row.morning_entry)
  const netEntry = net(row.evening_entry, row.evening_exit)
  const hasMorning = row.mornings > 0
  const hasEvening = row.evenings > 0
  return {
    date: row._id,
    morning_entry: row.morning_entry, morning_exit: row.morning_exit,
    evening_entry: row.evening_entry, evening_exit: row.evening_exit,
    net_exit: netExit, net_entry: netEntry,
    // Có thể vượt 100% (chim về nhiều hơn số đã đếm ra) — không kẹp, để người xem thấy
    return_rate: hasMorning && hasEvening && netExit > 0 ? +((netEntry / netExit) * 100).toFixed(2) : null,
    has_morning: hasMorning, has_evening: hasEvening,
    updated_at: row.updated_at,
  }
}

/**
 * SRS v2.1.8 — chim ra vào ở cửa của **cả nhà yến**, nên số đếm là của House, không chia theo Zone.
 * Nhà có 2 cửa thì cộng **số thô** của mọi camera rồi mới lấy số ròng: chim có thể ra cửa này về cửa
 * kia, nên số ròng hay tỷ lệ của từng camera riêng lẻ không có nghĩa. Khoảng `from`/`to` là ngày giờ
 * VN ('YYYY-MM-DD', tính cả hai đầu). Ngày không có tin nào thì không có dòng.
 */
export async function houseDailyCounts(houseId: string, range: { from?: string; to?: string } = {}): Promise<HouseDayCounts[]> {
  const sessionDate: Record<string, string> = {}
  if (range.from) sessionDate.$gte = range.from
  if (range.to) sessionDate.$lte = range.to
  const rows = await BirdCountRecord.aggregate([
    { $match: { house_id: new Types.ObjectId(houseId), ...(range.from || range.to ? { session_date: sessionDate } : {}) } },
    {
      $group: {
        _id: '$session_date',
        morning_entry: sumIf('MORNING_EXIT', '$entry_count'),
        morning_exit:  sumIf('MORNING_EXIT', '$exit_count'),
        evening_entry: sumIf('EVENING_ENTRY', '$entry_count'),
        evening_exit:  sumIf('EVENING_ENTRY', '$exit_count'),
        mornings: sumIf('MORNING_EXIT', 1),
        evenings: sumIf('EVENING_ENTRY', 1),
        updated_at: { $max: '$timestamp' },
      },
    },
    { $sort: { _id: 1 } },
  ])
  return rows.map(toDayCounts)
}

/** Trung bình tỷ lệ chim về theo ngày (mỗi ngày có tỷ lệ tính một lần); null khi không ngày nào có tỷ lệ */
export function averageReturnRate(days: HouseDayCounts[]): number | null {
  const rates = days.map(d => d.return_rate).filter((r): r is number => r !== null)
  return rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null
}

/**
 * VISION-FR-012 — số hôm nay của nhà yến khi mở trang (sau đó socket `BIRD_COUNT_UPDATE` ở room
 * `house:<id>` cập nhật cùng con số). `zoneId` cũ được quy ra House chứa Zone.
 */
export async function getCurrentBirdCount(user: CurrentUser, params: { houseId?: string; zoneId?: string }): Promise<HouseDayCounts & { house_id: string }> {
  const { house } = await assertHouseAccessByParams(params, user)
  const houseId = String(house._id)
  const date = vnDate(new Date())
  const [day] = await houseDailyCounts(houseId, { from: date, to: date })
  return { house_id: houseId, ...(day ?? emptyDay(date)) }
}

function emptyDay(date: string): HouseDayCounts {
  return toDayCounts({
    _id: date, morning_entry: 0, morning_exit: 0, evening_entry: 0, evening_exit: 0, mornings: 0, evenings: 0, updated_at: null,
  })
}

/**
 * VISION-FR-006/008/009/017 — gọi từ mqtt/handlers/birdCount.handler.ts. Tin của phiên trả nhà và ngày
 * của nó để handler tính lại sức khỏe ngày khi số đếm về trễ (SM-17); tin BUCKET trả null.
 */
export async function ingestBirdCount(payload: BirdCountPayload): Promise<{ houseId: string; sessionDate: string } | null> {
  const { deviceId, entry_count, exit_count } = payload
  if (typeof deviceId !== 'string' || !deviceId || !isCount(entry_count) || !isCount(exit_count)) {
    throw BadRequestError('Payload bird-count không hợp lệ')
  }

  const node = await CameraNode.findOne({ device_id: deviceId, ...IN_SERVICE }).select('house_id').lean()
  if (!node) throw NotFoundError(`Không tìm thấy CameraNode với device_id="${deviceId}"`)

  // Số đếm chỉ tăng trong một phiên/khoảng: `$max` để tin MQTT QoS 1 giao lại hoặc tới lệch thứ tự,
  // hay tin của pipeline vừa khởi động lại mất trạng thái, không kéo số đã lưu xuống
  const counts = { $max: { entry_count, exit_count } }

  // VISION-FR-017: số đếm theo khoảng 5 phút, có cả ngoài phiên
  if (payload.kind === 'BUCKET') {
    if (!Number.isFinite(payload.bucket_start)) throw BadRequestError('Thiếu bucket_start')
    // Căn về đầu khoảng 5 phút: mốc lệch vài giây vẫn gộp vào cùng một dòng thay vì tạo dòng mới
    const bucketStart = Math.floor((payload.bucket_start as number) / BUCKET_MS) * BUCKET_MS
    await BirdCountBucket.updateOne(
      { camera_node_id: node._id, bucket_start: new Date(bucketStart) },
      { $set: { house_id: node.house_id }, ...counts },
      { upsert: true },
    )
    return null
  }

  const sessionType = payload.session_type
  if (!sessionType || !SESSION_TYPES.includes(sessionType)) throw BadRequestError('session_type không hợp lệ')

  const timestamp = new Date(Number.isFinite(payload.timestamp) ? payload.timestamp as number : Date.now())
  const sessionDate = vnDate(timestamp)

  await BirdCountRecord.updateOne(
    { camera_node_id: node._id, session_type: sessionType, session_date: sessionDate },
    {
      $set: {
        house_id: node.house_id,
        ...(payload.confidence_avg !== undefined && Number.isFinite(payload.confidence_avg) && { confidence_avg: payload.confidence_avg }),
      },
      $max: { timestamp, entry_count, exit_count }, // số thô của cả hai chiều vẫn được lưu
    },
    { upsert: true },
  )

  // VISION-FR-012: phát số của cả nhà (không phải của camera vừa gửi) — cùng con số với /current
  const houseId = String(node.house_id)
  const [day] = await houseDailyCounts(houseId, { from: sessionDate, to: sessionDate })
  const morning = sessionType === 'MORNING_EXIT'
  emitBirdCountUpdate(houseId, {
    houseId, sessionDate, sessionType,
    entryCount: morning ? day.morning_entry : day.evening_entry,
    exitCount: morning ? day.morning_exit : day.evening_exit,
    netCount: morning ? day.net_exit : day.net_entry,
    returnRate: day.return_rate,
    timestamp: timestamp.toISOString(),
  })
  return { houseId, sessionDate }
}

/**
 * VISION-FR-011 — tỷ lệ chim về **của nhà yến** giảm quá mức của House so với trung bình 7 ngày có
 * dữ liệu trước đó. Gọi từ jobs/returnRate.job.ts sau khi phiên chiều kết thúc, không dựa vào tin
 * `final` của pipeline (pipeline khởi động lại đúng lúc đổi phiên thì tin đó không bao giờ tới).
 * Cảnh báo gắn House, không gắn camera hay Zone: chim ra vào ở cửa của cả nhà (SRS v2.1.8).
 * Chạy lại nhiều lần vẫn an toàn: `createAlert` gộp cảnh báo còn mở của cùng House.
 * Ngày đã hồi lại thì đóng cảnh báo cũ — nếu không, dedup nuốt mọi lần giảm của những ngày sau.
 * Trả số cảnh báo mới.
 */
export async function checkReturnRateDrops(sessionDate = vnDate(new Date())): Promise<number> {
  const houseIds = await BirdCountRecord.distinct('house_id', { session_type: 'EVENING_ENTRY', session_date: sessionDate })

  // "7 ngày trước" là 7 ngày lịch, không phải 7 bản ghi gần nhất: camera mất kết nối nhiều ngày thì nền ít đi
  const from = new Date(Date.parse(sessionDate) - BASELINE_DAYS * DAY_MS).toISOString().slice(0, 10)

  let created = 0
  for (const id of houseIds) {
    const houseId = String(id)
    // Lỗi ở một nhà không được làm bỏ qua các nhà sau: job chỉ chạy một lần mỗi tối
    try {
      if (await checkHouseReturnRate(houseId, sessionDate, from)) created++
    } catch (err) {
      logger.error('Kiểm tra tỷ lệ chim về thất bại', { houseId, sessionDate, err })
    }
  }
  return created
}

/** Một nhà của checkReturnRateDrops; trả true khi tạo cảnh báo mới */
async function checkHouseReturnRate(houseId: string, sessionDate: string, from: string): Promise<boolean> {
  const days = await houseDailyCounts(houseId, { from, to: sessionDate })
  const today = days.at(-1)
  if (today?.date !== sessionDate || today.return_rate === null) return false
  const previous = days.slice(0, -1).filter(d => d.return_rate !== null)
  if (previous.length < MIN_BASELINE_DAYS) return false

  const rate = today.return_rate
  const avg = previous.reduce((sum, d) => sum + (d.return_rate as number), 0) / previous.length
  const dropPct = avg > 0 ? ((avg - rate) / avg) * 100 : 0

  const house = await House.findById(houseId).select('farm_id name bird_count_tuning').lean()
  if (!house) return false
  // EXPERT-FR-008: Domain Expert chỉnh mức giảm theo House (mặc định 20%)
  const limit = resolveBirdCountTuning(house.bird_count_tuning).return_rate_drop_pct

  if (dropPct <= limit) {
    // Đóng xong vẫn còn trong hàng chờ kiểm chứng: hàng chờ lọc theo expert_verdict, không theo trạng thái
    await resolveHouseAlerts(houseId, 'LOW_RETURN_RATE', 'Tỷ lệ chim về đã trở lại mức bình thường')
    return false
  }

  const alert = await createAlert({
    farmId: String(house.farm_id), houseId,
    type: 'LOW_RETURN_RATE',
    title: `Tỷ lệ chim về giảm tại ${house.name}`,
    message: `Tỷ lệ chim về ${rate.toFixed(1)}%, giảm ${dropPct.toFixed(1)}% so với trung bình ${previous.length} ngày trước (${avg.toFixed(1)}%)`,
    metadata: { sessionDate, returnRate: rate, avg: +avg.toFixed(2), dropPct: +dropPct.toFixed(1), limit },
  })
  return alert !== null
}

/**
 * VISION-FR-017 — số chim ra/vào theo khoảng 5 phút của 1 nhà yến, cộng các camera của nhà.
 * Dùng cho biểu đồ theo giờ và màn kiểm chứng cảnh báo của Domain Expert (±30 phút, EXPERT-FR-003).
 * `zoneId` cũ được quy ra House chứa Zone.
 */
export async function getBirdCountBuckets(
  user: CurrentUser, params: { houseId?: string; zoneId?: string }, query: { from?: string; to?: string },
) {
  const { house } = await assertHouseAccessByParams(params, user)
  const to = query.to ? new Date(query.to) : new Date()
  const from = query.from ? new Date(query.from) : new Date(to.getTime() - DEFAULT_BUCKET_RANGE_MS)
  if (from >= to) throw BadRequestError('from phải trước to')
  if (to.getTime() - from.getTime() > MAX_BUCKET_RANGE_MS) throw BadRequestError('Khoảng thời gian tối đa 7 ngày')

  const buckets = await sumHouseBuckets(house._id, from, to)
  return { house_id: String(house._id), from, to, buckets }
}

/**
 * Số chim ra/vào theo khoảng 5 phút của 1 nhà trong [from, to), cộng các camera của nhà. Không kiểm
 * quyền — người gọi đã kiểm (getBirdCountBuckets, bằng chứng cảnh báo ALERT-FR-014).
 */
export async function sumHouseBuckets(houseId: unknown, from: Date, to: Date) {
  return BirdCountBucket.aggregate<{ bucket_start: Date; entry_count: number; exit_count: number }>([
    { $match: { house_id: new Types.ObjectId(String(houseId)), bucket_start: { $gte: from, $lt: to } } },
    { $group: { _id: '$bucket_start', entry_count: { $sum: '$entry_count' }, exit_count: { $sum: '$exit_count' } } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, bucket_start: '$_id', entry_count: 1, exit_count: 1 } },
  ])
}
