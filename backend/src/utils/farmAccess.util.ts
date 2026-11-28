import { CameraNode, SensorNode } from '@/models/device.model'
import { Farm, IFarm } from '@/models/farm.model'
import { House, Zone, IZone, IHouse } from '@/models/houseZone.model'
import { User, SIGN_IN_FILTER } from '@/models/user.model'
import { NotFoundError, ForbiddenError, BadRequestError } from '@/utils/appError.util'
import { technicianOnDuty } from '@/utils/roster.util'
import type { CurrentUser } from '@/types'

type FarmScope = Pick<IFarm, 'owner_id' | 'members'>
type HouseScope = Pick<IHouse, 'technicians'>

// Admin không qua; Farm Technician bị chặn, đường nào mở cho thợ thì kiểm canAccessHouse
export function hasFarmAccess(farm: FarmScope, user: CurrentUser): boolean {
  if (user.role === 'FARM_TECHNICIAN') return false
  if (String(farm.owner_id) === user._id) return true
  return farm.members.some(m => String(m.user_id) === user._id && m.role !== 'FARM_TECHNICIAN')
}

export function isFarmTechnician(farm: Pick<IFarm, 'members'>, user: CurrentUser): boolean {
  return user.role === 'FARM_TECHNICIAN'
    && farm.members.some(m => String(m.user_id) === user._id && m.role === 'FARM_TECHNICIAN')
}

export function isAssignedTechnician(farm: Pick<IFarm, 'members'>, house: HouseScope, user: CurrentUser): boolean {
  return isFarmTechnician(farm, user) && (house.technicians ?? []).some(t => String(t.user_id) === user._id)
}

// chỉ cho cấu trúc và thiết bị, không cho telemetry, phân tích, số đếm
export function hasDeviceAccess(farm: FarmScope, user: CurrentUser): boolean {
  return user.role === 'ADMIN' || hasFarmAccess(farm, user)
}

export type AccessScope = 'farm' | 'device'

function canAccess(farm: FarmScope, user: CurrentUser, scope: AccessScope): boolean {
  return scope === 'device' ? hasDeviceAccess(farm, user) : hasFarmAccess(farm, user)
}

// Route vẫn phải cho FARM_TECHNICIAN qua requireRole
export function canAccessHouse(farm: FarmScope, house: HouseScope, user: CurrentUser, scope: AccessScope = 'farm'): boolean {
  return canAccess(farm, user, scope) || isAssignedTechnician(farm, house, user)
}

export function isPrimaryOwner(farm: Pick<IFarm, 'owner_id'>, user: CurrentUser): boolean {
  return String(farm.owner_id) === user._id
}

// chuyên gia bị khoá không tính, Farm Owner làm thay
export async function activeExpertIds(farm: Pick<IFarm, 'members'>): Promise<string[]> {
  const ids = farm.members.filter(m => m.role === 'DOMAIN_EXPERT').map(m => m.user_id)
  if (ids.length === 0) return []
  const active = await User.find({ _id: { $in: ids }, ...SIGN_IN_FILTER }).select('_id').lean()
  return active.map(u => String(u._id))
}

export async function farmHasActiveExpert(farm: Pick<IFarm, 'members'>): Promise<boolean> {
  return (await activeExpertIds(farm)).length > 0
}

// Farm Owner chỉ làm thay khi farm chưa có chuyên gia. Gọi sau assert*Access
export async function assertExpertDecision(farm: Pick<IFarm, 'members'>, user: CurrentUser): Promise<void> {
  if (user.role === 'DOMAIN_EXPERT') return
  if (user.role === 'FARM_OWNER' && !(await farmHasActiveExpert(farm))) return
  throw ForbiddenError('Trang trại đã có chuyên gia, quyết định này do chuyên gia thực hiện')
}

// Đặt ở đây để tránh circular import giữa các service

export async function findFarmOrThrow(farmId: string): Promise<IFarm> {
  const farm = await Farm.findById(farmId)
  if (!farm) throw NotFoundError('Không tìm thấy farm')
  return farm
}

export async function findZoneChainOrThrow(zoneId: string): Promise<{ zone: IZone; house: IHouse; farm: IFarm }> {
  const zone = await Zone.findById(zoneId)
  if (!zone) throw NotFoundError('Không tìm thấy zone')
  // farm_id lưu sẵn: lấy House và Farm song song
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

export async function assertHouseAccess(
  houseId: string, user: CurrentUser, scope: AccessScope = 'farm',
): Promise<{ house: IHouse; farm: IFarm }> {
  const chain = await findHouseChainOrThrow(houseId)
  if (!canAccessHouse(chain.farm, chain.house, user, scope)) throw ForbiddenError('Không có quyền trên house này')
  return chain
}

// Nhà chứa một thiết bị: node cảm biến qua Zone, camera theo nhà; thiết bị đã gỡ vẫn tính (lịch sử còn)
export async function assertNodeHouseAccess(
  nodeId: string, user: CurrentUser, scope: AccessScope = 'farm',
): Promise<{ house: IHouse; farm: IFarm }> {
  const sensor = await SensorNode.findById(nodeId).select('zone_id').lean()
  if (sensor) {
    const { house, farm } = await assertZoneAccess(String(sensor.zone_id), user, scope)
    return { house, farm }
  }
  const camera = await CameraNode.findById(nodeId).select('house_id').lean()
  if (!camera) throw NotFoundError('Không tìm thấy thiết bị')
  return assertHouseAccess(String(camera.house_id), user, scope)
}

// zoneId cũ: quy ra House chứa Zone
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

export async function assertFarmAccess(farmId: string, user: CurrentUser, scope: AccessScope = 'farm'): Promise<IFarm> {
  const farm = await findFarmOrThrow(farmId)
  if (!canAccess(farm, user, scope)) throw ForbiddenError('Không có quyền trên farm này')
  return farm
}

export async function assertZoneAccess(
  zoneId: string,
  user: CurrentUser,
  scope: AccessScope = 'farm',
): Promise<{ zone: IZone; house: IHouse; farm: IFarm }> {
  const chain = await findZoneChainOrThrow(zoneId)
  if (!canAccessHouse(chain.farm, chain.house, user, scope)) throw ForbiddenError('Không có quyền trên zone này')
  return chain
}

// Admin rỗng trừ scope device; Farm Technician rỗng, dùng listAccessibleZoneIds/HouseIds
export async function listAccessibleFarmIds(user: CurrentUser, scope: AccessScope = 'farm') {
  if (user.role === 'FARM_TECHNICIAN') return []
  if (user.role === 'ADMIN') return scope === 'device' ? (await Farm.find().select('_id').lean()).map(f => f._id) : []
  return (
    await Farm.find({ $or: [{ owner_id: user._id }, { 'members.user_id': user._id }] })
      .select('_id')
      .lean()
  ).map(f => f._id)
}

export async function listAccessibleZoneIds(user: CurrentUser, scope: AccessScope = 'farm') {
  if (user.role === 'FARM_TECHNICIAN') return Zone.find({ house_id: { $in: await listAssignedHouseIds(user) } }).distinct('_id')
  const farmIds = await listAccessibleFarmIds(user, scope)
  return Zone.find({ farm_id: { $in: farmIds } }).distinct('_id')
}

export async function listAccessibleHouseIds(user: CurrentUser, scope: AccessScope = 'farm') {
  if (user.role === 'FARM_TECHNICIAN') return listAssignedHouseIds(user)
  const farmIds = await listAccessibleFarmIds(user, scope)
  return House.find({ farm_id: { $in: farmIds } }).distinct('_id')
}

// Bị gỡ khỏi farm thì mất quyền dù lần gán còn sót
export async function listAssignedHouseIds(user: CurrentUser) {
  if (user.role !== 'FARM_TECHNICIAN') return []
  const farmIds = await Farm.find({ members: { $elemMatch: { user_id: user._id, role: 'FARM_TECHNICIAN' } } }).distinct('_id')
  return House.find({ farm_id: { $in: farmIds }, 'technicians.user_id': user._id }).distinct('_id')
}

// Bị gỡ hay bị khoá thì không nhận việc nữa dù lần gán còn sót
export async function activeHouseTechnicianIds(
  house: Pick<IHouse, 'technicians'>, farm: Pick<IFarm, 'members'>,
): Promise<string[]> {
  const members = new Set(farm.members.filter(m => m.role === 'FARM_TECHNICIAN').map(m => String(m.user_id)))
  const assigned = (house.technicians ?? []).map(t => String(t.user_id)).filter(id => members.has(id))
  if (assigned.length === 0) return []
  const active = await User.find({ _id: { $in: assigned }, role: 'FARM_TECHNICIAN', ...SIGN_IN_FILTER }).select('_id').lean()
  return active.map(u => String(u._id))
}

// Ngoài ca mà không có thợ chính hợp lệ thì lấy thợ hợp lệ đầu tiên; null = Farm Owner xử lý
export async function activeTechnicianOnDuty(
  house: Pick<IHouse, 'technicians' | 'roster'>, farm: Pick<IFarm, 'members'>, at: Date = new Date(),
): Promise<string | null> {
  const valid = new Set(await activeHouseTechnicianIds(house, farm))
  if (valid.size === 0) return null
  const technicians = (house.technicians ?? []).filter(t => valid.has(String(t.user_id)))
  return technicianOnDuty({
    technicians,
    roster: (house.roster ?? []).filter(s => valid.has(String(s.technician_id))),
  }, at) ?? (technicians[0] ? String(technicians[0].user_id) : null)
}

// Farm Technician chỉ các nhà được giao; người khác 403
export async function listFarmHouseIds(farmId: string, user: CurrentUser) {
  const farm = await findFarmOrThrow(farmId)
  if (isFarmTechnician(farm, user)) return House.find({ farm_id: farm._id, 'technicians.user_id': user._id }).distinct('_id')
  if (!hasFarmAccess(farm, user)) throw ForbiddenError('Không có quyền trên farm này')
  return House.find({ farm_id: farm._id }).distinct('_id')
}

export async function listActiveHouseTechnicianIds(houseId: unknown): Promise<string[]> {
  const house = await House.findById(houseId).select('farm_id technicians')
  if (!house || (house.technicians ?? []).length === 0) return []
  const farm = await Farm.findById(house.farm_id).select('members')
  return farm ? activeHouseTechnicianIds(house, farm) : []
}

export async function listActiveHouseIds() {
  const farmIds = await Farm.find({ is_deleted: false }).distinct('_id')
  return House.find({ farm_id: { $in: farmIds } }).distinct('_id')
}

// Nguồn chung cho màn Admin để số Farm, Zone, thiết bị khớp nhau
export async function listActiveZoneIds() {
  const farmIds = await Farm.find({ is_deleted: false }).distinct('_id')
  return Zone.find({ farm_id: { $in: farmIds } }).distinct('_id')
}
