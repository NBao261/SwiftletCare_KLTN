import { Types } from 'mongoose'
import { baselineAfter, stageOn } from '@/utils/houseStage.util'
import { CameraNode, IN_SERVICE } from '@/models/device.model'
import { House } from '@/models/houseZone.model'
import { Alert } from '@/models/alert.model'
import { BirdCountRecord } from '@/models/birdCountRecord.model'
import { BirdCountBucket } from '@/models/birdCountBucket.model'
import { emitBirdCountUpdate } from '@/socket'
import { createAlert, resolveHouseAlerts } from '@/services/alert.service'
import { sessionRainfall } from '@/services/sessionRain.service'
import { assertHouseAccessByParams, listActiveHouseIds } from '@/utils/farmAccess.util'
import { returnRateCheckAt, scheduleOn, vnDateOf, windowInterval, windowsOn, type TimeWindow } from '@/utils/countingSchedule.util'
import { resolveBirdCountTuning } from '@/utils/detectionTuning.util'
import { BadRequestError, NotFoundError } from '@/utils/appError.util'
import logger from '@/utils/logger.util'
import type { BirdCountPayload, CurrentUser, SessionType } from '@/types'

const SESSION_TYPES: SessionType[] = ['MORNING_EXIT', 'EVENING_ENTRY']
const DAY_MS = 86_400_000
const BUCKET_MS = 5 * 60_000

/** VISION-FR-011 */
export const BASELINE_DAYS = 7
/** ponytail: 3 ngày nền chọn tay; ít hơn thì 1 ngày lệch đã thành cảnh báo */
export const MIN_BASELINE_DAYS = 3
/** ponytail: chọn tay (7 ngày ≈ 2016 khoảng/camera) */
const MAX_BUCKET_RANGE_MS = 7 * DAY_MS
/** ponytail: chọn tay */
const DEFAULT_BUCKET_RANGE_MS = DAY_MS

const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0
/** Phiên sáng 05:30 VN là 22:30 UTC hôm trước */
export const vnDate = vnDateOf
/** Chim lượn qua lại vạch làm cả hai chiều phồng lên, phép trừ triệt tiêu */
const net = (main: number, opposite: number) => Math.max(main - opposite, 0)

/** Nguồn duy nhất của số đếm theo ngày của một nhà */
export interface HouseDayCounts {
  date: string
  /** Cộng mọi camera của nhà */
  morning_entry: number
  morning_exit: number
  evening_entry: number
  evening_exit: number
  /** Không âm */
  net_exit: number
  /** Không âm */
  net_entry: number
  /** null khi thiếu phiên hoặc sáng không có chim ra */
  return_rate: number | null
  has_morning: boolean
  has_evening: boolean
  /** VISION-FR-020: không kiểm LOW_RETURN_RATE và không vào nền */
  incomplete: boolean
  updated_at: Date | null
}

const sumIf = (session: SessionType, value: string | number) =>
  ({ $sum: { $cond: [{ $eq: ['$session_type', session] }, value, 0] } })

function toDayCounts(row: {
  _id: string; morning_entry: number; morning_exit: number; evening_entry: number; evening_exit: number
  mornings: number; evenings: number; incompletes: number; updated_at: Date | null
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
    // Có thể vượt 100%: không kẹp
    return_rate: hasMorning && hasEvening && netExit > 0 ? +((netEntry / netExit) * 100).toFixed(2) : null,
    has_morning: hasMorning, has_evening: hasEvening,
    incomplete: row.incompletes > 0,
    updated_at: row.updated_at,
  }
}

/** Cộng số thô mọi camera rồi mới lấy số ròng: chim có thể ra cửa này về cửa kia */
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
        incompletes: { $sum: { $cond: [{ $eq: ['$complete', false] }, 1, 0] } },
        updated_at: { $max: '$timestamp' },
      },
    },
    { $sort: { _id: 1 } },
  ])
  return rows.map(toDayCounts)
}

/** Bỏ ngày không đầy đủ (VISION-FR-020) */
export function averageReturnRate(days: HouseDayCounts[]): number | null {
  const rates = days.filter(d => !d.incomplete).map(d => d.return_rate).filter((r): r is number => r !== null)
  return rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null
}

/** zoneId cũ: quy ra House chứa Zone */
export async function getCurrentBirdCount(user: CurrentUser, params: { houseId?: string; zoneId?: string }): Promise<HouseDayCounts & { house_id: string }> {
  const { house } = await assertHouseAccessByParams(params, user)
  const houseId = String(house._id)
  const date = vnDate(new Date())
  const [day] = await houseDailyCounts(houseId, { from: date, to: date })
  return { house_id: houseId, ...(day ?? emptyDay(date)) }
}

function emptyDay(date: string): HouseDayCounts {
  return toDayCounts({
    _id: date, morning_entry: 0, morning_exit: 0, evening_entry: 0, evening_exit: 0, mornings: 0, evenings: 0, incompletes: 0, updated_at: null,
  })
}

/** Trả nhà và ngày khi cần tính lại sức khỏe ngày vì số về trễ (SM-17), còn lại null */
export async function ingestBirdCount(payload: BirdCountPayload): Promise<{ houseId: string; sessionDate: string } | null> {
  const { deviceId, entry_count, exit_count } = payload
  if (typeof deviceId !== 'string' || !deviceId || !isCount(entry_count) || !isCount(exit_count)) {
    throw BadRequestError('Payload bird-count không hợp lệ')
  }

  const node = await CameraNode.findOne({ device_id: deviceId, ...IN_SERVICE }).select('house_id').lean()
  if (!node) throw NotFoundError(`Không tìm thấy CameraNode với device_id="${deviceId}"`)

  // $max: QoS 1 giao lại, lệch thứ tự hay pipeline khởi động lại không kéo số xuống
  const counts = { $max: { entry_count, exit_count } }

  if (payload.kind === 'BUCKET') {
    if (!Number.isFinite(payload.bucket_start)) throw BadRequestError('Thiếu bucket_start')
    // Mốc lệch vài giây vẫn gộp vào cùng dòng
    const bucketStart = Math.floor((payload.bucket_start as number) / BUCKET_MS) * BUCKET_MS
    await BirdCountBucket.updateOne(
      { camera_node_id: node._id, bucket_start: new Date(bucketStart) },
      { $set: { house_id: node.house_id }, ...counts },
      { upsert: true },
    )
    // SM-17: chỉ tính lại khi khoảng đó nằm trong khung của một phiên
    const bucketDate = vnDate(new Date(bucketStart))
    const houseId = String(node.house_id)
    const computed = await BirdCountRecord.find({ house_id: node.house_id, session_date: bucketDate, computed_at: { $exists: true } })
      .select('window_start window_end').lean()
    const inWindow = computed.some(record => {
      const { start, end } = windowInterval(bucketDate, { start: record.window_start as string, end: record.window_end as string })
      return bucketStart >= start.getTime() && bucketStart < end.getTime()
    })
    if (!inWindow) return null
    await computeHouseSessions(houseId, bucketDate)
    return { houseId, sessionDate: bucketDate }
  }

  const sessionType = payload.session_type
  if (!sessionType || !SESSION_TYPES.includes(sessionType)) throw BadRequestError('session_type không hợp lệ')

  const timestamp = new Date(Number.isFinite(payload.timestamp) ? payload.timestamp as number : Date.now())
  const sessionDate = vnDate(timestamp)

  // Phiên đã tính từ số 5 phút: tin cộng dồn tới muộn không ghi đè
  if (await BirdCountRecord.exists({
    camera_node_id: node._id, session_type: sessionType, session_date: sessionDate, computed_at: { $exists: true },
  })) return null

  await BirdCountRecord.updateOne(
    { camera_node_id: node._id, session_type: sessionType, session_date: sessionDate },
    {
      $set: {
        house_id: node.house_id,
        ...(payload.confidence_avg !== undefined && Number.isFinite(payload.confidence_avg) && { confidence_avg: payload.confidence_avg }),
      },
      $max: { timestamp, entry_count, exit_count }, // Vẫn lưu số thô của cả hai chiều
    },
    { upsert: true },
  )

  // Số của cả nhà, cùng con số với /current
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

/** Không dựa vào tin final của pipeline (có thể không bao giờ tới). Ngày hồi lại thì đóng, không thì dedup nuốt các lần sau */
export async function checkReturnRateDrops(sessionDate = vnDate(new Date()), onlyHouseIds?: string[]): Promise<number> {
  const houseIds = await BirdCountRecord.distinct('house_id', {
    session_type: 'EVENING_ENTRY', session_date: sessionDate,
    ...(onlyHouseIds && { house_id: { $in: onlyHouseIds.map(id => new Types.ObjectId(id)) } }),
  })

  // 7 ngày lịch, không phải 7 bản ghi gần nhất
  const from = new Date(Date.parse(sessionDate) - BASELINE_DAYS * DAY_MS).toISOString().slice(0, 10)

  let created = 0
  for (const id of houseIds) {
    const houseId = String(id)
    // Lỗi ở một nhà không được bỏ qua các nhà sau
    try {
      if (await checkHouseReturnRate(houseId, sessionDate, from)) created++
    } catch (err) {
      logger.error('Kiểm tra tỷ lệ chim về thất bại', { houseId, sessionDate, err })
    }
  }
  return created
}

async function checkHouseReturnRate(houseId: string, sessionDate: string, from: string): Promise<boolean> {
  const stage = await House.findById(houseId).select('stage_history').lean()
  // BR-46
  if (stageOn(stage?.stage_history, sessionDate) === 'ATTRACTING') {
    await resolveHouseAlerts(houseId, 'LOW_RETURN_RATE', 'Nhà chuyển sang giai đoạn dẫn dụ: không xét tỷ lệ chim về (BR-46)')
    return false
  }
  const occupiedSince = baselineAfter(stage?.stage_history, sessionDate)
  const days = await houseDailyCounts(houseId, { from, to: sessionDate })
  const today = days.at(-1)
  // VISION-FR-020: ngày không đầy đủ không mở, không đóng cảnh báo
  if (today?.date !== sessionDate || today.return_rate === null || today.incomplete) return false
  const previous = days.slice(0, -1).filter(d => d.return_rate !== null && !d.incomplete && (!occupiedSince || d.date > occupiedSince))
  if (previous.length < MIN_BASELINE_DAYS) return false

  const rate = today.return_rate
  const avg = previous.reduce((sum, d) => sum + (d.return_rate as number), 0) / previous.length
  const dropPct = avg > 0 ? ((avg - rate) / avg) * 100 : 0

  const house = await House.findById(houseId).select('farm_id name bird_count_tuning').lean()
  if (!house) return false
  const limit = resolveBirdCountTuning(house.bird_count_tuning).return_rate_drop_pct

  if (dropPct <= limit) {
    // Đóng xong vẫn còn trong hàng chờ kiểm chứng: hàng chờ lọc theo expert_verdict
    await resolveHouseAlerts(houseId, 'LOW_RETURN_RATE', 'Tỷ lệ chim về đã trở lại mức bình thường')
    return false
  }

  // BR-30: chỉ để người xem cân nhắc, không đổi quyết định báo
  const rain = await sessionRainfall(houseId, house.farm_id, sessionDate)
  const rainMm = rain?.mm ?? null
  const rainText = rain === null ? 'không có dữ liệu thời tiết' : `mưa trong phiên đếm ${rain.mm} mm`
  const alert = await createAlert({
    farmId: String(house.farm_id), houseId,
    type: 'LOW_RETURN_RATE',
    title: `Tỷ lệ chim về giảm tại ${house.name}`,
    message: `Tỷ lệ chim về ${rate.toFixed(1)}%, giảm ${dropPct.toFixed(1)}% so với trung bình ${previous.length} ngày trước (${avg.toFixed(1)}%); ${rainText}`,
    metadata: { sessionDate, returnRate: rate, avg: +avg.toFixed(2), dropPct: +dropPct.toFixed(1), limit, rainMm },
  })
  return alert !== null
}

/** zoneId cũ: quy ra House chứa Zone */
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

/** Không kiểm quyền: người gọi đã kiểm */
export async function sumHouseBuckets(houseId: unknown, from: Date, to: Date) {
  return BirdCountBucket.aggregate<{ bucket_start: Date; entry_count: number; exit_count: number }>([
    { $match: { house_id: new Types.ObjectId(String(houseId)), bucket_start: { $gte: from, $lt: to } } },
    { $group: { _id: '$bucket_start', entry_count: { $sum: '$entry_count' }, exit_count: { $sum: '$exit_count' } } },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, bucket_start: '$_id', entry_count: 1, exit_count: 1 } },
  ])
}

export async function houseWindowsOn(houseId: unknown, date: string) {
  const house = await House.findById(houseId).select('counting_schedule_history').lean()
  return windowsOn(scheduleOn(house?.counting_schedule_history, date), date)
}

/** Số 5 phút thuộc phiên khi bắt đầu trong khung. Camera không có số 5 phút giữ số cộng dồn của nút AI */
export async function computeHouseSessions(houseId: string, date: string, now = new Date()): Promise<void> {
  const house = new Types.ObjectId(houseId)
  const scheduled = await houseWindowsOn(house, date)
  for (const [sessionType, planned] of [['MORNING_EXIT', scheduled.morning], ['EVENING_ENTRY', scheduled.evening]] as const) {
    const stored = await BirdCountRecord.findOne({ house_id: house, session_date: date, session_type: sessionType, window_start: { $exists: true } })
      .select('window_start window_end').lean()
    const window: TimeWindow = stored ? { start: stored.window_start as string, end: stored.window_end as string } : planned
    const { start, end } = windowInterval(date, window)
    // Cảnh báo mở trước khi khung hết và chưa đóng trước khi khung bắt đầu
    const degraded = await Alert.exists({
      house_id: house, type: 'EDGE_AI_DEGRADED', created_at: { $lt: end },
      $or: [{ resolved_at: null }, { resolved_at: { $gt: start } }],
    })
    const meta = { window_start: window.start, window_end: window.end, complete: !degraded, computed_at: now }
    const perCamera = await BirdCountBucket.aggregate<{ _id: Types.ObjectId; entry_count: number; exit_count: number }>([
      { $match: { house_id: house, bucket_start: { $gte: start, $lt: end } } },
      { $group: { _id: '$camera_node_id', entry_count: { $sum: '$entry_count' }, exit_count: { $sum: '$exit_count' } } },
    ])
    for (const row of perCamera) {
      await BirdCountRecord.updateOne(
        { camera_node_id: row._id, session_type: sessionType, session_date: date },
        { $set: { house_id: house, entry_count: row.entry_count, exit_count: row.exit_count, timestamp: end, ...meta } },
        { upsert: true },
      )
    }
    await BirdCountRecord.updateMany({ house_id: house, session_date: date, session_type: sessionType }, { $set: meta })
  }
}

/** Ghi last_session_check có điều kiện: hai lần chạy chồng nhau không nhận trùng */
export async function claimDueHouses(now = new Date()): Promise<{ date: string; houseIds: string[] }> {
  const date = vnDate(now)
  const houses = await House.find({ _id: { $in: await listActiveHouseIds() }, last_session_check: { $ne: date } })
    .select('counting_schedule_history').lean()
  const houseIds: string[] = []
  for (const house of houses) {
    if (now < returnRateCheckAt(date, windowsOn(scheduleOn(house.counting_schedule_history, date), date))) continue
    const { modifiedCount } = await House.updateOne({ _id: house._id, last_session_check: { $ne: date } }, { $set: { last_session_check: date } })
    if (modifiedCount === 1) houseIds.push(String(house._id))
  }
  return { date, houseIds }
}
