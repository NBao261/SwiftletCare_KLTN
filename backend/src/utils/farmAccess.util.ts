import { Farm, IFarm } from '@/models/farm.model'
import { House, Zone, IZone, IHouse } from '@/models/houseZone.model'
import { NotFoundError, ForbiddenError } from '@/utils/appError.util'
import type { CurrentUser } from '@/types'

type FarmScope = Pick<IFarm, 'owner_id' | 'members' | 'region'>

/**
 * Technician (nhân viên công ty) được thao tác trên Farm nằm trong khu vực mình
 * phụ trách — không phải mọi Farm (SRS AUTH-FR-005c, RACI mục 4.4 ghi chú ¹).
 * Farm chưa gán `region` thì không Technician nào vào được, tránh mở quyền ngầm.
 */
function isAssignedTechnician(farm: Pick<IFarm, 'region'>, user: CurrentUser): boolean {
  if (user.role !== 'TECHNICIAN') return false
  if (!farm.region) return false
  return (user.assigned_regions ?? []).includes(farm.region)
}

/** true nếu user là owner/member của farm, ADMIN, hoặc Technician phụ trách khu vực */
export function hasFarmAccess(farm: FarmScope, user: CurrentUser): boolean {
  if (user.role === 'ADMIN') return true
  if (isAssignedTechnician(farm, user)) return true
  if (String(farm.owner_id) === user._id) return true
  return farm.members.some(m => String(m.user_id) === user._id)
}

/**
 * true nếu user là Primary Owner của farm, hoặc ADMIN.
 * Technician KHÔNG nằm trong nhóm này: các thao tác quản trị Farm (xóa farm,
 * mời/gỡ thành viên) thuộc về phía khách hàng, không phải nhân viên lắp đặt.
 */
export function isPrimaryOwner(farm: Pick<IFarm, 'owner_id'>, user: CurrentUser): boolean {
  return user.role === 'ADMIN' || String(farm.owner_id) === user._id
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
  const house = await House.findById(zone.house_id)
  if (!house) throw NotFoundError('Không tìm thấy house của zone')
  const farm = await Farm.findById(house.farm_id)
  if (!farm) throw NotFoundError('Không tìm thấy farm của zone')
  return { zone, house, farm }
}

/** Farm + throw ForbiddenError nếu user không có quyền — dùng cho mọi service cần "đọc/sửa farm này" */
export async function assertFarmAccess(farmId: string, user: CurrentUser): Promise<IFarm> {
  const farm = await findFarmOrThrow(farmId)
  if (!hasFarmAccess(farm, user)) throw ForbiddenError('Không có quyền trên farm này')
  return farm
}

/** Zone→House→Farm + check quyền — dùng cho mọi service cần thao tác trên 1 Zone cụ thể */
export async function assertZoneAccess(
  zoneId: string,
  user: CurrentUser,
): Promise<{ zone: IZone; house: IHouse; farm: IFarm }> {
  const chain = await findZoneChainOrThrow(zoneId)
  if (!hasFarmAccess(chain.farm, user)) throw ForbiddenError('Không có quyền trên zone này')
  return chain
}

/** Farm user được phép xem — dùng chung cho list/scoping theo role (Alert/Analytics/Market/Ticket) */
export async function listAccessibleFarmIds(user: CurrentUser) {
  if (user.role === 'ADMIN') return (await Farm.find().select('_id').lean()).map(f => f._id)
  if (user.role === 'TECHNICIAN') {
    return (await Farm.find({ region: { $in: user.assigned_regions ?? [] } }).select('_id').lean()).map(f => f._id)
  }
  return (
    await Farm.find({ $or: [{ owner_id: user._id }, { 'members.user_id': user._id }] })
      .select('_id')
      .lean()
  ).map(f => f._id)
}

/**
 * Zone user được phép xem — flatten Farm accessible → House → Zone. Dùng khi
 * cần liệt kê tài nguyên theo Zone (VD danh sách thiết bị) mà không có sẵn
 * `zoneId` cụ thể để check — tránh trả về dữ liệu của farm khác (IDOR).
 */
export async function listAccessibleZoneIds(user: CurrentUser) {
  const farmIds = await listAccessibleFarmIds(user)
  const houses = await House.find({ farm_id: { $in: farmIds } }).select('_id').lean()
  const zones = await Zone.find({ house_id: { $in: houses.map(h => h._id) } }).select('_id').lean()
  return zones.map(z => z._id)
}
