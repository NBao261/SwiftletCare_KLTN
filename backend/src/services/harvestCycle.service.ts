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
  assertExpertDecision, assertFarmAccess, assertHouseAccess, assertZoneAccess, listAccessibleFarmIds,
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

/** Chạy tuần tự theo zone: hai lần xác nhận cùng lúc không dựng chồng lên nhau */
const rebuilding = new Map<string, Promise<void>>()

/**
 * HARVEST-FR-007, BR-43, Report 3 §6.13 và §6.22 — dựng lại mọi chu kỳ của zone từ các lô đã xác nhận: chu kỳ đầu bắt
 * đầu lúc đăng ký controller đầu tiên của zone (không có, hoặc sau lần thu hoạch đầu, thì từ lần thu hoạch đầu), mỗi
 * lần thu hoạch đóng một chu kỳ, chu kỳ cuối `OPEN`. Một đường cho cả xác nhận, sửa, xoá (chu kỳ gộp vào chu kỳ sau) và
 * nhập lùi ngày. Giữ `_id` và kết luận mùa vụ của chu kỳ có cùng ngày thu hoạch đóng.
 */
export function rebuildZoneCycles(zoneId: unknown): Promise<void> {
  const key = String(zoneId)
  const next = (rebuilding.get(key) ?? Promise.resolve()).then(() => doRebuild(key), () => doRebuild(key))
  rebuilding.set(key, next)
  return next.finally(() => { if (rebuilding.get(key) === next) rebuilding.delete(key) })
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
  const firstStart = registeredAt && (!harvests[0] || registeredAt <= harvests[0].at) ? registeredAt : harvests[0]?.at
  if (!firstStart) {
    await HarvestCycle.deleteMany({ zone_id: zone._id })
    return
  }

  const byClosingDate = new Map(existing.filter(c => c.closing_harvest).map(c => [c.closing_harvest!.date, c]))
  const openExisting = existing.find(c => c.status === 'OPEN')
  const docs: Array<Partial<IHarvestCycle> & { _id: Types.ObjectId }> = []
  let start: Date = firstStart
  for (let i = 0; i < harvests.length; i++) {
    const h = harvests[i]
    const kept = byClosingDate.get(h.date)
    const id = kept?._id ?? new Types.ObjectId()
    const prevHarvest = harvests[i - 1]
    const target = Date.parse(`${h.date}T00:00:00Z`) - 365 * DAY_MS
    const lastYear = harvests.slice(0, i)
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
        previous: comparisonWith(h, prevHarvest, docs[i - 1]?._id, 'Chu kỳ đầu tiên của zone'),
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

  const dropped = existing.filter(c => c.conclusion && !docs.some(d => String(d._id) === String(c._id)))
  for (const c of dropped) {
    logger.warn('Chu kỳ có kết luận bị gộp vào chu kỳ sau vì lô đóng bị xoá hay sửa ngày', {
      cycleId: String(c._id), zoneId, conclusion: c.conclusion?.text,
    })
  }
  // Xoá rồi ghi lại (giữ _id): mốc bắt đầu có thể đổi chỗ cho nhau, ghi đè từng cái sẽ vướng index unique zone + mốc
  await HarvestCycle.deleteMany({ zone_id: zone._id })
  await HarvestCycle.insertMany(docs)
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
 * EXPERT-FR-020 — Domain Expert (Farm Owner khi farm chưa có chuyên gia, BR-22) viết kết luận và khuyến nghị cho mùa
 * sau trên chu kỳ đã đóng; chu kỳ `CONCLUDED`, sửa lại vẫn `CONCLUDED`; chuyên gia viết thì mỗi Farm Owner được báo
 * (EXPERT-FR-009). Chu kỳ `OPEN` → 409.
 */
export async function concludeCycle(user: CurrentUser, id: string, input: { text: string; recommendations?: string }) {
  const { cycle, farm } = await findCycleWithAccess(id, user)
  if (!farm) throw NotFoundError('Không tìm thấy chu kỳ thu hoạch')
  await assertExpertDecision(farm, user)
  if (cycle.status === 'OPEN') throw ConflictError('Chu kỳ chưa đóng: chưa có lần thu hoạch nào được xác nhận')

  cycle.conclusion = {
    text: input.text.trim(),
    recommendations: input.recommendations?.trim() || undefined,
    by: new Types.ObjectId(user._id),
    role: user.role as FarmMemberRole,
    at: new Date(),
  }
  cycle.status = 'CONCLUDED'
  await cycle.save()

  const zone = await Zone.findById(cycle.zone_id).select('name').lean()
  const auditId = await logAction(user._id, 'HARVEST_CYCLE_CONCLUDED', 'harvest_cycle', String(cycle._id), {
    zone_id: String(cycle.zone_id), closing_date: cycle.closing_harvest?.date,
  }, { farmId: String(farm._id) })
  await notifyExpertDecision(user, farm._id, auditId, {
    what: 'viết kết luận mùa vụ',
    place: `${zone?.name ?? 'Zone'}, chu kỳ đóng ngày ${cycle.closing_harvest?.date ?? ''}`,
    detail: cycle.conclusion.text,
  })
  return cycle
}
