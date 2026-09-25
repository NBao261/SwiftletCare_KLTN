import crypto from 'crypto'
import { Farm, IFarm, IFarmMember } from '@/models/farm.model'
import { House, Zone, IZone } from '@/models/houseZone.model'
import { User } from '@/models/user.model'
import { Invitation, IInvitation } from '@/models/invitation.model'
import { Alert } from '@/models/alert.model'
import { OPEN_STATUSES } from '@/services/alert.service'
import {
  hasFarmAccess, hasZoneAccess, isPrimaryOwner, operatorZoneScope, findFarmOrThrow, findZoneChainOrThrow,
  assertZoneAccess, assertZoneInFarm,
} from '@/utils/farmAccess.util'
import { logAction } from '@/services/auditLog.service'
import { getDefaultThresholds } from '@/services/system.service'
import { assertValidThresholds, pickThresholds } from '@/utils/thresholds.util'
import { applyThresholdUpdate } from '@/utils/thresholdUpdate.util'
import { NotFoundError, ForbiddenError, ConflictError, BadRequestError } from '@/utils/appError.util'
import type { Thresholds, CurrentUser, FarmMemberRole } from '@/types'

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

  // Farm Operator không quản lý thành viên (AUTH-FR-005) nên không cần — và không
  // được thấy — danh sách thành viên kèm email; chỉ giữ bản ghi của chính mình.
  if (user.role === 'FARM_OPERATOR') {
    const plain = farm.toObject() as unknown as FarmDetail
    plain.members = plain.members.filter(m => String(m.user_id) === user._id)
    return plain
  }

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
  // region quyết định Technician nào phụ trách farm và ticket được giao cho ai —
  // cùng mức nhạy cảm với xoá farm/mời thành viên nên chỉ Primary Owner/Admin được đổi.
  if (updates.region !== undefined && updates.region !== farm.region && !isPrimaryOwner(farm, user)) {
    throw ForbiddenError('Chỉ Primary Owner mới được đổi khu vực của farm')
  }

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
  // Cảnh báo còn mở của farm đã xoá sẽ bị alertEscalation biến thành ticket mồ côi
  // (không ai mở được farm, không Technician nào được gán) — đóng hết.
  await Alert.updateMany(
    { farm_id: farm._id, status: { $in: OPEN_STATUSES } },
    { status: 'RESOLVED', resolved_at: new Date(), acknowledgement_note: 'Farm đã bị xoá' },
  )
}

export interface InviteMemberInput {
  email: string
  /** FARM_OWNER = đồng sở hữu; FARM_OPERATOR = nhân viên vận hành (mặc định FARM_OWNER như trước v1.23.0) */
  role?: FarmMemberRole
  /** Chỉ cho FARM_OPERATOR — rỗng/không gửi = cả farm */
  zone_ids?: string[]
}

/** Zone gán cho Operator phải thuộc đúng farm; trả danh sách đã bỏ trùng */
async function validateOperatorZones(farmId: string, zoneIds: string[] = []): Promise<string[]> {
  const unique = [...new Set(zoneIds.map(String))]
  for (const zoneId of unique) await assertZoneInFarm(zoneId, farmId)
  return unique
}

/**
 * AUTH-FR-005/AUTH-FR-010, Flow 12 bước 1-2 — tạo Invitation thay vì thêm thẳng
 * vào farm.members. Không còn đòi email đã có tài khoản (khác bản cũ): nếu
 * chưa có, người được mời sẽ đăng ký trước rồi tự động accept (Flow 12 bước 3b,
 * xử lý ở registerUser bên auth.service khi email trùng invitation PENDING).
 * Mời đồng sở hữu (FARM_OWNER) hoặc Farm Operator kèm phạm vi Zone (v1.23.0).
 */
export async function inviteMember(farmId: string, user: CurrentUser, input: InviteMemberInput): Promise<IInvitation> {
  const farm = await findFarmOrThrow(farmId)
  if (!isPrimaryOwner(farm, user)) throw ForbiddenError('Chỉ Primary Owner mới được mời thành viên')

  const role: FarmMemberRole = input.role ?? 'FARM_OWNER'
  if (role === 'FARM_OWNER' && input.zone_ids?.length) {
    throw BadRequestError('Chỉ Farm Operator mới giới hạn theo Zone — đồng sở hữu luôn có quyền trên cả farm')
  }
  const zoneIds = role === 'FARM_OPERATOR' ? await validateOperatorZones(String(farm._id), input.zone_ids) : []
  const email = input.email

  const normalizedEmail = email.toLowerCase().trim()
  const existingMember = await User.findOne({ email: normalizedEmail })
  if (existingMember && farm.members.some(m => String(m.user_id) === String(existingMember._id))) {
    throw ConflictError('Người dùng đã là thành viên farm này')
  }

  // Tài khoản đã có mang 1 role cố định (1 email = 1 role): không mời Technician/Admin,
  // cũng không mời chéo Farm Owner ↔ Farm Operator — báo ngay thay vì để lời mời chờ vô ích.
  if (existingMember && existingMember.role !== role) {
    throw ConflictError(`Email này đã là tài khoản ${existingMember.role} — Farm ${role === 'FARM_OPERATOR' ? 'Operator' : 'Owner'} cần dùng email khác`)
  }

  const pending = await Invitation.findOne({ farm_id: farm._id, invited_email: normalizedEmail, status: 'PENDING' })
  if (pending) throw ConflictError('Đã có lời mời đang chờ phản hồi gửi tới email này')

  const invitation = await Invitation.create({
    farm_id: farm._id,
    invited_email: normalizedEmail,
    invited_role: role,
    zone_ids: zoneIds,
    invited_by: user._id,
    token: crypto.randomBytes(24).toString('hex'),
    status: 'PENDING',
    expires_at: new Date(Date.now() + INVITATION_TTL_MS),
  })
  await logAction(user._id, 'FARM_MEMBER_INVITED', 'farm', String(farm._id), {
    email: normalizedEmail, role, zone_ids: zoneIds,
  })
  return invitation
}

/**
 * Flow 12 bước 3a/3b — chấp nhận lời mời. Idempotent theo trạng thái: gọi lại
 * trên invitation đã ACCEPTED/DECLINED/EXPIRED thì báo lỗi rõ ràng thay vì âm
 * thầm thành công, để UI không hiểu nhầm.
 */
export async function acceptInvitation(token: string, user: CurrentUser): Promise<IFarm> {
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
  // 1 email = 1 role: tài khoản Farm Owner không nhận lời mời Operator (và ngược lại),
  // Technician/Admin không thành thành viên farm qua lời mời
  if (user.role !== invitation.invited_role) {
    throw ConflictError(`Lời mời dành cho ${invitation.invited_role} nhưng tài khoản này là ${user.role} — hãy dùng email khác`)
  }

  invitation.status = 'ACCEPTED'
  invitation.responded_at = new Date()
  await invitation.save()

  const farm = await findFarmOrThrow(String(invitation.farm_id))
  if (!farm.members.some(m => String(m.user_id) === user._id)) {
    farm.members.push({
      user_id: user._id, is_primary: false, role: invitation.invited_role,
      zone_ids: invitation.zone_ids, joined_at: new Date(),
    } as never)
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
  await logAction(user._id, 'FARM_MEMBER_REMOVED', 'farm', String(farm._id), { user_id: targetUserId })
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
  const houses = await House.find({ farm_id: farm._id }).sort({ created_at: -1 })
  // Farm Operator giới hạn theo Zone chỉ thấy House có ít nhất 1 Zone trong phạm vi
  const scope = operatorZoneScope(farm, user)
  if (!scope) return houses
  const visibleHouseIds = new Set(
    (await Zone.find({ _id: { $in: [...scope] } }).select('house_id').lean()).map(z => String(z.house_id)),
  )
  return houses.filter(h => visibleHouseIds.has(String(h._id)))
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
  const zones = await Zone.find({ house_id: house._id }).sort({ created_at: -1 })
  const scope = operatorZoneScope(farm, user)
  return scope ? zones.filter(z => scope.has(String(z._id))) : zones
}

/** ENV-FR-006, ENV-FR-009 (lưu lịch sử thay đổi) */
/** ENV-FR-006 — GET đơn 1 Zone, chủ yếu để FE lấy `thresholds` hiện tại trước khi mở form sửa. */
export async function getZone(zoneId: string, user: CurrentUser): Promise<IZone> {
  const { zone, farm } = await findZoneChainOrThrow(zoneId)
  if (!hasZoneAccess(farm, zone._id, user)) throw ForbiddenError('Không có quyền trên zone này')
  return zone
}

/** ENV-FR-006, Flow 22 nhánh A — validate min<max trước khi ghi, publish config/update để ESP32 áp dụng ngay. */
export async function updateZoneThresholds(zoneId: string, user: CurrentUser, updates: Partial<Thresholds>): Promise<IZone> {
  const chain = await assertZoneAccess(zoneId, user)

  // pickThresholds: chỉ nhận 7 khoá ngưỡng và ép về số; null/chuỗi rỗng thành NaN để assert từ chối
  const picked = pickThresholds(updates as Record<string, unknown>)
  const merged = { ...chain.zone.thresholds, ...picked }
  assertValidThresholds(merged)

  return applyThresholdUpdate(chain, user, { thresholds: merged, historyValues: picked, source: 'MANUAL' })
}

/** ENV-FR-020, Flow 22 nhánh B — reset cả 7 ngưỡng về mặc định hệ thống do Admin cấu hình (SYSTEM-FR-002). */
export async function resetZoneThresholds(zoneId: string, user: CurrentUser): Promise<IZone> {
  const chain = await assertZoneAccess(zoneId, user)
  const defaults = await getDefaultThresholds()

  return applyThresholdUpdate(chain, user, { thresholds: { ...defaults }, historyValues: defaults, source: 'RESET_TO_DEFAULT' })
}

/**
 * AUTH-FR-005 (v1.23.0), Flow 12 bước 6 — Primary Owner đổi phạm vi Zone của 1
 * Farm Operator: rỗng = cả farm. Áp dụng ngay ở lần kiểm tra quyền tiếp theo
 * (assertZoneAccess đọc members mỗi request).
 */
export async function updateOperatorScope(farmId: string, user: CurrentUser, targetUserId: string, zoneIds: string[]): Promise<IFarm> {
  const farm = await findFarmOrThrow(farmId)
  if (!isPrimaryOwner(farm, user)) throw ForbiddenError('Chỉ Primary Owner mới được đổi phạm vi của Farm Operator')

  const member = farm.members.find(m => String(m.user_id) === targetUserId)
  if (!member) throw NotFoundError('Người dùng không phải thành viên farm này')
  if (member.role !== 'FARM_OPERATOR') throw BadRequestError('Chỉ Farm Operator mới giới hạn theo Zone')

  const before = member.zone_ids.map(String)
  const after = await validateOperatorZones(String(farm._id), zoneIds)
  member.zone_ids = after as never
  await farm.save()
  await logAction(user._id, 'FARM_OPERATOR_SCOPE_UPDATED', 'farm', String(farm._id), { user_id: targetUserId, before, after })
  return farm
}
