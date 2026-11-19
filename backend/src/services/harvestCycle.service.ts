import { Types } from 'mongoose'
import { HarvestBatch } from '@/models/harvestBatch.model'
import { HarvestCycle, type CycleComparison, type HarvestCycleStatus, type IHarvestCycle } from '@/models/harvestCycle.model'
import { HouseHealthDay } from '@/models/houseHealthDay.model'
import { Zone } from '@/models/houseZone.model'
import { SensorNode } from '@/models/device.model'
import { logAction } from '@/services/auditLog.service'
import { averageReturnRate, houseDailyCounts, vnDate } from '@/services/birdCount.service'
import { notifyExpertDecision } from '@/services/expertActivity.service'
import { isFlockDayComplete } from '@/services/healthAssessment.service'
import { ConflictError, NotFoundError } from '@/utils/appError.util'
import {
  assertFarmAccess, assertHouseAccess, assertZoneAccess, listAccessibleFarmIds,
  listAccessibleZoneIds,
} from '@/utils/farmAccess.util'
import { paginate } from '@/utils/helpers.util'
import logger from '@/utils/logger.util'
import type { CurrentUser, FarmMemberRole } from '@/types'

/** BR-43, Report 3 §4.5 — "cùng kỳ năm trước": chu kỳ có ngày đóng trong ±30 ngày của một năm trước */
export const HARVEST_SAME_PERIOD_DAYS = 30
/** BR-43, Report 3 §4.5 — chu kỳ có dưới 80 % số ngày được đánh giá là chưa đủ */
export const HARVEST_CYCLE_MIN_COMPLETENESS = 80

const DAY_MS = 86_400_000
const round1 = (n: number) => Math.round(n * 10) / 10
const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null)
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1

/** Một lần thu hoạch: các lô đã xác nhận của zone trong cùng 1 ngày giờ VN (cách hiểu "closing harvest" của BR-43) */
interface Harvest { date: string; at: Date; batchIds: Types.ObjectId[]; nestCount: number; weightGrams: number }

async function zoneHarvests(zoneId: unknown): Promise<Harvest[]> {
  // Model HarvestBatch tự ẩn lô đã xoá mềm (HARVEST-FR-005: lô xoá rời khỏi chu kỳ của nó)
  const batches = await HarvestBatch.find({ zone_id: zoneId, status: 'CONFIRMED' })
    .select('harvest_date nest_count weight_grams').sort({ harvest_date: 1 }).lean()
  const byDay = new Map<string, Harvest>()
  for (const b of batches) {
    const date = vnDate(b.harvest_date)
    const h = byDay.get(date) ?? { date, at: b.harvest_date, batchIds: [], nestCount: 0, weightGrams: 0 }
    h.batchIds.push(b._id)
    h.nestCount += b.nest_count
    h.weightGrams += b.weight_grams
    if (b.harvest_date < h.at) h.at = b.harvest_date
    byDay.set(date, h)
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date))
}

function comparisonWith(current: Harvest, other: Harvest | undefined, otherId: Types.ObjectId | undefined, reason: string): CycleComparison {
  if (!other) return { cycle_id: null, nest_count: null, weight_grams: null, nest_count_change_pct: null, weight_change_pct: null, reason }
  const change = (now: number, before: number) => (before > 0 ? round1(((now - before) / before) * 100) : null)
  return {
    cycle_id: otherId ?? null,
    nest_count: other.nestCount,
    weight_grams: round1(other.weightGrams),
    nest_count_change_pct: change(current.nestCount, other.nestCount),
    weight_change_pct: change(current.weightGrams, other.weightGrams),
    reason: null,
  }
}

/**
 * Sức khỏe của chu kỳ (BR-43) từ các ngày sức khỏe của nhà — giữ vĩnh viễn (BR-36), còn telemetry chỉ 90 ngày nên chu
 * kỳ 3–4 tháng không đọc lại được telemetry. Ngày của chu kỳ: từ ngày bắt đầu tới ngày trước lần thu hoạch đóng.
 * "Đã đánh giá" = ngày có trạng thái khác `INSUFFICIENT_DATA`.
 */
async function cycleHealth(zone: { _id: unknown; name: string; house_id: unknown }, from: string, to: string) {
  const totalDays = to >= from ? daysBetween(from, to) : 0
  if (totalDays === 0) {
    return { health: { good_days_pct: null, return_rate_avg: null, time_in_range_pct: null }, completeness_pct: null, incomplete: true }
  }
  const [days, counts] = await Promise.all([
    HouseHealthDay.find({ house_id: zone.house_id, date: { $gte: from, $lte: to } })
      .select('current_status indicators.environment.details').lean(),
    houseDailyCounts(String(zone.house_id), { from, to }),
  ])
  const assessed = days.filter(d => d.current_status !== 'INSUFFICIENT_DATA')
  const zoneId = String(zone._id)
  const inRange = days.flatMap(d => {
    const zones = (d.indicators?.environment?.details?.zones ?? []) as Array<{ zone_id?: unknown; zone_name?: string; in_range_pct?: number | null }>
    // Ngày trước G-26 chưa ghi zone_id: khớp theo tên zone
    const z = zones.find(x => (x.zone_id !== undefined ? String(x.zone_id) === zoneId : x.zone_name === zone.name))
    return typeof z?.in_range_pct === 'number' ? [z.in_range_pct] : []
  })
  const completeness = (100 * assessed.length) / totalDays
  const timeInRange = mean(inRange)
  const returnRate = averageReturnRate(counts.filter(isFlockDayComplete))
  return {
    health: {
      good_days_pct: assessed.length ? round1((100 * assessed.filter(d => d.current_status === 'GOOD').length) / assessed.length) : null,
      return_rate_avg: returnRate === null ? null : round1(returnRate),
      time_in_range_pct: timeInRange === null ? null : round1(timeInRange),
    },
    completeness_pct: round1(completeness),
    incomplete: completeness < HARVEST_CYCLE_MIN_COMPLETENESS,
  }
}

/**
 * Chạy tuần tự theo zone: hai lần dựng lại cùng lúc không chồng lên nhau, và kết luận mùa vụ không bị một lần dựng lại
 * đang chạy (đã đọc chu kỳ trước khi kết luận được lưu) ghi đè.
 */
const zoneQueue = new Map<string, Promise<unknown>>()

function inZoneQueue<T>(zoneId: string, task: () => Promise<T>): Promise<T> {
  const next = (zoneQueue.get(zoneId) ?? Promise.resolve()).then(task, task)
  zoneQueue.set(zoneId, next)
  return next.finally(() => { if (zoneQueue.get(zoneId) === next) zoneQueue.delete(zoneId) })
}

/**
 * HARVEST-FR-007, BR-43, Report 3 §6.13 và §6.22 — dựng lại mọi chu kỳ của zone từ các lô đã xác nhận: chu kỳ đầu bắt
 * đầu lúc đăng ký controller đầu tiên của zone, mỗi lần thu hoạch đóng một chu kỳ, chu kỳ cuối `OPEN`. Zone chưa có
 * controller, hoặc controller đăng ký từ lần thu hoạch đầu trở đi (sổ sản lượng các mùa trước, A-8): lần thu hoạch đầu
 * chỉ là mốc bắt đầu, vì chu kỳ nó đóng không có ngày bắt đầu. Một đường cho cả xác nhận, sửa, xoá (chu kỳ gộp vào chu
 * kỳ sau) và nhập lùi ngày. Giữ `_id` và kết luận mùa vụ của chu kỳ có cùng ngày thu hoạch đóng.
 */
export function rebuildZoneCycles(zoneId: unknown): Promise<void> {
  const key = String(zoneId)
  return inZoneQueue(key, () => doRebuild(key))
}

async function doRebuild(zoneId: string): Promise<void> {
  const zone = await Zone.findById(zoneId).select('name house_id farm_id').lean()
  if (!zone) return
  const [harvests, firstController, existing] = await Promise.all([
    zoneHarvests(zone._id),
    SensorNode.findOne({ zone_id: zone._id }).sort({ registered_at: 1 }).select('registered_at').lean(),
    HarvestCycle.find({ zone_id: zone._id }).lean(),
  ])
  const registeredAt = firstController?.registered_at
  // Controller đăng ký trước lần thu hoạch đầu là mốc bắt đầu; không thì lần thu hoạch đầu là mốc (không đóng chu kỳ nào)
  const anchoredByController = Boolean(registeredAt && harvests[0] && registeredAt < harvests[0].at)
  const firstStart = anchoredByController || !harvests[0] ? registeredAt : harvests[0].at
  if (!firstStart) {
    await HarvestCycle.deleteMany({ zone_id: zone._id })
    return
  }
  const closing = anchoredByController ? harvests : harvests.slice(1)

  const byClosingDate = new Map(existing.filter(c => c.closing_harvest).map(c => [c.closing_harvest!.date, c]))
  const openExisting = existing.find(c => c.status === 'OPEN')
  const docs: Array<Partial<IHarvestCycle> & { _id: Types.ObjectId }> = []
  let start: Date = firstStart
  for (let i = 0; i < closing.length; i++) {
    const h = closing[i]
    const kept = byClosingDate.get(h.date)
    const id = kept?._id ?? new Types.ObjectId()
    const target = Date.parse(`${h.date}T00:00:00Z`) - 365 * DAY_MS
    const lastYear = closing.slice(0, i)
      .map((x, j) => ({ x, j, gap: Math.abs(Date.parse(`${x.date}T00:00:00Z`) - target) }))
      .filter(c => c.gap <= HARVEST_SAME_PERIOD_DAYS * DAY_MS)
      .sort((a, b) => a.gap - b.gap)[0]
    const { health, completeness_pct, incomplete } = await cycleHealth(zone, vnDate(start), addDays(h.date, -1))
    const status: HarvestCycleStatus = kept?.conclusion ? 'CONCLUDED' : 'CLOSED'
    docs.push({
      _id: id, farm_id: zone.farm_id, house_id: zone.house_id, zone_id: zone._id, start_date: start, end_date: h.at,
      status,
      closing_harvest: { date: h.date, batch_ids: h.batchIds, nest_count: h.nestCount, weight_grams: round1(h.weightGrams) },
      comparison: {
        previous: comparisonWith(h, closing[i - 1], docs[i - 1]?._id, 'Chu kỳ đầu tiên của zone'),
        same_period_last_year: comparisonWith(h, lastYear?.x, lastYear ? docs[lastYear.j]._id : undefined,
          `Không có chu kỳ nào đóng trong ±${HARVEST_SAME_PERIOD_DAYS} ngày của một năm trước`),
      },
      health, completeness_pct, incomplete,
      ...(kept?.conclusion && { conclusion: kept.conclusion }),
    })
    start = h.at
  }
  docs.push({
    _id: openExisting?._id ?? new Types.ObjectId(), farm_id: zone.farm_id, house_id: zone.house_id, zone_id: zone._id,
    start_date: start, status: 'OPEN', incomplete: false,
  })
  await writeCycles(zoneId, existing, docs)
}

/** Trường chỉ chu kỳ đã đóng (hay đã kết luận) có: ghi lại chu kỳ thì bỏ trường bản mới không có */
const OPTIONAL_FIELDS = ['end_date', 'closing_harvest', 'comparison', 'health', 'completeness_pct', 'conclusion'] as const

/**
 * Ghi chu kỳ đã dựng mà không bao giờ xoá một kết luận mùa vụ trước khi ghi lại nó (nó là dữ liệu duy nhất do người
 * viết): chỉ xoá chu kỳ không còn trong kết quả (lô đóng bị xoá hay đổi ngày: gộp vào chu kỳ sau, kết luận ghi log);
 * chu kỳ giữ lại được cập nhật tại chỗ theo `_id`. Mốc bắt đầu có thể dời sang mốc cũ của chu kỳ khác (nhập lùi ngày),
 * nên trước hết đưa mốc của các chu kỳ sắp dời về một giá trị tạm riêng để không vướng index unique `zone_id +
 * start_date`. Dừng giữa chừng thì chu kỳ còn mốc tạm nhưng vẫn giữ kết luận, lần dựng lại sau sửa đúng.
 */
async function writeCycles(
  zoneId: string,
  existing: Array<{ _id: Types.ObjectId; start_date: Date; conclusion?: { text?: string } | null }>,
  docs: Array<Partial<IHarvestCycle> & { _id: Types.ObjectId }>,
): Promise<void> {
  const keep = new Set(docs.map(d => String(d._id)))
  const dropped = existing.filter(c => !keep.has(String(c._id)))
  for (const c of dropped.filter(x => x.conclusion)) {
    logger.warn('Chu kỳ có kết luận bị gộp vào chu kỳ sau vì lô đóng bị xoá hay sửa ngày', {
      cycleId: String(c._id), zoneId, conclusion: c.conclusion?.text,
    })
  }
  if (dropped.length) await HarvestCycle.deleteMany({ _id: { $in: dropped.map(c => c._id) } })

  const before = new Map(existing.map(c => [String(c._id), c.start_date.getTime()]))
  const moving = docs.filter(d => before.has(String(d._id)) && before.get(String(d._id)) !== d.start_date!.getTime())
  if (moving.length) {
    // Mốc tạm trước năm 1970, khác nhau cho từng chu kỳ: không trùng mốc thật nào của zone
    await HarvestCycle.bulkWrite(moving.map((d, i) => ({
      updateOne: { filter: { _id: d._id }, update: { $set: { start_date: new Date(-1 - i) } } },
    })))
  }
  // Ghi đủ trường của bản mới, bỏ các trường bản mới không có (VD chu kỳ OPEN chưa có lần thu hoạch đóng)
  await HarvestCycle.bulkWrite(docs.map(({ _id, ...fields }) => {
    const unset = OPTIONAL_FIELDS.filter(f => fields[f] === undefined)
    return {
      updateOne: {
        filter: { _id },
        update: { $set: fields, ...(unset.length && { $unset: Object.fromEntries(unset.map(f => [f, 1])) }) },
        upsert: true,
      },
    }
  }))
}

/** Dựng lại sau khi lô đổi: lỗi chỉ ghi log, thao tác trên lô vẫn xong (lần sau dựng lại đúng) */
export async function rebuildZoneCyclesSafely(zoneId: unknown): Promise<void> {
  try {
    await rebuildZoneCycles(zoneId)
  } catch (err) {
    logger.error('Dựng lại chu kỳ thu hoạch thất bại', { zoneId: String(zoneId), err })
  }
}

// ── Đọc ──────────────────────────────────────────────────────────────────────

export interface ListCyclesQuery {
  zoneId?: string
  houseId?: string
  farmId?: string
  status?: HarvestCycleStatus
  page?: number
  limit?: number
}

/**
 * HARVEST-FR-007, ANALYTICS-FR-004 — chu kỳ theo zone, nhà hoặc farm: Farm Owner và Domain Expert theo farm, Farm
 * Technician chỉ zone của nhà được giao (Report 3 §2.4). Chu kỳ đóng của 1 zone theo thời gian là xu hướng sản lượng.
 */
export async function listCycles(user: CurrentUser, query: ListCyclesQuery) {
  const filter: Record<string, unknown> = {}
  if (query.zoneId) {
    await assertZoneAccess(query.zoneId, user)
    filter.zone_id = new Types.ObjectId(query.zoneId)
  } else if (query.houseId) {
    await assertHouseAccess(query.houseId, user)
    filter.house_id = new Types.ObjectId(query.houseId)
  } else if (user.role === 'FARM_TECHNICIAN') {
    filter.zone_id = { $in: await listAccessibleZoneIds(user) }
    if (query.farmId) filter.farm_id = new Types.ObjectId(query.farmId)
  } else if (query.farmId) {
    await assertFarmAccess(query.farmId, user)
    filter.farm_id = new Types.ObjectId(query.farmId)
  } else {
    filter.farm_id = { $in: await listAccessibleFarmIds(user) }
  }
  if (query.status) filter.status = query.status

  const { page, skip, limit } = paginate(query.page, query.limit)
  const [records, total] = await Promise.all([
    HarvestCycle.find(filter).sort({ start_date: -1 }).skip(skip).limit(limit).lean(),
    HarvestCycle.countDocuments(filter),
  ])
  return { records, total, page, limit }
}

async function findCycleWithAccess(id: string, user: CurrentUser) {
  const cycle = await HarvestCycle.findById(id)
  if (!cycle) throw NotFoundError('Không tìm thấy chu kỳ thu hoạch')
  if (user.role === 'FARM_TECHNICIAN') {
    await assertZoneAccess(String(cycle.zone_id), user)
    return { cycle, farm: null }
  }
  return { cycle, farm: await assertFarmAccess(String(cycle.farm_id), user) }
}

export async function getCycle(id: string, user: CurrentUser) {
  return (await findCycleWithAccess(id, user)).cycle
}

// ── Kết luận mùa vụ ─────────────────────────────────────────────────────────

/**
 * EXPERT-FR-020 — chỉ Domain Expert (route) viết kết luận và khuyến nghị cho mùa sau trên chu kỳ đã đóng. Farm Owner
 * không viết, kể cả khi farm chưa có chuyên gia: BR-22 "no conclusions are written without an expert"; chu kỳ vẫn đóng
 * và đủ số liệu, chuyên gia vào sau viết được cho mọi chu kỳ đã đóng. Chu kỳ `CONCLUDED`, sửa lại vẫn `CONCLUDED`; mỗi
 * Farm Owner được báo (EXPERT-FR-009). Chu kỳ `OPEN` → 409.
 */
export async function concludeCycle(user: CurrentUser, id: string, input: { text: string; recommendations?: string }) {
  const { cycle: found, farm } = await findCycleWithAccess(id, user)
  if (!farm) throw NotFoundError('Không tìm thấy chu kỳ thu hoạch')

  // Trong hàng đợi của zone: một lần dựng lại đang chạy xong trước, rồi mới đọc lại chu kỳ và lưu kết luận
  const cycle = await inZoneQueue(String(found.zone_id), async () => {
    const current = await HarvestCycle.findById(id)
    if (!current) throw NotFoundError('Không tìm thấy chu kỳ thu hoạch')
    if (current.status === 'OPEN') throw ConflictError('Chu kỳ chưa đóng: chưa có lần thu hoạch nào được xác nhận')
    current.conclusion = {
      text: input.text.trim(),
      recommendations: input.recommendations?.trim() || undefined,
      by: new Types.ObjectId(user._id),
      role: user.role as FarmMemberRole,
      at: new Date(),
    }
    current.status = 'CONCLUDED'
    await current.save()
    return current
  })
  const conclusionText = cycle.conclusion?.text ?? ''

  const zone = await Zone.findById(cycle.zone_id).select('name').lean()
  const auditId = await logAction(user._id, 'HARVEST_CYCLE_CONCLUDED', 'harvest_cycle', String(cycle._id), {
    zone_id: String(cycle.zone_id), closing_date: cycle.closing_harvest?.date,
  }, { farmId: String(farm._id) })
  await notifyExpertDecision(user, farm._id, auditId, {
    what: 'viết kết luận mùa vụ',
    place: `${zone?.name ?? 'Zone'}, chu kỳ đóng ngày ${cycle.closing_harvest?.date ?? ''}`,
    detail: conclusionText,
  })
  return cycle
}
