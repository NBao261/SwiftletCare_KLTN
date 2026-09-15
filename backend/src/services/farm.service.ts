import { Farm, IFarm } from '@/models/farm.model'
import { House, Zone, IZone, IHouse } from '@/models/houseZone.model'
import { User } from '@/models/user.model'
import { SalesAssignment } from '@/models/salesAssignment.model'
import { hasFarmAccess, isPrimaryOwner } from '@/utils/farmAccess.util'
import { NotFoundError, ForbiddenError, ConflictError } from '@/utils/appError.util'
import type { Thresholds, CurrentUser } from '@/types'

async function findFarmOrThrow(farmId: string): Promise<IFarm> {
  const farm = await Farm.findById(farmId)
  if (!farm) throw NotFoundError('Không tìm thấy farm')
  return farm
}

async function findZoneChainOrThrow(zoneId: string): Promise<{ zone: IZone; house: IHouse; farm: IFarm }> {
  const zone = await Zone.findById(zoneId)
  if (!zone) throw NotFoundError('Không tìm thấy zone')
  const house = await House.findById(zone.house_id)
  if (!house) throw NotFoundError('Không tìm thấy house của zone')
  const farm = await Farm.findById(house.farm_id)
  if (!farm) throw NotFoundError('Không tìm thấy farm của zone')
  return { zone, house, farm }
}

/**
 * FARM-FR-001. Technician thấy các Farm thuộc `assigned_regions` của mình để còn
 * chọn Farm→House→Zone khi onboarding thiết bị (Flow 1 bước 2), không phải mọi Farm.
 */
export async function listFarms(user: CurrentUser): Promise<IFarm[]> {
  let filter: object = { $or: [{ owner_id: user._id }, { 'members.user_id': user._id }] }
  if (user.role === 'ADMIN') filter = {}
  else if (user.role === 'TECHNICIAN') filter = { region: { $in: user.assigned_regions ?? [] } }

  return Farm.find(filter).sort({ created_at: -1 })
}

/** FARM-FR-001 — người tạo trở thành Primary Owner */
export async function createFarm(
  user: CurrentUser,
  input: { name: string; address: string; region?: string; coordinates?: { lat: number; lng: number } },
): Promise<IFarm> {
  return Farm.create({
    name: input.name,
    address: input.address,
    region: input.region,
    coordinates: input.coordinates,
    owner_id: user._id,
    members: [{ user_id: user._id, is_primary: true }],
  })
}

export async function getFarm(farmId: string, user: CurrentUser): Promise<IFarm> {
  const farm = await findFarmOrThrow(farmId)
  if (!hasFarmAccess(farm, user)) throw ForbiddenError('Không có quyền truy cập farm này')
  return farm
}

export async function updateFarm(
  farmId: string,
  user: CurrentUser,
  updates: Partial<{ name: string; address: string; region: string; coordinates: { lat: number; lng: number } }>,
): Promise<IFarm> {
  const farm = await findFarmOrThrow(farmId)
  if (!hasFarmAccess(farm, user)) throw ForbiddenError('Không có quyền sửa farm này')

  if (updates.name !== undefined) farm.name = updates.name
  if (updates.address !== undefined) farm.address = updates.address
  if (updates.region !== undefined) farm.region = updates.region
  if (updates.coordinates !== undefined) farm.coordinates = updates.coordinates
  await farm.save()
  return farm
}

/** FARM-FR-001 — xóa mềm, chỉ Primary Owner */
export async function removeFarm(farmId: string, user: CurrentUser): Promise<void> {
  const farm = await findFarmOrThrow(farmId)
  if (!isPrimaryOwner(farm, user)) throw ForbiddenError('Chỉ Primary Owner mới được xóa farm')
  farm.is_deleted = true
  await farm.save()
}

/** AUTH-FR-005 */
export async function inviteMember(farmId: string, user: CurrentUser, email: string): Promise<IFarm> {
  const farm = await findFarmOrThrow(farmId)
  if (!isPrimaryOwner(farm, user)) throw ForbiddenError('Chỉ Primary Owner mới được mời thành viên')

  const invitee = await User.findOne({ email })
  if (!invitee) {
    // MVP: chỉ hỗ trợ mời người đã có tài khoản; pending-invite cho người
    // chưa đăng ký để Giai đoạn 2.
    throw NotFoundError('Email chưa có tài khoản — yêu cầu họ đăng ký trước')
  }
  if (farm.members.some(m => String(m.user_id) === String(invitee._id))) {
    throw ConflictError('Người dùng đã là thành viên farm này')
  }

  farm.members.push({ user_id: invitee._id, is_primary: false, joined_at: new Date() } as never)
  await farm.save()
  return farm
}

/** FARM-FR-002 */
export async function createHouse(
  farmId: string,
  user: CurrentUser,
  input: { name: string; floors?: number; description?: string },
) {
  const farm = await findFarmOrThrow(farmId)
  if (!hasFarmAccess(farm, user)) throw ForbiddenError('Không có quyền trên farm này')
  return House.create({ farm_id: farm._id, ...input })
}

export async function listHouses(farmId: string, user: CurrentUser) {
  const farm = await findFarmOrThrow(farmId)
  if (!hasFarmAccess(farm, user)) throw ForbiddenError('Không có quyền trên farm này')
  return House.find({ farm_id: farm._id }).sort({ created_at: -1 })
}

/** FARM-FR-002 */
export async function createZone(houseId: string, user: CurrentUser, input: { name: string; floor?: number }) {
  const house = await House.findById(houseId)
  if (!house) throw NotFoundError('Không tìm thấy house')
  const farm = await findFarmOrThrow(String(house.farm_id))
  if (!hasFarmAccess(farm, user)) throw ForbiddenError('Không có quyền trên house này')
  return Zone.create({ house_id: house._id, ...input })
}

export async function listZones(houseId: string, user: CurrentUser) {
  const house = await House.findById(houseId)
  if (!house) throw NotFoundError('Không tìm thấy house')
  const farm = await findFarmOrThrow(String(house.farm_id))
  if (!hasFarmAccess(farm, user)) throw ForbiddenError('Không có quyền trên house này')
  return Zone.find({ house_id: house._id }).sort({ created_at: -1 })
}

/** ENV-FR-006, ENV-FR-009 (lưu lịch sử thay đổi) */
export async function updateZoneThresholds(zoneId: string, user: CurrentUser, updates: Partial<Thresholds>): Promise<IZone> {
  const { zone, farm } = await findZoneChainOrThrow(zoneId)
  if (!hasFarmAccess(farm, user)) throw ForbiddenError('Không có quyền trên zone này')

  const oldValues = { ...zone.thresholds }
  zone.thresholds = { ...zone.thresholds, ...updates }
  zone.threshold_history.push({
    changed_by: user._id as never,
    changed_at: new Date(),
    old_values: oldValues,
    new_values: updates,
  } as never)
  await zone.save()

  // TODO: publish MQTT config/update tới ESP32 của zone này khi cần áp dụng realtime
  return zone
}

/** AUTH-FR-005b */
export async function inviteSalesStaff(farmId: string, user: CurrentUser, email: string) {
  const farm = await findFarmOrThrow(farmId)
  if (!isPrimaryOwner(farm, user)) throw ForbiddenError('Chỉ Primary Owner mới được mời Sales Staff')

  const staff = await User.findOne({ email })
  if (!staff) throw NotFoundError('Email chưa có tài khoản Sales Staff')

  return SalesAssignment.findOneAndUpdate(
    { farm_id: farm._id, sales_staff_id: staff._id },
    { $setOnInsert: { invited_by: user._id } },
    { upsert: true, new: true },
  )
}

export async function listSalesStaff(farmId: string, user: CurrentUser) {
  const farm = await findFarmOrThrow(farmId)
  if (!hasFarmAccess(farm, user)) throw ForbiddenError('Không có quyền trên farm này')
  return SalesAssignment.find({ farm_id: farm._id }).populate('sales_staff_id', 'full_name email')
}

// Dùng lại ở deviceService (đăng ký thiết bị cần kiểm tra quyền trên zone)
export { findZoneChainOrThrow, findFarmOrThrow }
