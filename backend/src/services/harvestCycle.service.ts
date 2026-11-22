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

/** BR-43 (Report 3 §4.5) */
export const HARVEST_SAME_PERIOD_DAYS = 30
/** BR-43 (Report 3 §4.5) */
export const HARVEST_CYCLE_MIN_COMPLETENESS = 80

const DAY_MS = 86_400_000
const round1 = (n: number) => Math.round(n * 10) / 10
const mean = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null)
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1

/** Cách hiểu "closing harvest" của BR-43 */
interface Harvest { date: string; at: Date; batchIds: Types.ObjectId[]; nestCount: number; weightGrams: number }

async function zoneHarvests(zoneId: unknown): Promise<Harvest[]> {
  // Lô xoá mềm tự rời khỏi chu kỳ (HARVEST-FR-005)
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

/** Đọc từ ngày sức khỏe (giữ vĩnh viễn): telemetry chỉ 90 ngày, không đủ cho chu kỳ 3–4 tháng */
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
    // Ngày trước G-26 chưa ghi zone_id
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

/** Tuần tự theo zone: hai lần dựng lại không chồng nhau, không ghi đè kết luận vừa lưu */
const zoneQueue = new Map<string, Promise<unknown>>()

function inZoneQueue<T>(zoneId: string, task: () => Promise<T>): Promise<T> {
  const next = (zoneQueue.get(zoneId) ?? Promise.resolve()).then(task, task)
  zoneQueue.set(zoneId, next)
  return next.finally(() => { if (zoneQueue.get(zoneId) === next) zoneQueue.delete(zoneId) })
}

/** Một đường cho xác nhận, sửa, xoá, nhập lùi ngày. Không có controller trước lần thu hoạch đầu thì lần đó chỉ là mốc bắt đầu */
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
        previous: comparisonWith(h, closing[i - 1], docs[i - 1]?._id, 'Chu kỳ đầu tiên của Zone'),
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

/** Ghi lại chu kỳ thì bỏ trường bản mới không có */
const OPTIONAL_FIELDS = ['end_date', 'closing_harvest', 'comparison', 'health', 'completeness_pct', 'conclusion'] as const

/** Không bao giờ xoá kết luận trước khi ghi lại (dữ liệu duy nhất do người viết). Mốc tạm để tránh unique zone_id + start_date */
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
    // Trước 1970, khác nhau từng chu kỳ
    await HarvestCycle.bulkWrite(moving.map((d, i) => ({
      updateOne: { filter: { _id: d._id }, update: { $set: { start_date: new Date(-1 - i) } } },
    })))
  }
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

/** Lỗi chỉ ghi log: thao tác trên lô vẫn xong */
export async function rebuildZoneCyclesSafely(zoneId: unknown): Promise<void> {
  try {
    await rebuildZoneCycles(zoneId)
  } catch (err) {
    logger.error('Dựng lại chu kỳ thu hoạch thất bại', { zoneId: String(zoneId), err })
  }
}

export interface ListCyclesQuery {
  zoneId?: string
  houseId?: string
  farmId?: string
  status?: HarvestCycleStatus
  page?: number
  limit?: number
}

/** Farm Technician chỉ zone của nhà được giao */
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

/** Farm Owner không viết kể cả khi farm chưa có chuyên gia (BR-22). OPEN → 409 */
export async function concludeCycle(user: CurrentUser, id: string, input: { text: string; recommendations?: string }) {
  const { cycle: found, farm } = await findCycleWithAccess(id, user)
  if (!farm) throw NotFoundError('Không tìm thấy chu kỳ thu hoạch')

  // Chờ lần dựng lại đang chạy xong rồi mới lưu kết luận
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
