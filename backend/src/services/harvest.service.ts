import { randomUUID } from 'crypto'
import { Types } from 'mongoose'
import { HarvestBatch, IHarvestBatch } from '@/models/harvestBatch.model'
import { Telemetry } from '@/models/telemetry.model'
import { averageReturnRate, houseDailyCounts, vnDate } from '@/services/birdCount.service'
import { assertFarmAccess, assertZoneAccess, listAccessibleFarmIds, listAccessibleZoneIds } from '@/utils/farmAccess.util'
import { logAction } from '@/services/auditLog.service'
import { rebuildZoneCyclesSafely } from '@/services/harvestCycle.service'
import { AppError, ConflictError, ForbiddenError, NotFoundError } from '@/utils/appError.util'
import { presignedGetUrl, removeObject } from '@/config/minio.config'
import { storePhotos, type UploadedPhoto } from '@/services/workOrder.service'
import type { CurrentUser, NestType } from '@/types'

const ENV_SNAPSHOT_DAYS = 7
const FLOCK_SNAPSHOT_DAYS = 30

/** Zone chưa đủ dữ liệu thì trả insufficient_data */
async function buildEnvSnapshot(zoneId: string, harvestDate: Date) {
  const from = new Date(harvestDate.getTime() - ENV_SNAPSHOT_DAYS * 86400_000)

  const [agg] = await Telemetry.aggregate([
    // aggregate() không ép kiểu như find()
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

  // Không phủ đủ 7 ngày vẫn là thiếu
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

/** Ước tính đàn = số ròng về buổi chiều lớn nhất, cộng mọi camera */
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

/** Farm Technician chỉ ở nhà được giao, lô chờ xác nhận (DRAFT); lô của Farm Owner xác nhận ngay */
export async function createHarvest(user: CurrentUser, input: CreateHarvestInput): Promise<IHarvestBatch> {
  const { zone, house } = await assertZoneAccess(input.zone_id, user)
  const confirmed = user.role === 'FARM_OWNER'

  // Không phải ngày chưa tới theo giờ VN
  const harvestDate = new Date(input.harvest_date)
  if (Number.isNaN(harvestDate.getTime()) || vnDate(harvestDate) > vnDate(new Date())) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Ngày thu hoạch không hợp lệ hoặc sau hôm nay')
  }
  const [envSnapshot, flockSnapshot] = await Promise.all([
    buildEnvSnapshot(input.zone_id, harvestDate),
    buildFlockSnapshot(String(house._id), harvestDate),
  ])

  const batch = await HarvestBatch.create({
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
  // HARVEST-FR-007
  if (confirmed) await rebuildZoneCyclesSafely(zone._id)
  return batch
}

export async function listHarvests(user: CurrentUser, farmId?: string) {
  // farmId của client phải qua kiểm quyền (IDOR). Farm Technician chỉ zone của nhà được giao
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
  if (user.role === 'FARM_TECHNICIAN') await assertZoneAccess(String(batch.zone_id), user)
  else await assertFarmAccess(String(batch.farm_id), user)
  return batch
}

/** Khoá ảnh không ra ngoài */
export async function getHarvestView(id: string, user: CurrentUser) {
  await getHarvest(id, user)
  return presentHarvest((await HarvestBatch.findById(id).select('+photo_object_key'))!)
}

async function presentHarvest(batch: IHarvestBatch) {
  const { photo_object_key: photoKey, ...rest } = batch.toObject()
  return { ...rest, photo_url: photoKey ? await presignedGetUrl(photoKey) : null }
}

/** Ai sửa được lô thì đặt được ảnh */
export async function setHarvestPhoto(id: string, user: CurrentUser, file: UploadedPhoto | undefined) {
  if (!file) throw new AppError(422, 'VALIDATION_ERROR', 'Cần gửi một ảnh ở trường `photo`')
  await getHarvest(id, user).then(batch => assertTechnicianOwnDraft(batch, user))
  const batch = (await HarvestBatch.findById(id).select('+photo_object_key'))!
  const previousKey = batch.photo_object_key
  const [key] = await storePhotos([file], `harvests/${String(batch._id)}`)
  batch.photo_object_key = key
  await batch.save()
  // Xoá lỗi chỉ để lại file thừa
  if (previousKey) await removeObject(previousKey).catch(() => undefined)
  await logAction(user._id, 'HARVEST_PHOTO_SET', 'harvest_batch', String(batch._id), { photo_object_key: key }, { farmId: String(batch.farm_id) })
  return presentHarvest(batch)
}

function assertTechnicianOwnDraft(batch: IHarvestBatch, user: CurrentUser): void {
  if (user.role !== 'FARM_TECHNICIAN') return
  if (batch.status !== 'DRAFT' || String(batch.created_by) !== user._id) {
    throw ForbiddenError('Farm Technician chỉ sửa hoặc xoá lô chưa xác nhận do chính mình nhập')
  }
}

/** Snapshot chỉ chụp lúc tạo, không sửa qua đây */
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
  // Report 3 §6.13
  if (batch.status === 'CONFIRMED') await rebuildZoneCyclesSafely(batch.zone_id)
  return batch
}

export async function removeHarvest(id: string, user: CurrentUser): Promise<void> {
  const batch = await getHarvest(id, user)
  assertTechnicianOwnDraft(batch, user)
  batch.is_deleted = true
  await batch.save()
  // Chu kỳ gộp vào chu kỳ sau
  if (batch.status === 'CONFIRMED') await rebuildZoneCyclesSafely(batch.zone_id)
}

/** Đã xác nhận → 409 */
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
  await rebuildZoneCyclesSafely(batch.zone_id)
  return batch
}
