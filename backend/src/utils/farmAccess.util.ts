import { Farm, IFarm } from '@/models/farm.model'
import { House, Zone, IZone, IHouse } from '@/models/houseZone.model'
import { NotFoundError, ForbiddenError, BadRequestError } from '@/utils/appError.util'
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
 * Phạm vi Zone của Farm Operator trên 1 farm (AUTH-FR-005, v1.23.0): `null` = không
 * giới hạn (không phải Operator, hoặc Operator được gán cả farm); Set = chỉ các Zone
 * này. Mọi kiểm tra theo Zone đi qua đây để không service nào tự đọc `zone_ids`.
 */
export function operatorZoneScope(
  // Kiểu cấu trúc tối thiểu để nhận cả document lẫn kết quả .lean()
  farm: { members: Array<{ user_id: unknown; zone_ids?: unknown[] }> },
  user: CurrentUser,
): Set<string> | null {
  if (user.role !== 'FARM_OPERATOR') return null
  const member = farm.members.find(m => String(m.user_id) === user._id)
  if (!member?.zone_ids?.length) return null
  return new Set(member.zone_ids.map(String))
}

/** hasFarmAccess + Zone nằm trong phạm vi của Farm Operator */
export function hasZoneAccess(farm: FarmScope, zoneId: unknown, user: CurrentUser): boolean {
  if (!hasFarmAccess(farm, user)) return false
  const scope = operatorZoneScope(farm, user)
  return !scope || scope.has(String(zoneId))
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
  if (!hasZoneAccess(chain.farm, chain.zone._id, user)) throw ForbiddenError('Không có quyền trên zone này')
  return chain
}

/**
 * Bản ghi thuộc 1 farm và có thể gắn 1 zone (alert, ticket, mẻ thu hoạch): có zone thì
 * kiểm tra theo zone (Farm Operator giới hạn phạm vi), không có zone thì theo farm —
 * bản ghi cấp farm (VD mất điện cả trại) mọi thành viên farm đều xem được.
 */
export async function assertRecordAccess(farmId: unknown, zoneId: unknown, user: CurrentUser): Promise<IFarm> {
  const farm = await assertFarmAccess(String(farmId), user)
  if (zoneId && !hasZoneAccess(farm, zoneId, user)) throw ForbiddenError('Không có quyền trên zone này')
  return farm
}

/**
 * Zone gửi kèm 1 bản ghi thuộc farm (ticket, lịch bảo trì) phải nằm đúng farm đó —
 * tránh bản ghi farm A trỏ sang zone farm B. Chỉ kiểm tra quan hệ, không kiểm tra
 * quyền: caller đã assertFarmAccess(farmId) nên zone cùng farm thì cũng có quyền.
 */
export async function assertZoneInFarm(zoneId: string, farmId: string): Promise<void> {
  const chain = await findZoneChainOrThrow(zoneId)
  if (String(chain.farm._id) !== farmId) throw BadRequestError('zone_id không thuộc farm này')
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
  const houses = await House.find({ farm_id: { $in: farmIds } }).select('_id farm_id').lean()
  const zones = await Zone.find({ house_id: { $in: houses.map(h => h._id) } }).select('_id house_id').lean()
  if (user.role !== 'FARM_OPERATOR') return zones.map(z => z._id)

  // Farm Operator: chỉ giữ Zone nằm trong phạm vi được gán ở từng farm
  const farms = await Farm.find({ _id: { $in: farmIds } }).select('members')
  const scopeByFarm = new Map(farms.map(f => [String(f._id), operatorZoneScope(f, user)]))
  const farmOfHouse = new Map(houses.map(h => [String(h._id), String(h.farm_id)]))
  return zones
    .filter(z => {
      const scope = scopeByFarm.get(farmOfHouse.get(String(z.house_id)) ?? '')
      return !scope || scope.has(String(z._id))
    })
    .map(z => z._id)
}

/**
 * Thu hẹp 1 filter danh sách theo farm (alert/ticket/mẻ thu hoạch/lịch bảo trì) về
 * phạm vi Zone của Farm Operator: bản ghi của Zone trong phạm vi, hoặc bản ghi cấp
 * farm (không gắn zone). Role khác giữ nguyên filter. Thêm vào `$and` để không đè
 * `$or` sẵn có của caller.
 */
export async function applyZoneScope<T extends Record<string, unknown>>(filter: T, user: CurrentUser): Promise<T> {
  if (user.role !== 'FARM_OPERATOR') return filter
  const zoneIds = await listAccessibleZoneIds(user)
  const clause = { $or: [{ zone_id: { $in: zoneIds } }, { zone_id: null }] }
  const and = Array.isArray(filter.$and) ? [...(filter.$and as unknown[]), clause] : [clause]
  return { ...filter, $and: and }
}

/**
 * Mọi Zone thuộc Farm chưa xoá mềm, không phụ thuộc user — nguồn chung để các màn
 * hình toàn hệ thống của Admin (tổng quan sức khỏe, trạng thái node) đếm Farm, Zone
 * và thiết bị khớp nhau: thiết bị của Farm đã xoá mềm không còn hiện ở đâu cả.
 */
export async function listActiveZoneIds() {
  const farmIds = await Farm.find({ is_deleted: false }).distinct('_id')
  const houseIds = await House.find({ farm_id: { $in: farmIds } }).distinct('_id')
  return Zone.find({ house_id: { $in: houseIds } }).distinct('_id')
}
