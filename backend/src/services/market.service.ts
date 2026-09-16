import { randomUUID } from 'crypto'
import { HarvestBatch, IHarvestBatch } from '@/models/harvestBatch.model'
import { NestListing, INestListing } from '@/models/nestListing.model'
import { ContactInquiry } from '@/models/contactInquiry.model'
import { Telemetry } from '@/models/telemetry.model'
import { BirdCountRecord } from '@/models/birdCountRecord.model'
import { Zone, House } from '@/models/houseZone.model'
import { Farm } from '@/models/farm.model'
import { assertFarmAccess, listAccessibleFarmIds } from '@/services/alert.service'
import { NotFoundError, ConflictError } from '@/utils/appError.util'
import type { CurrentUser, NestType, ListingStatus } from '@/types'

/** MARKET-FR-002 — cửa sổ lấy trung bình môi trường trước ngày thu hoạch */
const ENV_SNAPSHOT_DAYS = 7
/** MARKET-FR-003 — cửa sổ lấy trung bình return rate đàn chim */
const FLOCK_SNAPSHOT_DAYS = 30

/**
 * MARKET-FR-002 — trung bình môi trường 7 ngày trước thu hoạch.
 * Flow 7 case 3a: Zone mới chưa đủ dữ liệu thì trả `insufficient_data` thay vì
 * số liệu rỗng/sai lệch, để Traceability Card nói thật với người mua.
 */
async function buildEnvSnapshot(zoneId: string, harvestDate: Date) {
  const from = new Date(harvestDate.getTime() - ENV_SNAPSHOT_DAYS * 86400_000)

  const [agg] = await Telemetry.aggregate([
    { $match: { zone_id: zoneId, timestamp: { $gte: from, $lte: harvestDate } } },
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
  // là thiếu — tránh quảng cáo "môi trường 7 ngày" bằng dữ liệu 1 ngày.
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

/** MARKET-FR-003 — return rate trung bình 30 ngày (rỗng cho tới khi module VISION có dữ liệu thật) */
async function buildFlockSnapshot(zoneId: string, harvestDate: Date) {
  const from = new Date(harvestDate.getTime() - FLOCK_SNAPSHOT_DAYS * 86400_000)
  const [agg] = await BirdCountRecord.aggregate([
    { $match: { zone_id: zoneId, timestamp: { $gte: from, $lte: harvestDate } } },
    { $group: { _id: null, avg_return_rate_30d: { $avg: '$return_rate' }, maxEntry: { $max: '$entry_count' } } },
  ])
  if (!agg) return {}
  return {
    avg_return_rate_30d: round1(agg.avg_return_rate_30d),
    estimated_population: agg.maxEntry ?? undefined,
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

/** MARKET-FR-001..004 — tạo đợt thu hoạch, tự gắn truy xuất nguồn gốc + trace_code */
export async function createHarvest(user: CurrentUser, input: CreateHarvestInput): Promise<IHarvestBatch> {
  const zone = await Zone.findById(input.zone_id)
  if (!zone) throw NotFoundError('Không tìm thấy zone')
  const house = await House.findById(zone.house_id)
  if (!house) throw NotFoundError('Không tìm thấy house của zone')
  await assertFarmAccess(String(house.farm_id), user)

  const harvestDate = new Date(input.harvest_date)
  const [envSnapshot, flockSnapshot] = await Promise.all([
    buildEnvSnapshot(input.zone_id, harvestDate),
    buildFlockSnapshot(input.zone_id, harvestDate),
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
    status: 'DRAFT',
  })
}

export async function listHarvests(user: CurrentUser, farmId?: string) {
  const accessible = await listAccessibleFarmIds(user)
  const filter: Record<string, unknown> = { farm_id: farmId ?? { $in: accessible } }
  return HarvestBatch.find(filter).sort({ harvest_date: -1 }).lean()
}

export async function getHarvest(id: string, user: CurrentUser): Promise<IHarvestBatch> {
  const batch = await HarvestBatch.findById(id)
  if (!batch || batch.is_deleted) throw NotFoundError('Không tìm thấy đợt thu hoạch')
  await assertFarmAccess(String(batch.farm_id), user)
  return batch
}

/**
 * MARKET-FR-005 / Flow 7 case 5a — chỉ sửa được khi còn DRAFT. Sau khi đã đăng
 * bán, env_snapshot/flock_snapshot đã công bố cho người mua nên phải bất biến,
 * nếu không thì truy xuất nguồn gốc mất hết ý nghĩa.
 */
export async function updateHarvest(
  id: string, user: CurrentUser, updates: Partial<CreateHarvestInput>,
): Promise<IHarvestBatch> {
  const batch = await getHarvest(id, user)
  if (batch.status !== 'DRAFT') {
    throw ConflictError('Đợt thu hoạch đã đăng bán — chỉ được cập nhật trạng thái tin đăng, không sửa lại dữ liệu truy xuất')
  }

  if (updates.nest_count !== undefined) batch.nest_count = updates.nest_count
  if (updates.weight_grams !== undefined) batch.weight_grams = updates.weight_grams
  if (updates.nest_type !== undefined) batch.nest_type = updates.nest_type
  if (updates.product_images !== undefined) batch.product_images = updates.product_images
  await batch.save()
  return batch
}

export async function removeHarvest(id: string, user: CurrentUser): Promise<void> {
  const batch = await getHarvest(id, user)
  if (batch.status !== 'DRAFT') throw ConflictError('Không xoá được đợt thu hoạch đã đăng bán')
  batch.is_deleted = true
  await batch.save()
}

// ── Nest Listing (MARKET-FR-006..013) ────────────────────────────────────────

export interface CreateListingInput {
  harvest_batch_id: string
  title: string
  description?: string
  price_vnd?: number
  contact_info?: { show_phone?: boolean; show_email?: boolean; show_zalo?: boolean }
}

/** MARKET-FR-006 — đăng bán từ 1 Harvest Batch */
export async function createListing(user: CurrentUser, input: CreateListingInput): Promise<INestListing> {
  const batch = await getHarvest(input.harvest_batch_id, user)

  const existing = await NestListing.findOne({ harvest_batch_id: batch._id })
  if (existing) throw ConflictError('Đợt thu hoạch này đã có tin đăng')

  const listing = await NestListing.create({
    harvest_batch_id: batch._id,
    farm_id:          batch.farm_id,
    title:            input.title,
    description:      input.description,
    price_vnd:        input.price_vnd,
    contact_info:     input.contact_info,
    listing_status:   'AVAILABLE',
    published_at:     new Date(),
  })

  batch.status = 'LISTED'
  await batch.save()
  return listing
}

export async function updateListing(
  id: string, user: CurrentUser, updates: Partial<{ title: string; description: string; price_vnd: number; listing_status: ListingStatus }>,
): Promise<INestListing> {
  const listing = await NestListing.findById(id)
  if (!listing) throw NotFoundError('Không tìm thấy tin đăng')
  await assertFarmAccess(String(listing.farm_id), user)

  if (updates.title !== undefined) listing.title = updates.title
  if (updates.description !== undefined) listing.description = updates.description
  if (updates.price_vnd !== undefined) listing.price_vnd = updates.price_vnd
  if (updates.listing_status !== undefined) listing.listing_status = updates.listing_status
  await listing.save()
  return listing
}

/** MARKET-FR-008 — danh sách công khai, không cần đăng nhập */
export async function listPublicListings(query: {
  nestType?: string; region?: string; minPrice?: number; maxPrice?: number; page?: number; limit?: number
}) {
  const page = query.page ?? 1
  const limit = Math.min(query.limit ?? 20, 100)

  const filter: Record<string, unknown> = { listing_status: 'AVAILABLE' }
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.price_vnd = {
      ...(query.minPrice !== undefined && { $gte: query.minPrice }),
      ...(query.maxPrice !== undefined && { $lte: query.maxPrice }),
    }
  }
  if (query.region) {
    const farmIds = (await Farm.find({ region: query.region }).select('_id').lean()).map(f => f._id)
    filter.farm_id = { $in: farmIds }
  }

  const [records, total] = await Promise.all([
    NestListing.find(filter).sort({ published_at: -1 }).skip((page - 1) * limit).limit(limit)
      .populate('harvest_batch_id', 'nest_type harvest_date weight_grams product_images trace_code').lean(),
    NestListing.countDocuments(filter),
  ])

  // Lọc theo loại yến phải làm sau populate vì nest_type nằm ở HarvestBatch
  const filtered = query.nestType
    ? records.filter(r => (r.harvest_batch_id as unknown as { nest_type?: string })?.nest_type === query.nestType)
    : records

  return { records: filtered, total, page, limit }
}

/** MARKET-FR-009 — Traceability Card (công khai) + đếm lượt xem (MARKET-FR-012) */
export async function getListingDetail(id: string) {
  const listing = await NestListing.findByIdAndUpdate(id, { $inc: { view_count: 1 } }, { new: true })
    .populate('harvest_batch_id')
    .lean()
  if (!listing) throw NotFoundError('Không tìm thấy tin đăng')

  const farm = await Farm.findById(listing.farm_id).select('name address region created_at').lean()
  return { listing, farm }
}

/**
 * MARKET-FR-011 — tra cứu nguồn gốc bằng Trace Code in trên bao bì.
 * Flow 7 case 11a: mã sai chỉ trả "không tìm thấy" chung chung, không lộ chi
 * tiết hệ thống, tránh bị dò mã hàng loạt.
 */
export async function traceByCode(traceCode: string) {
  const batch = await HarvestBatch.findOne({ trace_code: traceCode }).lean()
  if (!batch) throw NotFoundError('Không tìm thấy lô yến với mã này, vui lòng kiểm tra lại')

  const [farm, zone] = await Promise.all([
    Farm.findById(batch.farm_id).select('name address region').lean(),
    Zone.findById(batch.zone_id).select('name').lean(),
  ])
  return { batch, farm, zone }
}

/** MARKET-FR-010 — Buyer gửi liên hệ (không cần tài khoản) */
export async function createInquiry(
  listingId: string,
  input: { buyer_name: string; buyer_phone?: string; buyer_email?: string; message: string },
) {
  const listing = await NestListing.findById(listingId)
  if (!listing) throw NotFoundError('Không tìm thấy tin đăng')

  const inquiry = await ContactInquiry.create({ listing_id: listing._id, ...input })
  listing.inquiry_count += 1
  await listing.save()
  return inquiry
}

export async function listInquiries(listingId: string, user: CurrentUser) {
  const listing = await NestListing.findById(listingId)
  if (!listing) throw NotFoundError('Không tìm thấy tin đăng')
  await assertFarmAccess(String(listing.farm_id), user)
  return ContactInquiry.find({ listing_id: listing._id }).sort({ created_at: -1 }).lean()
}

/** MARKET-FR-012 */
export async function getListingStats(listingId: string, user: CurrentUser) {
  const listing = await NestListing.findById(listingId)
  if (!listing) throw NotFoundError('Không tìm thấy tin đăng')
  await assertFarmAccess(String(listing.farm_id), user)
  return {
    view_count: listing.view_count,
    inquiry_count: listing.inquiry_count,
    published_at: listing.published_at,
    listing_status: listing.listing_status,
  }
}

/** MARKET-FR-013 — Farm Profile công khai */
export async function getFarmProfile(farmId: string) {
  const farm = await Farm.findById(farmId).select('name address region created_at').lean()
  if (!farm) throw NotFoundError('Không tìm thấy trang trại')

  const [listingCount, batchCount] = await Promise.all([
    NestListing.countDocuments({ farm_id: farmId, listing_status: 'AVAILABLE' }),
    HarvestBatch.countDocuments({ farm_id: farmId }),
  ])

  const yearsActive = Math.max(
    0,
    Math.floor((Date.now() - new Date(farm.created_at).getTime()) / (365 * 86400_000)),
  )
  // Địa chỉ chi tiết là thông tin riêng tư của farm — hồ sơ công khai chỉ hiện
  // cấp khu vực (PRIV-NFR-002 tinh thần tối thiểu hoá dữ liệu).
  return {
    name: farm.name,
    region: farm.region,
    years_active: yearsActive,
    available_listings: listingCount,
    total_harvests: batchCount,
  }
}
