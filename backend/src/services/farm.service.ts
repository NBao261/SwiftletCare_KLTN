import crypto from 'crypto'
import { Types } from 'mongoose'
import { Farm, IFarm, IFarmMember } from '@/models/farm.model'
import { House, Zone, IHouse, IZone, type FuzzyTuningSource } from '@/models/houseZone.model'
import { CoefficientProposal } from '@/models/coefficientProposal.model'
import { User, IUser } from '@/models/user.model'
import { Invitation, IInvitation } from '@/models/invitation.model'
import { Alert } from '@/models/alert.model'
import { SensorNode, CameraNode, IN_SERVICE } from '@/models/device.model'
import { MaintenancePlan } from '@/models/maintenancePlan.model'
import { Recommendation } from '@/models/recommendation.model'
import { OPEN_STATUSES, resolveHouseAlerts } from '@/services/alert.service'
import {
  hasFarmAccess, hasDeviceAccess, isPrimaryOwner, isFarmTechnician, canAccessHouse, listAssignedHouseIds,
  findFarmOrThrow, findZoneChainOrThrow, findHouseChainOrThrow, assertZoneAccess, assertHouseAccess,
  farmHasActiveExpert,
} from '@/utils/farmAccess.util'
import { logAction } from '@/services/auditLog.service'
import { invitationMail, sendMail } from '@/services/mail.service'
import { cancelWorkOrdersOfPlace, releaseTechnicianWorkOrders } from '@/services/workOrder.service'
import { assertValidRoster, type RosterShift } from '@/utils/roster.util'
import { DEFAULT_HOUSE_STAGE } from '@/utils/houseStage.util'
import { paginate } from '@/utils/helpers.util'
import { formatChanges, notifyExpertDecision } from '@/services/expertActivity.service'
import { trackParameterChange, type ReviewApplyOptions } from '@/services/parameterReview.service'
import { getDefaultThresholds } from '@/services/system.service'
import { assertValidThresholds, pickThresholds } from '@/utils/thresholds.util'
import { applyThresholdUpdate, THRESHOLD_HISTORY_LIMIT } from '@/utils/thresholdUpdate.util'
import {
  assertOnlyKeys, assertValidBirdCountTuning, assertValidDetectionTuning, pickBirdCountTuning,
  pickDetectionTuning, resolveBirdCountTuning, resolveDetectionTuning,
  BIRD_COUNT_TUNING_KEYS, DEFAULT_BIRD_COUNT_TUNING, DEFAULT_DETECTION_TUNING, DETECTION_TUNING_KEYS,
  DEFAULT_HEALTH_LEVELS, assertValidHealthLevels, pickHealthLevels, resolveHealthLevels,
} from '@/utils/detectionTuning.util'
import { assertValidFuzzyTuning, pickFuzzyTuning } from '@/utils/fuzzyTuning.util'
import { publishZoneConfig } from '@/services/deviceConfig.service'
import { AppError, NotFoundError, ForbiddenError, ConflictError, BadRequestError } from '@/utils/appError.util'
import type { Thresholds, CurrentUser, FarmMemberRole, FuzzyTuning, HouseStage } from '@/types'

/** AUTH-FR-010 */
const INVITATION_TTL_MS = 7 * 86400_000

/** Report 3 §4.5; khớp app mobile và web */
export const MAX_NAME_LENGTH = 50
export const MAX_HOUSE_FLOORS = 10

/** Bỏ qua hoa thường, phân biệt dấu. Không unique index vì dữ liệu cũ có thể trùng; 2 request đồng thời vẫn lọt */
async function assertUniqueName(
  model: typeof House | typeof Zone, scope: Record<string, unknown>, name: string, what: string,
): Promise<void> {
  const taken = await (model as typeof House).exists({ ...scope, name: name.trim() })
    .collation({ locale: 'vi', strength: 2 })
  if (taken) throw new AppError(409, 'DUPLICATE_NAME', `${what} "${name.trim()}" đã có, hãy đặt tên khác`)
}

/** Farm Technician thấy farm mình là thành viên; Admin không thấy farm nào */
export async function listFarms(user: CurrentUser): Promise<Array<FarmDetail & { has_active_expert: boolean }>> {
  if (user.role === 'ADMIN') return []
  const filter = { $or: [{ owner_id: user._id }, { 'members.user_id': user._id }] }

  const farms = await Farm.find(filter).sort({ created_at: -1 })
  // BR-22: cùng cách tính với assertExpertDecision
  return Promise.all(farms.map(async farm => ({
    ...(user.role === 'FARM_OWNER' ? (farm.toObject() as unknown as FarmDetail) : onlyOwnMembership(farm, user)),
    has_active_expert: await farmHasActiveExpert(farm),
  })))
}

/** Domain Expert, Farm Technician không được thấy danh sách thành viên */
function onlyOwnMembership(farm: IFarm, user: CurrentUser): FarmDetail {
  const plain = farm.toObject() as unknown as FarmDetail
  plain.members = plain.members.filter(m => String(m.user_id) === user._id)
  return plain
}

export interface Coordinates { lat: number; lng: number }

export interface CreateFarmInput {
  name: string; address: string; coordinates: Coordinates
}

/** Không gán nguyên object client gửi */
const pickCoordinates = (c: Coordinates): Coordinates => ({ lat: Number(c.lat), lng: Number(c.lng) })

/** A-5: tọa độ bắt buộc để có thời tiết đúng nơi */
export async function createFarm(user: CurrentUser, input: CreateFarmInput): Promise<IFarm> {
  const ownerId = user._id
  return Farm.create({
    name: input.name,
    address: input.address,
    coordinates: pickCoordinates(input.coordinates),
    owner_id: ownerId,
    members: [{ user_id: ownerId, is_primary: true }],
  })
}

/** Query thêm Users thay vì populate: populate làm sai so sánh String(owner_id) của hasFarmAccess */
export interface FarmMemberDetail extends IFarmMember { full_name?: string; email?: string }
export interface FarmDetail extends Omit<IFarm, 'members'> {
  members: FarmMemberDetail[]
  owner?: { full_name?: string; email?: string }
}

export async function getFarm(farmId: string, user: CurrentUser): Promise<FarmDetail> {
  const farm = await findFarmOrThrow(farmId)
  // Để tới các nhà được giao
  if (!hasFarmAccess(farm, user) && !isFarmTechnician(farm, user)) throw ForbiddenError('Không có quyền truy cập farm này')

  if (user.role !== 'FARM_OWNER') return onlyOwnMembership(farm, user)

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
  updates: Partial<{ name: string; address: string; coordinates: Coordinates }>,
): Promise<IFarm> {
  const farm = await findFarmOrThrow(farmId)
  if (!hasFarmAccess(farm, user)) throw ForbiddenError('Không có quyền sửa farm này')

  if (updates.name !== undefined) farm.name = updates.name
  if (updates.address !== undefined) farm.address = updates.address
  if (updates.coordinates !== undefined) farm.coordinates = pickCoordinates(updates.coordinates)
  await farm.save()
  return farm
}

export async function removeFarm(farmId: string, user: CurrentUser): Promise<void> {
  const farm = await findFarmOrThrow(farmId)
  if (!isPrimaryOwner(farm, user)) throw ForbiddenError('Chỉ Primary Owner mới được xóa farm')
  await softDeleteFarm(farm)
}

/** Dùng chung cho chủ farm tự xoá và cascade khi Admin xoá tài khoản chủ */
export async function softDeleteFarm(farm: IFarm): Promise<void> {
  farm.is_deleted = true
  await farm.save()
  // Để lại thì job gửi lại cho farm không ai mở được
  await Alert.updateMany(
    { farm_id: farm._id, status: { $in: OPEN_STATUSES } },
    { status: 'RESOLVED', resolved_at: new Date(), acknowledgement_note: 'Trang trại đã bị xoá' },
  )
  // Để lại thì vẫn tạo được tài khoản từ link cho farm đã xoá
  await Invitation.updateMany({ farm_id: farm._id, status: 'PENDING' }, { $set: { status: 'EXPIRED' } })
}

export interface InviteMemberInput {
  email: string
  role?: FarmMemberRole
}

const MEMBER_ROLE_LABEL: Record<FarmMemberRole, string> = {
  FARM_OWNER: 'Farm Owner',
  DOMAIN_EXPERT: 'Domain Expert',
  FARM_TECHNICIAN: 'Farm Technician',
}

/** Email chưa có tài khoản thì tạo từ link (createAccountFromInvitation). Thợ chưa làm gì được tới khi gán nhà */
export async function inviteMember(farmId: string, user: CurrentUser, input: InviteMemberInput): Promise<IInvitation> {
  const farm = await findFarmOrThrow(farmId)
  if (!isPrimaryOwner(farm, user)) throw ForbiddenError('Chỉ Primary Owner mới được mời thành viên')

  const role: FarmMemberRole = input.role ?? 'FARM_OWNER'
  const email = input.email

  const normalizedEmail = email.toLowerCase().trim()
  const existingMember = await User.findOne({ email: normalizedEmail })
  if (existingMember && farm.members.some(m => String(m.user_id) === String(existingMember._id))) {
    throw ConflictError('Người dùng đã là thành viên farm này')
  }

  // 1 email = 1 role: báo ngay thay vì để lời mời chờ vô ích
  if (existingMember && existingMember.role !== role) {
    throw ConflictError(`Email này đã là tài khoản ${existingMember.role} — ${MEMBER_ROLE_LABEL[role]} cần dùng email khác`)
  }

  const pending = await Invitation.findOne({ farm_id: farm._id, invited_email: normalizedEmail, status: 'PENDING' })
  if (pending) throw ConflictError('Đã có lời mời đang chờ phản hồi gửi tới email này')

  const invitation = await Invitation.create({
    farm_id: farm._id,
    invited_email: normalizedEmail,
    invited_role: role,
    invited_by: user._id,
    token: crypto.randomBytes(24).toString('hex'),
    status: 'PENDING',
    expires_at: new Date(Date.now() + INVITATION_TTL_MS),
  })
  await logAction(user._id, 'FARM_MEMBER_INVITED', 'farm', String(farm._id), {
    email: normalizedEmail, role,
  })
  // Thư lỗi không làm hỏng lời mời
  await sendMail(invitationMail({
    to: normalizedEmail, farmName: farm.name, roleLabel: MEMBER_ROLE_LABEL[role],
    token: invitation.token, expiresAt: invitation.expires_at,
  }))
  return invitation
}

/** Gọi lại trên lời mời đã trả lời thì báo lỗi, không âm thầm thành công */
export async function acceptInvitation(token: string, user: CurrentUser): Promise<IFarm> {
  const invitation = await findPendingInvitationOrThrow(token)
  if (invitation.invited_email !== user.email?.toLowerCase()) {
    throw ForbiddenError('Lời mời này gửi cho email khác, không phải tài khoản đang đăng nhập')
  }
  // 1 email = 1 role
  if (user.role !== invitation.invited_role) {
    throw ConflictError(`Lời mời dành cho ${invitation.invited_role} nhưng tài khoản này là ${user.role} — hãy dùng email khác`)
  }

  invitation.status = 'ACCEPTED'
  invitation.responded_at = new Date()
  await invitation.save()

  const farm = await findFarmOrThrow(String(invitation.farm_id))
  if (!farm.members.some(m => String(m.user_id) === user._id)) {
    farm.members.push({
      user_id: user._id, is_primary: false, role: invitation.invited_role, joined_at: new Date(),
    } as never)
    await farm.save()
  }
  return farm
}

/** Không có → 404; đã trả lời hoặc hết hạn → 409 */
async function findPendingInvitationOrThrow(token: string): Promise<IInvitation> {
  const invitation = await Invitation.findOne({ token })
  if (!invitation) throw NotFoundError('Lời mời không tồn tại')
  if (invitation.status !== 'PENDING') throw ConflictError(`Lời mời này đã ${STATUS_LABEL[invitation.status]}`)
  if (invitation.expires_at < new Date()) {
    invitation.status = 'EXPIRED'
    await invitation.save()
    throw ConflictError('Lời mời đã hết hạn (quá 7 ngày) — yêu cầu Farm Owner mời lại')
  }
  return invitation
}

export interface CreateAccountFromInvitationInput { full_name: string; password: string }

/** E-mail và role lấy từ lời mời. Email đã có tài khoản thì 409, phải đăng nhập rồi accept */
export async function createAccountFromInvitation(token: string, input: CreateAccountFromInvitationInput): Promise<IUser> {
  const invitation = await findPendingInvitationOrThrow(token)
  // Kiểm farm trước khi ghi: không tạo tài khoản mồ côi
  const farm = await findFarmOrThrow(String(invitation.farm_id))
  if (await User.exists({ email: invitation.invited_email })) {
    throw ConflictError('Email này đã có tài khoản — đăng nhập rồi chấp nhận lời mời')
  }

  let user: IUser
  try {
    user = await User.create({
      email: invitation.invited_email, // Đã chuẩn hoá lúc mời
      password_hash: input.password,   // pre-save hook tự hash
      full_name: input.full_name.trim(),
      role: invitation.invited_role,
    })
  } catch (err) {
    // 2 request cùng link: unique index email chặn bản thứ hai
    if ((err as { code?: number }).code === 11000) throw ConflictError('Email này đã có tài khoản — đăng nhập rồi chấp nhận lời mời')
    throw err
  }

  farm.members.push({ user_id: user._id, is_primary: false, role: invitation.invited_role, joined_at: new Date() } as never)
  await farm.save()
  invitation.status = 'ACCEPTED'
  invitation.responded_at = new Date()
  await invitation.save()

  await logAction(String(user._id), 'ACCOUNT_CREATED_FROM_INVITATION', 'user', String(user._id), {
    farm_id: String(farm._id), role: invitation.invited_role,
  })
  return user
}

const STATUS_LABEL: Record<IInvitation['status'], string> = {
  PENDING:  'đang chờ',
  ACCEPTED: 'được chấp nhận',
  DECLINED: 'bị từ chối',
  EXPIRED:  'hết hạn',
}

export async function declineInvitation(token: string): Promise<void> {
  const invitation = await Invitation.findOne({ token })
  if (!invitation) throw NotFoundError('Lời mời không tồn tại')
  if (invitation.status !== 'PENDING') throw ConflictError(`Lời mời này đã ${STATUS_LABEL[invitation.status]}`)

  invitation.status = 'DECLINED'
  invitation.responded_at = new Date()
  await invitation.save()
}

export async function getInvitationByToken(token: string) {
  const invitation = await Invitation.findOne({ token })
  if (!invitation) throw NotFoundError('Lời mời không tồn tại')
  const farm = await Farm.findById(invitation.farm_id).select('name address').lean()
  const userExists = !!(await User.findOne({ email: invitation.invited_email }).select('_id').lean())
  return { invitation, farm, userExists }
}

/** Primary Owner không tự gỡ chính mình: farm luôn phải còn 1 Primary Owner */
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
  await House.updateMany({ farm_id: farm._id }, { $pull: { technicians: { user_id: targetUserId }, roster: { technician_id: targetUserId } } })
  // Work Order đang mở của thợ chuyển cho Farm Owner
  const released = await releaseTechnicianWorkOrders(targetUserId, { farmId: farm._id }, user._id)
  await logAction(user._id, 'FARM_MEMBER_REMOVED', 'farm', String(farm._id), { user_id: targetUserId, work_orders_released: released || undefined })
  return farm
}

/** Mỗi nhà tối đa 1 thợ chính: gán primary thì thợ chính cũ thành thợ phụ */
export async function assignTechnician(houseId: string, user: CurrentUser, technicianId: string, primary = false): Promise<IHouse> {
  const { house, farm } = await findHouseChainOrThrow(houseId)
  if (!hasFarmAccess(farm, user)) throw ForbiddenError('Không có quyền trên house này')
  const member = farm.members.find(m => String(m.user_id) === technicianId && m.role === 'FARM_TECHNICIAN')
  if (!member) throw ConflictError('Người này không phải Farm Technician của farm')

  const others = (house.technicians ?? [])
    .filter(t => String(t.user_id) !== technicianId)
    .map(t => ({ user_id: t.user_id, primary: primary ? false : t.primary }))
  house.technicians = [...others, { user_id: member.user_id, primary }]
  await house.save()
  await logAction(user._id, 'HOUSE_TECHNICIAN_ASSIGNED', 'house', String(house._id), {
    user_id: technicianId, primary,
  }, { farmId: String(farm._id) })
  return house
}

/** Idempotent */
export async function unassignTechnician(houseId: string, user: CurrentUser, technicianId: string): Promise<IHouse> {
  const { house, farm } = await findHouseChainOrThrow(houseId)
  if (!hasFarmAccess(farm, user)) throw ForbiddenError('Không có quyền trên house này')
  const before = (house.technicians ?? []).length
  house.technicians = (house.technicians ?? []).filter(t => String(t.user_id) !== technicianId)
  if (house.technicians.length !== before) {
    house.roster = (house.roster ?? []).filter(s => String(s.technician_id) !== technicianId)
    await house.save()
    const released = await releaseTechnicianWorkOrders(technicianId, { houseId: house._id }, user._id)
    await logAction(user._id, 'HOUSE_TECHNICIAN_UNASSIGNED', 'house', String(house._id), {
      user_id: technicianId, work_orders_released: released || undefined,
    }, { farmId: String(farm._id) })
  }
  return house
}

const presentRoster = (house: IHouse, shifts: IHouse['roster']) => ({
  house_id: String(house._id),
  roster: shifts.map(s => ({ technician_id: String(s.technician_id), role: s.role, weekdays: [...s.weekdays], start: s.start, end: s.end })),
})

/** Người trong ca phải là thợ được giao (409); giờ và chồng ca kiểm ở roster.util (400) */
export async function setRoster(houseId: string, user: CurrentUser, shifts: RosterShift[]) {
  const { house, farm } = await findHouseChainOrThrow(houseId)
  if (!hasFarmAccess(farm, user)) throw ForbiddenError('Không có quyền trên house này')
  const assigned = new Set((house.technicians ?? []).map(t => String(t.user_id)))
  const stranger = shifts.find(s => !assigned.has(s.technician_id))
  if (stranger) throw ConflictError('Người trong ca không phải Farm Technician đang được giao nhà này')
  assertValidRoster(shifts)

  house.roster = shifts.map(s => ({ ...s, weekdays: [...s.weekdays].sort((a, b) => a - b) })) as never
  await house.save()
  await logAction(user._id, 'HOUSE_ROSTER_UPDATED', 'house', String(house._id), {
    shifts: shifts.length,
  }, { farmId: String(farm._id) })
  return presentRoster(house, house.roster)
}

/** Thợ chỉ thấy ca của mình */
export async function getRoster(houseId: string, user: CurrentUser) {
  const { house } = await assertHouseAccess(houseId, user)
  const roster = house.roster ?? []
  const shifts = user.role === 'FARM_TECHNICIAN' ? roster.filter(s => String(s.technician_id) === user._id) : roster
  return presentRoster(house, shifts)
}

export type InvitationStatus = IInvitation['status']

/** PENDING quá hạn coi là EXPIRED dù job chưa đổi. Không trả token */
export async function listInvitations(
  farmId: string, user: CurrentUser, query: { status?: InvitationStatus; page?: number | string; limit?: number | string } = {},
) {
  const status = query.status ?? 'PENDING'
  const farm = await findFarmOrThrow(farmId)
  if (!isPrimaryOwner(farm, user)) throw ForbiddenError('Chỉ Primary Owner mới xem được lời mời')

  const now = new Date()
  const filter: Record<string, unknown> = { farm_id: farm._id }
  if (status === 'PENDING') Object.assign(filter, { status: 'PENDING', expires_at: { $gt: now } })
  else if (status === 'EXPIRED') filter.$or = [{ status: 'EXPIRED' }, { status: 'PENDING', expires_at: { $lte: now } }]
  else filter.status = status

  const { page, skip, limit } = paginate(query.page, query.limit)
  const [rows, total] = await Promise.all([
    Invitation.find(filter).select('-token').sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    Invitation.countDocuments(filter),
  ])
  const records = rows.map(invitation => (
    invitation.status === 'PENDING' && invitation.expires_at <= now ? { ...invitation, status: 'EXPIRED' as const } : invitation
  ))
  return { records, total, page, limit }
}

export async function expireStaleInvitations(): Promise<number> {
  const result = await Invitation.updateMany(
    { status: 'PENDING', expires_at: { $lt: new Date() } },
    { $set: { status: 'EXPIRED' } },
  )
  return result.modifiedCount
}

export async function createHouse(
  farmId: string,
  user: CurrentUser,
  input: { name: string; floors?: number; description?: string },
) {
  const farm = await findFarmOrThrow(farmId)
  if (!hasFarmAccess(farm, user)) throw ForbiddenError('Không có quyền trên farm này')
  await assertUniqueName(House, { farm_id: farm._id }, input.name, 'Nhà yến')
  // Body thô có thể mang farm_id của farm khác
  return House.create({ farm_id: farm._id, name: input.name, floors: input.floors, description: input.description })
}

export type HouseListItem = Omit<IHouse, 'roster'> & { roster?: IHouse['roster'] }

/** Lịch trực chỉ Farm Owner nhận, thợ chỉ ca của mình */
function presentHouse(house: IHouse, user: CurrentUser): HouseListItem {
  if (user.role === 'FARM_OWNER') return house
  const plain = house.toObject() as unknown as HouseListItem
  if (user.role === 'FARM_TECHNICIAN') plain.roster = (plain.roster ?? []).filter(s => String(s.technician_id) === user._id)
  else delete plain.roster
  return plain
}

export async function listHouses(farmId: string, user: CurrentUser): Promise<HouseListItem[]> {
  const farm = await findFarmOrThrow(farmId)
  if (isFarmTechnician(farm, user)) {
    const assigned = await House.find({ farm_id: farm._id, _id: { $in: await listAssignedHouseIds(user) } }).sort({ created_at: -1 })
    return assigned.map(house => presentHouse(house, user))
  }
  if (!hasDeviceAccess(farm, user)) throw ForbiddenError('Không có quyền trên farm này')
  const houses = await House.find({ farm_id: farm._id }).sort({ created_at: -1 })
  return houses.map(house => presentHouse(house, user))
}

export async function createZone(houseId: string, user: CurrentUser, input: { name: string; floor?: number }) {
  const house = await House.findById(houseId)
  if (!house) throw NotFoundError('Không tìm thấy house')
  const farm = await findFarmOrThrow(String(house.farm_id))
  if (!hasFarmAccess(farm, user)) throw ForbiddenError('Không có quyền trên house này')
  // Không vượt số tầng của House
  const houseFloors = house.floors ?? 1
  if ((input.floor ?? 1) > houseFloors) {
    throw BadRequestError(`Tầng ${input.floor} vượt số tầng của nhà (${houseFloors} tầng)`)
  }
  await assertUniqueName(Zone, { house_id: house._id }, input.name, 'Zone')
  // Ngưỡng mặc định của Admin (ENV-FR-007), không dùng default cứng trong schema
  return Zone.create({
    house_id: house._id,
    farm_id: house.farm_id,
    name: input.name,
    floor: input.floor,
    thresholds: await getDefaultThresholds(),
  })
}

export async function listZones(houseId: string, user: CurrentUser) {
  const house = await House.findById(houseId)
  if (!house) throw NotFoundError('Không tìm thấy house')
  const farm = await findFarmOrThrow(String(house.farm_id))
  if (!canAccessHouse(farm, house, user, 'device')) throw ForbiddenError('Không có quyền trên house này')
  return Zone.find({ house_id: house._id }).sort({ created_at: -1 })
}

async function findOwnedHouse(houseId: string, user: CurrentUser): Promise<{ house: IHouse; farm: IFarm }> {
  const house = await House.findById(houseId)
  if (!house) throw NotFoundError('Không tìm thấy nhà yến')
  const farm = await findFarmOrThrow(String(house.farm_id))
  if (!hasFarmAccess(farm, user)) throw ForbiddenError('Không có quyền trên nhà yến này')
  return { house, farm }
}

/** Số tầng không thấp hơn tầng cao nhất của các Zone (Q-03) */
export async function updateHouse(
  houseId: string, user: CurrentUser, input: { name?: string; floors?: number; description?: string },
): Promise<IHouse> {
  const { house, farm } = await findOwnedHouse(houseId, user)
  const before = { name: house.name, floors: house.floors, description: house.description }
  if (input.name !== undefined && input.name.trim() !== house.name) {
    await assertUniqueName(House, { farm_id: farm._id, _id: { $ne: house._id } }, input.name, 'Nhà yến')
    house.name = input.name.trim()
  }
  if (input.floors !== undefined) {
    const highest = await Zone.findOne({ house_id: house._id }).sort({ floor: -1 }).select('floor').lean()
    if (highest && input.floors < (highest.floor ?? 1)) {
      throw BadRequestError(`Nhà còn khu vực ở tầng ${highest.floor}, số tầng không thể ít hơn`)
    }
    house.floors = input.floors
  }
  if (input.description !== undefined) house.description = input.description.trim() || undefined
  const after = { name: house.name, floors: house.floors, description: house.description }
  if (JSON.stringify(after) === JSON.stringify(before)) return house
  await house.save()
  await logAction(user._id, 'HOUSE_UPDATED', 'house', String(house._id), { before, after }, { farmId: String(farm._id) })
  return house
}

export async function updateZone(zoneId: string, user: CurrentUser, input: { name?: string; floor?: number }): Promise<IZone> {
  const zone = await Zone.findById(zoneId)
  if (!zone) throw NotFoundError('Không tìm thấy Zone')
  const { house, farm } = await findOwnedHouse(String(zone.house_id), user)
  const before = { name: zone.name, floor: zone.floor }
  if (input.name !== undefined && input.name.trim() !== zone.name) {
    await assertUniqueName(Zone, { house_id: house._id, _id: { $ne: zone._id } }, input.name, 'Zone')
    zone.name = input.name.trim()
  }
  if (input.floor !== undefined) {
    if (input.floor > (house.floors ?? 1)) throw BadRequestError(`Tầng ${input.floor} vượt số tầng của nhà (${house.floors ?? 1} tầng)`)
    zone.floor = input.floor
  }
  const after = { name: zone.name, floor: zone.floor }
  if (JSON.stringify(after) === JSON.stringify(before)) return zone
  await zone.save()
  await logAction(user._id, 'ZONE_UPDATED', 'zone', String(zone._id), { before, after }, { farmId: String(farm._id) })
  return zone
}

/** Q-01: còn thiết bị chưa gỡ thì không xoá */
async function assertNoDeviceInService(where: { zoneIds: Types.ObjectId[]; houseId?: Types.ObjectId }): Promise<void> {
  const controllers = await SensorNode.countDocuments({ zone_id: { $in: where.zoneIds }, ...IN_SERVICE })
  const cameras = where.houseId ? await CameraNode.countDocuments({ house_id: where.houseId, ...IN_SERVICE }) : 0
  if (controllers + cameras > 0) {
    throw new AppError(409, 'HAS_ACTIVE_DEVICES', `Còn ${controllers + cameras} thiết bị đang dùng, hãy gỡ thiết bị trước khi xoá`)
  }
}

/** Dọn trước khi đánh dấu xoá: lỗi giữa chừng thì gọi lại an toàn */
async function closeOpenWorkOf(
  user: CurrentUser, place: { houseId?: Types.ObjectId; zoneIds: Types.ObjectId[] }, reason: string,
): Promise<{ alerts: number; work_orders: number }> {
  let workOrders = 0
  if (place.houseId) workOrders += await cancelWorkOrdersOfPlace({ house_id: place.houseId }, user, reason)
  else for (const zoneId of place.zoneIds) workOrders += await cancelWorkOrdersOfPlace({ zone_id: zoneId }, user, reason)
  const where = place.houseId ? { $or: [{ house_id: place.houseId }, { zone_id: { $in: place.zoneIds } }] } : { zone_id: { $in: place.zoneIds } }
  const { modifiedCount: alerts } = await Alert.updateMany(
    { ...where, status: { $in: OPEN_STATUSES } },
    { status: 'RESOLVED', resolved_at: new Date(), acknowledgement_note: reason },
  )
  await CoefficientProposal.updateMany({ zone_id: { $in: place.zoneIds }, status: 'PROPOSED' }, { $set: { status: 'SUPERSEDED' } })
  return { alerts, work_orders: workOrders }
}

function softDeleteFields(user: CurrentUser) {
  return { is_deleted: true, deleted_at: new Date(), deleted_by: new Types.ObjectId(user._id) }
}

/** Q-01: telemetry, lượt đếm, báo cáo, thu hoạch giữ nguyên */
export async function deleteHouse(houseId: string, user: CurrentUser): Promise<void> {
  const { house, farm } = await findOwnedHouse(houseId, user)
  const zoneIds = await Zone.find({ house_id: house._id }).distinct('_id') as Types.ObjectId[]
  await assertNoDeviceInService({ zoneIds, houseId: house._id })

  // Còn chạy thì job bảo trì tạo cảnh báo cho nhà đã xoá
  await MaintenancePlan.updateMany({ house_id: house._id, state: { $ne: 'RETIRED' } }, { $set: { state: 'RETIRED' } })
  // Mốc chờ BR-42
  await Recommendation.updateMany({ house_id: house._id, status: 'OPEN' }, { $set: { status: 'EXPIRED', expired_at: new Date() } })
  const closed = await closeOpenWorkOf(user, { houseId: house._id, zoneIds }, 'Nhà yến đã bị xoá')
  await Zone.updateMany({ _id: { $in: zoneIds } }, { $set: softDeleteFields(user) })
  Object.assign(house, softDeleteFields(user))
  await house.save()
  await logAction(user._id, 'HOUSE_DELETED', 'house', String(house._id), {
    name: house.name, zones: zoneIds.length, ...closed,
  }, { farmId: String(farm._id) })
}

export async function deleteZone(zoneId: string, user: CurrentUser): Promise<void> {
  const zone = await Zone.findById(zoneId)
  if (!zone) throw NotFoundError('Không tìm thấy Zone')
  const { farm } = await findOwnedHouse(String(zone.house_id), user)
  await assertNoDeviceInService({ zoneIds: [zone._id] })
  const closed = await closeOpenWorkOf(user, { zoneIds: [zone._id] }, 'Zone đã bị xoá')
  await Zone.updateOne({ _id: zone._id }, { $set: softDeleteFields(user) })
  await logAction(user._id, 'ZONE_DELETED', 'zone', String(zone._id), { name: zone.name, ...closed }, { farmId: String(farm._id) })
}

export async function getZone(zoneId: string, user: CurrentUser): Promise<IZone> {
  const { zone, house, farm } = await findZoneChainOrThrow(zoneId)
  // Administrator xem ở mọi farm (FARM-FR-009)
  if (!canAccessHouse(farm, house, user, 'device')) throw ForbiddenError('Không có quyền trên zone này')
  return zone
}

export async function updateZoneThresholds(zoneId: string, user: CurrentUser, updates: Partial<Thresholds>): Promise<IZone> {
  const chain = await assertZoneAccess(zoneId, user)

  // null/chuỗi rỗng thành NaN để assert từ chối
  const picked = pickThresholds(updates as Record<string, unknown>)
  const merged = { ...chain.zone.thresholds, ...picked }
  assertValidThresholds(merged)

  return applyThresholdUpdate(chain, user, { thresholds: merged, historyValues: picked, source: 'MANUAL' })
}

export async function resetZoneThresholds(zoneId: string, user: CurrentUser): Promise<IZone> {
  const chain = await assertZoneAccess(zoneId, user)
  const defaults = await getDefaultThresholds()

  return applyThresholdUpdate(chain, user, { thresholds: { ...defaults }, historyValues: defaults, source: 'RESET_TO_DEFAULT' })
}

export async function updateZoneFuzzyTuning(zoneId: string, user: CurrentUser, updates: Record<string, unknown>): Promise<IZone> {
  const { zone, house, farm } = await assertZoneAccess(zoneId, user)

  const picked = pickFuzzyTuning(updates)
  if (Object.keys(picked).length === 0) throw BadRequestError('Không có hệ số nào để cập nhật')
  return applyFuzzyTuning({ zone, house, farm }, user, picked, 'MANUAL')
}

/** Dùng chung cho sửa tay, chuyên gia hoàn lại, áp gợi ý. notify: false khi người gọi tự báo, tránh 2 thông báo */
export async function applyFuzzyTuning(
  chain: { zone: IZone; house: IHouse; farm: IFarm },
  user: CurrentUser,
  picked: Partial<FuzzyTuning>,
  source: FuzzyTuningSource,
  opts: { notify?: boolean; logDetails?: Record<string, unknown> } = {},
): Promise<IZone> {
  const { zone, house, farm } = chain
  const oldValues = { ...zone.fuzzy_tuning }
  const merged = { ...oldValues, ...picked }
  assertValidFuzzyTuning(merged)

  zone.fuzzy_tuning = merged
  zone.fuzzy_tuning_history.push({
    changed_by: user._id as never, changed_by_role: user.role, changed_at: new Date(), old_values: oldValues, new_values: picked, source,
  } as never)
  const overflow = zone.fuzzy_tuning_history.length - THRESHOLD_HISTORY_LIMIT
  if (overflow > 0) zone.fuzzy_tuning_history.splice(0, overflow)
  await zone.save()

  await publishZoneConfig(zone._id)
  const auditId = await logAction(user._id, 'FUZZY_TUNING_UPDATED', 'zone', String(zone._id), {
    source, before: oldValues, after: merged, zone_id: String(zone._id), house_id: String(house._id),
    ...opts.logDetails,
  }, { farmId: String(farm._id) })
  // Đề xuất đang chờ không còn khớp: duyệt nó sẽ ghi đè lần sửa vừa làm
  await CoefficientProposal.updateMany({ zone_id: zone._id, status: 'PROPOSED' }, { status: 'SUPERSEDED' })
  // Mục duyệt tự báo Farm Owner và tự đóng
  if (source === 'EXPERT_REVERT') return zone

  if (opts.notify !== false) await notifyExpertDecision(user, farm._id, auditId, {
    what: source === 'SUGGESTION_APPROVED' ? 'áp gợi ý hệ số điều khiển mờ' : 'chỉnh hệ số điều khiển mờ',
    place: `Zone "${zone.name}"`, detail: formatChanges(oldValues, merged),
  })
  await trackParameterChange(chain, user, 'fuzzy', oldValues, merged)
  return zone
}

const reviewLogDetails = (opts: ReviewApplyOptions) => (opts.fromReview ? { decided_in: 'parameter_review' } : {})

/** Firmware kẹp lại rồi lưu NVS */
export async function updateZoneDetectionTuning(
  zoneId: string, user: CurrentUser, updates: Record<string, unknown>, what = 'chỉnh tham số phát hiện', opts: ReviewApplyOptions = {},
): Promise<IZone> {
  const { zone, house, farm } = await assertZoneAccess(zoneId, user)

  assertOnlyKeys(DETECTION_TUNING_KEYS, updates, keys => (keys.includes('return_rate_drop_pct')
    ? ' — mức giảm tỷ lệ chim về chỉnh theo nhà: PUT /farms/houses/:houseId/bird-count-tuning' : ''))
  const picked = pickDetectionTuning(updates)
  if (Object.keys(picked).length === 0) throw BadRequestError('Không có tham số nào để cập nhật')
  const oldValues = resolveDetectionTuning(zone.detection_tuning)
  const merged = { ...oldValues, ...picked }
  assertValidDetectionTuning(merged)

  zone.detection_tuning = merged
  zone.detection_tuning_history.push({
    changed_by: user._id as never, changed_by_role: user.role, changed_at: new Date(), old_values: oldValues, new_values: picked,
  } as never)
  const overflow = zone.detection_tuning_history.length - THRESHOLD_HISTORY_LIMIT
  if (overflow > 0) zone.detection_tuning_history.splice(0, overflow)
  await zone.save()

  await publishZoneConfig(zone._id)
  const auditId = await logAction(user._id, 'DETECTION_TUNING_UPDATED', 'zone', String(zone._id), {
    before: oldValues, after: merged, zone_id: String(zone._id), house_id: String(house._id), ...reviewLogDetails(opts),
  }, { farmId: String(farm._id) })
  await trackParameterChange({ farm, zone, house }, user, 'detection', oldValues, merged)
  if (!opts.fromReview) {
    await notifyExpertDecision(user, farm._id, auditId, {
      what, place: `Zone "${zone.name}"`, detail: formatChanges(oldValues, merged),
    })
  }
  return zone
}

export function resetZoneDetectionTuning(zoneId: string, user: CurrentUser): Promise<IZone> {
  return updateZoneDetectionTuning(zoneId, user, { ...DEFAULT_DETECTION_TUNING }, 'khôi phục mặc định tham số phát hiện')
}

/** Backend dùng, không gửi thiết bị */
/** can_edit dùng đúng luật của PUT để client khỏi tự đoán */
export async function getHouseHealthLevels(houseId: string, user: CurrentUser) {
  const { house } = await assertHouseAccess(houseId, user)
  // Route đã giới hạn vai trò
  const canEdit = user.role === 'FARM_OWNER' || user.role === 'DOMAIN_EXPERT'
  return {
    house_id: String(house._id), health_levels: resolveHealthLevels(house.health_levels), defaults: DEFAULT_HEALTH_LEVELS,
    can_edit: canEdit,
  }
}

export async function updateHouseHealthLevels(
  houseId: string, user: CurrentUser, updates: Record<string, unknown>, opts: ReviewApplyOptions = {},
) {
  const { house, farm } = await assertHouseAccess(houseId, user)

  const picked = pickHealthLevels(updates)
  if (Object.keys(picked).length === 0) throw BadRequestError('Không có mức nào để cập nhật')
  const oldValues = resolveHealthLevels(house.health_levels)
  const merged = { ...oldValues, ...picked }
  assertValidHealthLevels(merged)

  house.health_levels = merged
  await house.save()

  const auditId = await logAction(user._id, 'HEALTH_LEVELS_UPDATED', 'house', String(house._id), {
    before: oldValues, after: merged, house_id: String(house._id), ...reviewLogDetails(opts),
  }, { farmId: String(farm._id) })
  await trackParameterChange({ farm, house }, user, 'health_levels', oldValues, merged)
  if (!opts.fromReview) {
    await notifyExpertDecision(user, farm._id, auditId, {
      what: 'chỉnh mức chỉ số sức khoẻ', place: `Nhà "${house.name}"`, detail: formatChanges(oldValues, merged),
    })
  }
  // Cùng dạng với GET: client ghi thẳng vào cache
  return { house_id: String(house._id), health_levels: merged, defaults: DEFAULT_HEALTH_LEVELS, can_edit: true }
}

/** Về OCCUPIED thì cửa sổ BR-21 tính lại từ ngày kế tiếp. Đặt lại đúng giai đoạn thì không ghi gì */
export async function setHouseStage(houseId: string, user: CurrentUser, stage: HouseStage): Promise<HouseListItem> {
  const { house, farm } = await assertHouseAccess(houseId, user)
  if (!hasFarmAccess(farm, user)) throw ForbiddenError('Không có quyền đặt giai đoạn của nhà này')
  const before = house.stage ?? DEFAULT_HOUSE_STAGE
  if (before === stage) return presentHouse(house, user)

  house.stage = stage
  house.stage_history.push({ stage, changed_by: user._id as never, changed_by_role: user.role, changed_at: new Date() })
  await house.save()
  // BR-46
  if (stage === 'ATTRACTING') await resolveHouseAlerts(String(house._id), 'LOW_RETURN_RATE', 'Nhà chuyển sang giai đoạn dẫn dụ: không xét tỷ lệ chim về (BR-46)')
  const auditId = await logAction(user._id, 'HOUSE_STAGE_UPDATED', 'house', String(house._id), {
    before, after: stage,
  }, { farmId: String(farm._id) })
  await notifyExpertDecision(user, farm._id, auditId, {
    what: 'đổi giai đoạn nhà', place: `Nhà "${house.name}"`, detail: `${before} → ${stage}`,
  })
  return presentHouse(house, user)
}

export async function updateHouseBirdCountTuning(
  houseId: string, user: CurrentUser, updates: Record<string, unknown>, what = 'chỉnh mức giảm tỷ lệ chim về',
  opts: ReviewApplyOptions = {},
): Promise<HouseListItem> {
  const { house, farm } = await assertHouseAccess(houseId, user)

  assertOnlyKeys(BIRD_COUNT_TUNING_KEYS, updates, () => ' — tham số phát hiện của Zone: PUT /farms/zones/:zoneId/detection-tuning')
  const picked = pickBirdCountTuning(updates)
  if (Object.keys(picked).length === 0) throw BadRequestError('Không có tham số nào để cập nhật')
  const oldValues = resolveBirdCountTuning(house.bird_count_tuning)
  const merged = { ...oldValues, ...picked }
  assertValidBirdCountTuning(merged)

  house.bird_count_tuning = merged
  house.bird_count_tuning_history.push({
    changed_by: user._id as never, changed_by_role: user.role, changed_at: new Date(), old_values: oldValues, new_values: picked,
  } as never)
  const overflow = house.bird_count_tuning_history.length - THRESHOLD_HISTORY_LIMIT
  if (overflow > 0) house.bird_count_tuning_history.splice(0, overflow)
  await house.save()

  const auditId = await logAction(user._id, 'BIRD_COUNT_TUNING_UPDATED', 'house', String(house._id), {
    before: oldValues, after: merged, house_id: String(house._id), ...reviewLogDetails(opts),
  }, { farmId: String(farm._id) })
  await trackParameterChange({ farm, house }, user, 'return_rate_drop', oldValues, merged)
  if (!opts.fromReview) {
    await notifyExpertDecision(user, farm._id, auditId, {
      what, place: `Nhà "${house.name}"`, detail: formatChanges(oldValues, merged),
    })
  }
  return presentHouse(house, user)
}

export function resetHouseBirdCountTuning(houseId: string, user: CurrentUser): Promise<HouseListItem> {
  return updateHouseBirdCountTuning(houseId, user, { ...DEFAULT_BIRD_COUNT_TUNING }, 'khôi phục mặc định mức giảm tỷ lệ chim về')
}
