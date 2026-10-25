import { Farm, IFarm } from '@/models/farm.model'
import { House, Zone, IZone, IHouse } from '@/models/houseZone.model'
import { NotFoundError, ForbiddenError, BadRequestError } from '@/utils/appError.util'
import type { CurrentUser } from '@/types'

type FarmScope = Pick<IFarm, 'owner_id' | 'members'>

/**
 * Owner hoặc thành viên (đồng sở hữu, Domain Expert) — mở cả dữ liệu vận hành của farm.
 * Technician và Administrator không phải thành viên nên không qua (Report 3 §2.4, FARM-FR-009).
 */
export function hasFarmAccess(farm: FarmScope, user: CurrentUser): boolean {
  if (String(farm.owner_id) === user._id) return true
  return farm.members.some(m => String(m.user_id) === user._id)
}

/**
 * FARM-FR-009 — Technician thấy House, Zone, thiết bị và cảnh báo thiết bị của mọi farm mà không
 * cần là thành viên; chỉ dùng cho các đường đó, không cho telemetry, phân tích, số đếm chim…
 */
export function hasDeviceAccess(farm: FarmScope, user: CurrentUser): boolean {
  return user.role === 'TECHNICIAN' || hasFarmAccess(farm, user)
}

/** `device` = cấu trúc farm và thiết bị (mở cho Technician), `farm` = mọi thứ còn lại */
export type AccessScope = 'farm' | 'device'

function canAccess(farm: FarmScope, user: CurrentUser, scope: AccessScope): boolean {
  return scope === 'device' ? hasDeviceAccess(farm, user) : hasFarmAccess(farm, user)
}

/**
 * true nếu user là Primary Owner của farm.
 * Technician, Admin KHÔNG nằm trong nhóm này: các thao tác quản trị Farm (xóa farm,
 * mời/gỡ thành viên) thuộc về phía khách hàng (Report 3 §2.4).
 */
export function isPrimaryOwner(farm: Pick<IFarm, 'owner_id'>, user: CurrentUser): boolean {
  return String(farm.owner_id) === user._id
}

// ── Lookup + check gộp — nguồn duy nhất, tránh mỗi service tự viết lại ──────
// (trước đây `findFarmOrThrow`/`findZoneChainOrThrow` nằm trong farm.service.ts,
// `assertFarmAccess`/`listAccessibleFarmIds` nằm trong alert.service.ts — bị
// import chéo từ 3-4 service khác. Gom về đây vì farm.service.ts/alert.service.ts
// vẫn cần import `hasFarmAccess` từ file này, nếu để lookup ở đó sẽ tạo circular
// import.)

export async function findFarmOrThrow(farmId: string): Promise<IFarm> {
  const farm = await Farm.findById(farmId)
  if (!farm) throw NotFoundError('Không tìm thấy farm')
  return farm
}

export async function findZoneChainOrThrow(zoneId: string): Promise<{ zone: IZone; house: IHouse; farm: IFarm }> {
  const zone = await Zone.findById(zoneId)
  if (!zone) throw NotFoundError('Không tìm thấy zone')
  // zone.farm_id lưu sẵn → House và Farm lấy song song thay vì Zone→House→Farm nối tiếp
  const [house, farm] = await Promise.all([House.findById(zone.house_id), Farm.findById(zone.farm_id)])
  if (!house) throw NotFoundError('Không tìm thấy house của zone')
  if (!farm) throw NotFoundError('Không tìm thấy farm của zone')
  return { zone, house, farm }
}

export async function findHouseChainOrThrow(houseId: string): Promise<{ house: IHouse; farm: IFarm }> {
  const house = await House.findById(houseId)
  if (!house) throw NotFoundError('Không tìm thấy house')
  const farm = await Farm.findById(house.farm_id)
  if (!farm) throw NotFoundError('Không tìm thấy farm của house')
  return { house, farm }
}

/** House→Farm + check quyền — camera đếm chim và số đếm chim gắn House (SRS v2.1.8) */
export async function assertHouseAccess(
  houseId: string, user: CurrentUser, scope: AccessScope = 'farm',
): Promise<{ house: IHouse; farm: IFarm }> {
  const chain = await findHouseChainOrThrow(houseId)
  if (!canAccess(chain.farm, user, scope)) throw ForbiddenError('Không có quyền trên house này')
  return chain
}

/**
 * Số đếm chim là của cả House. API cũ còn gửi `zoneId` (frontend/mobile trước v2.1.8): quy ra
 * House chứa Zone đó. Có `houseId` thì dùng `houseId`.
 */
export async function assertHouseAccessByParams(
  params: { houseId?: string; zoneId?: string }, user: CurrentUser, scope: AccessScope = 'farm',
): Promise<{ house: IHouse; farm: IFarm }> {
  if (params.houseId) return assertHouseAccess(params.houseId, user, scope)
  if (params.zoneId) {
    const { house, farm } = await assertZoneAccess(params.zoneId, user, scope)
    return { house, farm }
  }
  throw BadRequestError('Cần houseId')
}

/** Farm + throw ForbiddenError nếu user không có quyền — dùng cho mọi service cần "đọc/sửa farm này" */
export async function assertFarmAccess(farmId: string, user: CurrentUser, scope: AccessScope = 'farm'): Promise<IFarm> {
  const farm = await findFarmOrThrow(farmId)
  if (!canAccess(farm, user, scope)) throw ForbiddenError('Không có quyền trên farm này')
  return farm
}

/** Zone→House→Farm + check quyền — dùng cho mọi service cần thao tác trên 1 Zone cụ thể */
export async function assertZoneAccess(
  zoneId: string,
  user: CurrentUser,
  scope: AccessScope = 'farm',
): Promise<{ zone: IZone; house: IHouse; farm: IFarm }> {
  const chain = await findZoneChainOrThrow(zoneId)
  // Quyền trên 1 Zone = quyền trên farm chứa nó (SRS v2.0.0 bỏ phạm vi theo Zone)
  if (!canAccess(chain.farm, user, scope)) throw ForbiddenError('Không có quyền trên zone này')
  return chain
}

/**
 * Farm user được phép xem — dùng chung cho list/scoping theo role (Alert/Analytics/Harvest).
 * Admin không thấy farm nào (Report 3 §2.4); Technician thấy mọi farm ở phạm vi `device`.
 */
export async function listAccessibleFarmIds(user: CurrentUser, scope: AccessScope = 'farm') {
  if (scope === 'device' && user.role === 'TECHNICIAN') return (await Farm.find().select('_id').lean()).map(f => f._id)
  return (
    await Farm.find({ $or: [{ owner_id: user._id }, { 'members.user_id': user._id }] })
      .select('_id')
      .lean()
  ).map(f => f._id)
}

/**
 * Zone user được phép xem — mọi Zone của các Farm accessible. Dùng khi
 * cần liệt kê tài nguyên theo Zone (VD danh sách thiết bị) mà không có sẵn
 * `zoneId` cụ thể để check — tránh trả về dữ liệu của farm khác (IDOR).
 */
export async function listAccessibleZoneIds(user: CurrentUser, scope: AccessScope = 'farm') {
  const farmIds = await listAccessibleFarmIds(user, scope)
  return Zone.find({ farm_id: { $in: farmIds } }).distinct('_id')
}

/** House user được phép xem — liệt kê camera đếm chim khi không có `houseId` cụ thể (chống IDOR) */
export async function listAccessibleHouseIds(user: CurrentUser, scope: AccessScope = 'farm') {
  const farmIds = await listAccessibleFarmIds(user, scope)
  return House.find({ farm_id: { $in: farmIds } }).distinct('_id')
}

/** Mọi House thuộc Farm chưa xoá mềm — cùng phạm vi với listActiveZoneIds cho màn hình Admin */
export async function listActiveHouseIds() {
  const farmIds = await Farm.find({ is_deleted: false }).distinct('_id')
  return House.find({ farm_id: { $in: farmIds } }).distinct('_id')
}

/**
 * Mọi Zone thuộc Farm chưa xoá mềm, không phụ thuộc user — nguồn chung để các màn
 * hình toàn hệ thống của Admin (tổng quan sức khỏe, trạng thái node) đếm Farm, Zone
 * và thiết bị khớp nhau: thiết bị của Farm đã xoá mềm không còn hiện ở đâu cả.
 */
export async function listActiveZoneIds() {
  const farmIds = await Farm.find({ is_deleted: false }).distinct('_id')
  return Zone.find({ farm_id: { $in: farmIds } }).distinct('_id')
}
