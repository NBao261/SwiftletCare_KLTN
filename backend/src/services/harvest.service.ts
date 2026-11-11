import { randomUUID } from 'crypto'
import { Types } from 'mongoose'
import { HarvestBatch, IHarvestBatch } from '@/models/harvestBatch.model'
import { Telemetry } from '@/models/telemetry.model'
import { averageReturnRate, houseDailyCounts, vnDate } from '@/services/birdCount.service'
import { assertFarmAccess, assertZoneAccess, listAccessibleFarmIds, listAccessibleZoneIds } from '@/utils/farmAccess.util'
import { logAction } from '@/services/auditLog.service'
import { ConflictError, ForbiddenError, NotFoundError } from '@/utils/appError.util'
import type { CurrentUser, NestType } from '@/types'

/** HARVEST-FR-002 — cửa sổ lấy trung bình môi trường trước ngày thu hoạch */
const ENV_SNAPSHOT_DAYS = 7
/** HARVEST-FR-003 — cửa sổ lấy trung bình return rate đàn chim */
const FLOCK_SNAPSHOT_DAYS = 30

/**
 * HARVEST-FR-002 — trung bình môi trường 7 ngày trước thu hoạch.
 * Flow 7 case 3a: Zone mới chưa đủ dữ liệu thì trả `insufficient_data` thay vì
 * số liệu rỗng/sai lệch, để người xem biết ảnh chụp môi trường chưa đủ tin cậy.
 */
async function buildEnvSnapshot(zoneId: string, harvestDate: Date) {
  const from = new Date(harvestDate.getTime() - ENV_SNAPSHOT_DAYS * 86400_000)

  const [agg] = await Telemetry.aggregate([
    // aggregate() không ép kiểu như find(): để chuỗi thì không bản ghi nào khớp
    { $match: { zone_id: new Types.ObjectId(zoneId), timestamp: { $gte: from, $lte: harvestDate } } },
    {
      $group: {
        _id: null,
        avg_temperature: { $avg: '$temperature' },
        avg_humidity:    { $avg: '$humidity' },
        avg_light_lux:   { $avg: '$light_lux' },
        avg_nh3_ppm:     { $avg: '$nh3_ppm' },
        avg_co2_ppm:     { $avg: '$co2_ppm' },
        sampleCount:     { $sum: 1 },
        firstAt:         { $min: '$timestamp' },
      },
    },
  ])

  if (!agg || agg.sampleCount === 0) {
    return { insufficient_data: true, telemetry_range: { from, to: harvestDate } }
  }

  // Có dữ liệu nhưng không phủ đủ 7 ngày (thiết bị mới lắp giữa chừng) vẫn tính
  // là thiếu — tránh ghi "môi trường 7 ngày" bằng dữ liệu 1 ngày.
  const coversFullWindow = agg.firstAt <= new Date(from.getTime() + 86400_000)

  return {
    avg_temperature: round1(agg.avg_temperature),
    avg_humidity:    round1(agg.avg_humidity),
    avg_light_lux:   round1(agg.avg_light_lux),
    avg_nh3_ppm:     round1(agg.avg_nh3_ppm),
    avg_co2_ppm:     round1(agg.avg_co2_ppm),
    telemetry_range: { from, to: harvestDate },
    insufficient_data: !coversFullWindow,
  }
}

/**
 * HARVEST-FR-003 — đàn chim của nhà yến chứa Zone thu hoạch, 30 ngày trước mẻ (rỗng cho tới khi module
 * VISION có dữ liệu thật): tỷ lệ chim về trung bình theo ngày, và ước tính đàn = số ròng về buổi chiều
 * lớn nhất (số chim thật sự vào nhà ngủ, cộng mọi camera) — cùng nguồn với /analytics/bird-count/*.
 */
async function buildFlockSnapshot(houseId: string, harvestDate: Date) {
  const from = new Date(harvestDate.getTime() - FLOCK_SNAPSHOT_DAYS * 86400_000)
  const days = await houseDailyCounts(houseId, { from: vnDate(from), to: vnDate(harvestDate) })
  if (days.length === 0) return {}
  const evenings = days.filter(d => d.has_evening)
  return {
    avg_return_rate_30d: round1(averageReturnRate(days)),
    estimated_population: evenings.length ? Math.max(...evenings.map(d => d.net_entry)) : undefined,
  }
}

const round1 = (v: number | null | undefined) => (typeof v === 'number' ? +v.toFixed(1) : undefined)

export interface CreateHarvestInput {
  zone_id: string
  harvest_date: string
  nest_count: number
  weight_grams: number
  nest_type: NestType
  product_images?: string[]
}

/**
 * HARVEST-FR-001..004 — tạo đợt thu hoạch, tự gắn ảnh chụp môi trường/đàn chim + trace_code (mã định danh mẻ).
 * Farm Technician chỉ ở zone của nhà được giao (assertZoneAccess) và lô chờ Farm Owner xác nhận (DRAFT);
 * lô của Farm Owner xác nhận ngay (HARVEST-FR-006).
 */
export async function createHarvest(user: CurrentUser, input: CreateHarvestInput): Promise<IHarvestBatch> {
  const { zone, house } = await assertZoneAccess(input.zone_id, user)
  const confirmed = user.role === 'FARM_OWNER'

  const harvestDate = new Date(input.harvest_date)
  const [envSnapshot, flockSnapshot] = await Promise.all([
    buildEnvSnapshot(input.zone_id, harvestDate),
    buildFlockSnapshot(String(house._id), harvestDate),
  ])

  return HarvestBatch.create({
    farm_id:      house.farm_id,
    zone_id:      zone._id,
    created_by:   user._id,
    trace_code:   randomUUID(),
    harvest_date: harvestDate,
    nest_count:   input.nest_count,
    weight_grams: input.weight_grams,
    nest_type:    input.nest_type,
    product_images: input.product_images ?? [],
    env_snapshot:   envSnapshot,
    flock_snapshot: flockSnapshot,
    status: confirmed ? 'CONFIRMED' : 'DRAFT',
    ...(confirmed && { confirmed_by: user._id, confirmed_at: new Date() }),
  })
}

export async function listHarvests(user: CurrentUser, farmId?: string) {
  // farmId do client gửi phải qua kiểm quyền — trước đây gán thẳng vào filter nên
  // đọc được mẻ thu hoạch của farm bất kỳ chỉ bằng cách đoán id (IDOR)
  // Farm Technician: chỉ lô ở zone của các nhà được giao (AUTH-FR-013), farmId chỉ thu hẹp thêm
  if (user.role === 'FARM_TECHNICIAN') {
    const filter: Record<string, unknown> = { zone_id: { $in: await listAccessibleZoneIds(user) } }
    if (farmId) filter.farm_id = farmId
    return HarvestBatch.find(filter).sort({ harvest_date: -1 }).lean()
  }
  if (farmId) await assertFarmAccess(farmId, user)
  const filter: Record<string, unknown> = { farm_id: farmId ?? { $in: await listAccessibleFarmIds(user) } }
  return HarvestBatch.find(filter).sort({ harvest_date: -1 }).lean()
}

export async function getHarvest(id: string, user: CurrentUser): Promise<IHarvestBatch> {
  const batch = await HarvestBatch.findById(id)
  if (!batch || batch.is_deleted) throw NotFoundError('Không tìm thấy đợt thu hoạch')
  // Farm Technician xem lô theo nhà được giao, các role khác theo farm
  if (user.role === 'FARM_TECHNICIAN') await assertZoneAccess(String(batch.zone_id), user)
  else await assertFarmAccess(String(batch.farm_id), user)
  return batch
}

/** HARVEST-FR-005 — Farm Technician chỉ sửa, xoá lô DRAFT do chính mình nhập */
function assertTechnicianOwnDraft(batch: IHarvestBatch, user: CurrentUser): void {
  if (user.role !== 'FARM_TECHNICIAN') return
  if (batch.status !== 'DRAFT' || String(batch.created_by) !== user._id) {
    throw ForbiddenError('Farm Technician chỉ sửa hoặc xoá lô chưa xác nhận do chính mình nhập')
  }
}

/**
 * HARVEST-FR-005 — sửa số liệu ghi nhận của mẻ. SRS v2.0.0 bỏ Marketplace nên không
 * còn ràng buộc "đã đăng bán thì không sửa"; env_snapshot/flock_snapshot vẫn không
 * sửa được qua đây (chỉ chụp một lần lúc tạo).
 */
export async function updateHarvest(
  id: string, user: CurrentUser, updates: Partial<CreateHarvestInput>,
): Promise<IHarvestBatch> {
  const batch = await getHarvest(id, user)
  assertTechnicianOwnDraft(batch, user)
  if (updates.nest_count !== undefined) batch.nest_count = updates.nest_count
  if (updates.weight_grams !== undefined) batch.weight_grams = updates.weight_grams
  if (updates.nest_type !== undefined) batch.nest_type = updates.nest_type
  if (updates.product_images !== undefined) batch.product_images = updates.product_images
  await batch.save()
  return batch
}

export async function removeHarvest(id: string, user: CurrentUser): Promise<void> {
  const batch = await getHarvest(id, user)
  assertTechnicianOwnDraft(batch, user)
  batch.is_deleted = true
  await batch.save()
}

/**
 * HARVEST-FR-006 — Farm Owner của farm xác nhận lô do Farm Technician nhập: DRAFT → CONFIRMED; đã xác nhận
 * → 409. Đóng chu kỳ thu hoạch khi xác nhận (HARVEST-FR-007) làm ở G-26.
 */
export async function confirmHarvest(id: string, user: CurrentUser): Promise<IHarvestBatch> {
  const batch = await getHarvest(id, user)
  if (user.role !== 'FARM_OWNER') throw ForbiddenError('Chỉ Farm Owner xác nhận lô thu hoạch')
  if (batch.status === 'CONFIRMED') throw ConflictError('Lô này đã được xác nhận')
  batch.status = 'CONFIRMED'
  batch.confirmed_by = user._id as never
  batch.confirmed_at = new Date()
  await batch.save()
  await logAction(user._id, 'HARVEST_CONFIRMED', 'harvest_batch', String(batch._id), {
    created_by: String(batch.created_by),
  }, { farmId: String(batch.farm_id) })
  return batch
}
