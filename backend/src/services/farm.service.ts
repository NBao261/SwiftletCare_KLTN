import crypto from 'crypto'
import { Farm, IFarm, IFarmMember } from '@/models/farm.model'
import { House, Zone, IZone } from '@/models/houseZone.model'
import { User } from '@/models/user.model'
import { SalesAssignment } from '@/models/salesAssignment.model'
import { SalesAssignmentRequest, ISalesAssignmentRequest } from '@/models/salesAssignmentRequest.model'
import { Invitation, IInvitation } from '@/models/invitation.model'
import { hasFarmAccess, isPrimaryOwner, findFarmOrThrow, findZoneChainOrThrow } from '@/utils/farmAccess.util'
import { publishCommand } from '@/mqtt/mqtt.client'
import { logAction } from '@/services/auditLog.service'
import { getDefaultThresholds } from '@/services/system.service'
import { assertValidThresholds } from '@/utils/thresholds.util'
import { NotFoundError, ForbiddenError, ConflictError, BadRequestError } from '@/utils/appError.util'
import type { Thresholds, CurrentUser } from '@/types'

/** AUTH-FR-010 — lời mời hết hạn sau 7 ngày nếu không phản hồi */
const INVITATION_TTL_MS = 7 * 86400_000

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

/**
 * FE cần tên/email từng thành viên để hiển thị màn "Quản lý thành viên" (không
 * chỉ user_id thô). Query thêm 1 lượt Users theo id thay vì đổi hẳn sang
 * `.populate()` để KHÔNG đụng `hasFarmAccess`/`isPrimaryOwner` — 2 hàm đó so
 * sánh `String(farm.owner_id)`/`String(m.user_id)` với ObjectId thô, populate
 * sẽ biến chúng thành object và làm sai so sánh ở mọi nơi khác dùng chung
 * `findFarmOrThrow`.
 */
export interface FarmMemberDetail extends IFarmMember { full_name?: string; email?: string }
export interface FarmDetail extends Omit<IFarm, 'members'> {
  members: FarmMemberDetail[]
  owner?: { full_name?: string; email?: string }
}

export async function getFarm(farmId: string, user: CurrentUser): Promise<FarmDetail> {
  const farm = await findFarmOrThrow(farmId)
  if (!hasFarmAccess(farm, user)) throw ForbiddenError('Không có quyền truy cập farm này')

  const memberIds = [farm.owner_id, ...farm.members.map(m => m.user_id)]
  const users = await User.find({ _id: { $in: memberIds } }).select('full_name email').lean()
  const userMap = new Map(users.map(u => [String(u._id), u]))

  const plain = farm.toObject() as unknown as FarmDetail
  plain.owner = {
    full_name: userMap.get(String(farm.owner_id))?.full_name,
    email:     userMap.get(String(farm.owner_id))?.email,
  }
  plain.members = plain.members.map(m => ({
    ...m,
    full_name: userMap.get(String(m.user_id))?.full_name,
    email:     userMap.get(String(m.user_id))?.email,
  }))
  return plain
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

/**
 * AUTH-FR-005/AUTH-FR-010, Flow 12 bước 1-2 — tạo Invitation thay vì thêm thẳng
 * vào farm.members. Không còn đòi email đã có tài khoản (khác bản cũ): nếu
 * chưa có, người được mời sẽ đăng ký trước rồi tự động accept (Flow 12 bước 3b,
 * xử lý ở registerUser bên auth.service khi email trùng invitation PENDING).
 */
export async function inviteMember(farmId: string, user: CurrentUser, email: string): Promise<IInvitation> {
  const farm = await findFarmOrThrow(farmId)
  if (!isPrimaryOwner(farm, user)) throw ForbiddenError('Chỉ Primary Owner mới được mời thành viên')

  const normalizedEmail = email.toLowerCase().trim()
  const existingMember = await User.findOne({ email: normalizedEmail })
  if (existingMember && farm.members.some(m => String(m.user_id) === String(existingMember._id))) {
    throw ConflictError('Người dùng đã là thành viên farm này')
  }

  const pending = await Invitation.findOne({ farm_id: farm._id, invited_email: normalizedEmail, status: 'PENDING' })
  if (pending) throw ConflictError('Đã có lời mời đang chờ phản hồi gửi tới email này')

  return Invitation.create({
    farm_id: farm._id,
    invited_email: normalizedEmail,
    invited_role: 'FARM_OWNER',
    invited_by: user._id,
    token: crypto.randomBytes(24).toString('hex'),
    status: 'PENDING',
    expires_at: new Date(Date.now() + INVITATION_TTL_MS),
  })
}

/**
 * Flow 12 bước 3a/3b — chấp nhận lời mời. Idempotent theo trạng thái: gọi lại
 * trên invitation đã ACCEPTED/DECLINED/EXPIRED thì báo lỗi rõ ràng thay vì âm
 * thầm thành công, để UI không hiểu nhầm.
 */
export async function acceptInvitation(token: string, user: CurrentUser): Promise<IFarm | { salesAssignment: true }> {
  const invitation = await Invitation.findOne({ token })
  if (!invitation) throw NotFoundError('Lời mời không tồn tại')
  if (invitation.status !== 'PENDING') throw ConflictError(`Lời mời này đã ${STATUS_LABEL[invitation.status]}`)
  if (invitation.expires_at < new Date()) {
    invitation.status = 'EXPIRED'
    await invitation.save()
    throw ConflictError('Lời mời đã hết hạn (quá 7 ngày) — yêu cầu Farm Owner mời lại')
  }
  if (invitation.invited_email !== user.email?.toLowerCase()) {
    throw ForbiddenError('Lời mời này gửi cho email khác, không phải tài khoản đang đăng nhập')
  }

  invitation.status = 'ACCEPTED'
  invitation.responded_at = new Date()
  await invitation.save()

  if (invitation.invited_role === 'SALES_STAFF') {
    await SalesAssignment.findOneAndUpdate(
      { farm_id: invitation.farm_id, sales_staff_id: user._id },
      { $setOnInsert: { invited_by: invitation.invited_by } },
      { upsert: true },
    )
    return { salesAssignment: true }
  }

  const farm = await findFarmOrThrow(String(invitation.farm_id))
  if (!farm.members.some(m => String(m.user_id) === user._id)) {
    farm.members.push({ user_id: user._id, is_primary: false, joined_at: new Date() } as never)
    await farm.save()
  }
  return farm
}

const STATUS_LABEL: Record<IInvitation['status'], string> = {
  PENDING:  'đang chờ',
  ACCEPTED: 'được chấp nhận',
  DECLINED: 'bị từ chối',
  EXPIRED:  'hết hạn',
}

/** Flow 12 case 3c — từ chối, không cần đăng nhập (link công khai theo token) */
export async function declineInvitation(token: string): Promise<void> {
  const invitation = await Invitation.findOne({ token })
  if (!invitation) throw NotFoundError('Lời mời không tồn tại')
  if (invitation.status !== 'PENDING') throw ConflictError(`Lời mời này đã ${STATUS_LABEL[invitation.status]}`)

  invitation.status = 'DECLINED'
  invitation.responded_at = new Date()
  await invitation.save()
}

/** Xem trước lời mời (không cần đăng nhập) — hiển thị tên farm trước khi bấm chấp nhận */
export async function getInvitationByToken(token: string) {
  const invitation = await Invitation.findOne({ token })
  if (!invitation) throw NotFoundError('Lời mời không tồn tại')
  const farm = await Farm.findById(invitation.farm_id).select('name address').lean()
  const userExists = !!(await User.findOne({ email: invitation.invited_email }).select('_id').lean())
  return { invitation, farm, userExists }
}

/**
 * Flow 12 bước 5 + case 5a — gỡ thành viên. Farm luôn phải còn ít nhất 1 Primary
 * Owner nên chặn cứng việc Primary Owner tự gỡ chính mình; muốn rời Farm thì
 * phải chuyển quyền Primary trước (ngoài phạm vi UI tự phục vụ Phase 1, xem SRS §4.1).
 */
export async function removeMember(farmId: string, user: CurrentUser, targetUserId: string): Promise<IFarm> {
  const farm = await findFarmOrThrow(farmId)
  if (!isPrimaryOwner(farm, user)) throw ForbiddenError('Chỉ Primary Owner mới được gỡ thành viên')

  if (String(farm.owner_id) === targetUserId) {
    throw BadRequestError('Không thể gỡ Primary Owner — Farm luôn phải có ít nhất 1 Primary Owner')
  }
  const memberIndex = farm.members.findIndex(m => String(m.user_id) === targetUserId)
  if (memberIndex === -1) throw NotFoundError('Người dùng không phải thành viên farm này')

  farm.members.splice(memberIndex, 1)
  await farm.save()
  return farm
}

/** Job nền: chuyển Invitation quá hạn sang EXPIRED (AUTH-FR-010, Flow 12 case 3d) */
export async function expireStaleInvitations(): Promise<number> {
  const result = await Invitation.updateMany(
    { status: 'PENDING', expires_at: { $lt: new Date() } },
    { $set: { status: 'EXPIRED' } },
  )
  return result.modifiedCount
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
  // Zone mới dùng ngưỡng mặc định hệ thống do Admin cấu hình (ENV-FR-007), cùng
  // nguồn với "Reset về mặc định" — không dùng default cứng trong schema.
  return Zone.create({
    house_id: house._id,
    name: input.name,
    floor: input.floor,
    thresholds: await getDefaultThresholds(),
  })
}

export async function listZones(houseId: string, user: CurrentUser) {
  const house = await House.findById(houseId)
  if (!house) throw NotFoundError('Không tìm thấy house')
  const farm = await findFarmOrThrow(String(house.farm_id))
  if (!hasFarmAccess(farm, user)) throw ForbiddenError('Không có quyền trên house này')
  return Zone.find({ house_id: house._id }).sort({ created_at: -1 })
}

/** ENV-FR-006, ENV-FR-009 (lưu lịch sử thay đổi) */
/** ENV-FR-006 — GET đơn 1 Zone, chủ yếu để FE lấy `thresholds` hiện tại trước khi mở form sửa. */
export async function getZone(zoneId: string, user: CurrentUser): Promise<IZone> {
  const { zone, farm } = await findZoneChainOrThrow(zoneId)
  if (!hasFarmAccess(farm, user)) throw ForbiddenError('Không có quyền trên zone này')
  return zone
}

/** ENV-FR-006, Flow 22 nhánh A — validate min<max trước khi ghi, publish config/update để ESP32 áp dụng ngay. */
export async function updateZoneThresholds(zoneId: string, user: CurrentUser, updates: Partial<Thresholds>): Promise<IZone> {
  const { zone, house, farm } = await findZoneChainOrThrow(zoneId)
  if (!hasFarmAccess(farm, user)) throw ForbiddenError('Không có quyền trên zone này')

  const merged = { ...zone.thresholds, ...updates }
  assertValidThresholds(merged)

  const oldValues = { ...zone.thresholds }
  zone.thresholds = merged
  zone.threshold_history.push({
    changed_by: user._id as never,
    changed_at: new Date(),
    old_values: oldValues,
    new_values: updates,
    source: 'MANUAL',
  } as never)
  await zone.save()

  publishCommand(String(farm._id), String(house._id), String(zone._id), 'config/update', zone.thresholds)
  await logAction(user._id, 'THRESHOLD_UPDATED', 'zone', String(zone._id), { source: 'MANUAL', before: oldValues, after: zone.thresholds })
  return zone
}

/** ENV-FR-020, Flow 22 nhánh B — reset cả 7 ngưỡng về mặc định hệ thống do Admin cấu hình (SYSTEM-FR-002). */
export async function resetZoneThresholds(zoneId: string, user: CurrentUser): Promise<IZone> {
  const { zone, house, farm } = await findZoneChainOrThrow(zoneId)
  if (!hasFarmAccess(farm, user)) throw ForbiddenError('Không có quyền trên zone này')

  const defaults = await getDefaultThresholds()
  const oldValues = { ...zone.thresholds }
  zone.thresholds = { ...defaults }
  zone.threshold_history.push({
    changed_by: user._id as never,
    changed_at: new Date(),
    old_values: oldValues,
    new_values: defaults,
    source: 'RESET_TO_DEFAULT',
  } as never)
  await zone.save()

  publishCommand(String(farm._id), String(house._id), String(zone._id), 'config/update', zone.thresholds)
  await logAction(user._id, 'THRESHOLD_UPDATED', 'zone', String(zone._id), { source: 'RESET_TO_DEFAULT', before: oldValues, after: zone.thresholds })
  return zone
}

/**
 * AUTH-FR-005b (đổi v1.16.0), Flow 16 bước 1b — Farm Owner chỉ ĐỀ XUẤT Sales
 * Staff, không tự kích hoạt: Sales Staff là nhân sự phía công ty nên phải qua
 * Admin duyệt (AUTH-FR-005d, admin.service#decideSalesStaffRequest).
 */
export async function requestSalesStaff(farmId: string, user: CurrentUser, email: string): Promise<ISalesAssignmentRequest> {
  const farm = await findFarmOrThrow(farmId)
  if (!isPrimaryOwner(farm, user)) throw ForbiddenError('Chỉ Primary Owner mới được đề xuất Sales Staff')

  const normalizedEmail = email.toLowerCase().trim()
  // `$ne: 'REMOVE'` thay vì `'ADD'`: request tạo trước khi có field `type` không mang giá trị nào
  const pending = await SalesAssignmentRequest.findOne({
    farm_id: farm._id, type: { $ne: 'REMOVE' }, sales_staff_email: normalizedEmail, status: 'PENDING',
  })
  if (pending) throw ConflictError('Đã có đề xuất đang chờ Admin duyệt cho email này')

  const existingUser = await User.findOne({ email: normalizedEmail }).select('role').lean()
  if (existingUser && existingUser.role !== 'SALES_STAFF') {
    throw ConflictError('Email này đang thuộc 1 tài khoản không phải Sales Staff')
  }
  if (existingUser && await SalesAssignment.exists({ farm_id: farm._id, sales_staff_id: existingUser._id })) {
    throw ConflictError('Sales Staff này đã được gán vào farm')
  }

  return SalesAssignmentRequest.create({
    farm_id: farm._id,
    requested_by: user._id,
    sales_staff_email: normalizedEmail,
  })
}

/**
 * Flow 16 bước 1e — Farm Owner muốn gỡ Sales Staff khỏi farm chỉ được YÊU CẦU
 * (đối xứng với việc gán); Admin duyệt ở /admin/sales-staff-requests thì mới xoá
 * SalesAssignment. Cùng bảng với đề xuất thêm nhưng `type: 'REMOVE'`.
 */
export async function requestSalesStaffRemoval(
  farmId: string, user: CurrentUser, salesStaffId: string,
): Promise<ISalesAssignmentRequest> {
  const farm = await findFarmOrThrow(farmId)
  if (!isPrimaryOwner(farm, user)) throw ForbiddenError('Chỉ Primary Owner mới được yêu cầu gỡ Sales Staff')

  const assignment = await SalesAssignment.exists({ farm_id: farm._id, sales_staff_id: salesStaffId })
  if (!assignment) throw NotFoundError('Sales Staff này không được gán vào farm')

  const salesStaff = await User.findById(salesStaffId).select('email').lean()
  if (!salesStaff) throw NotFoundError('Không tìm thấy Sales Staff')

  const pending = await SalesAssignmentRequest.findOne({
    farm_id: farm._id, type: 'REMOVE', sales_staff_id: salesStaff._id, status: 'PENDING',
  })
  if (pending) throw ConflictError('Đã có yêu cầu gỡ Sales Staff này đang chờ Admin xử lý')

  return SalesAssignmentRequest.create({
    farm_id: farm._id,
    type: 'REMOVE',
    requested_by: user._id,
    sales_staff_id: salesStaff._id,
    sales_staff_email: salesStaff.email,
  })
}

/** Flow 16 bước 1b/1d — Farm Owner xem kết quả duyệt (kèm lý do nếu bị từ chối) */
export async function listSalesStaffRequests(farmId: string, user: CurrentUser) {
  const farm = await findFarmOrThrow(farmId)
  if (!hasFarmAccess(farm, user)) throw ForbiddenError('Không có quyền trên farm này')
  return SalesAssignmentRequest.find({ farm_id: farm._id }).sort({ created_at: -1 }).lean()
}

export async function listSalesStaff(farmId: string, user: CurrentUser) {
  const farm = await findFarmOrThrow(farmId)
  if (!hasFarmAccess(farm, user)) throw ForbiddenError('Không có quyền trên farm này')
  return SalesAssignment.find({ farm_id: farm._id }).populate('sales_staff_id', 'full_name email')
}
