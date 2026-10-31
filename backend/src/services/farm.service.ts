import crypto from 'crypto'
import { Farm, IFarm, IFarmMember } from '@/models/farm.model'
import { House, Zone, IHouse, IZone, type FuzzyTuningSource } from '@/models/houseZone.model'
import { CoefficientProposal } from '@/models/coefficientProposal.model'
import { User, IUser } from '@/models/user.model'
import { Invitation, IInvitation } from '@/models/invitation.model'
import { Alert } from '@/models/alert.model'
import { OPEN_STATUSES } from '@/services/alert.service'
import {
  hasFarmAccess, hasDeviceAccess, isPrimaryOwner, findFarmOrThrow, findZoneChainOrThrow,
  assertZoneAccess, assertHouseAccess, assertExpertDecision,
} from '@/utils/farmAccess.util'
import { logAction } from '@/services/auditLog.service'
import { formatChanges, notifyExpertDecision } from '@/services/expertActivity.service'
import { trackParameterChange } from '@/services/parameterReview.service'
import { getDefaultThresholds } from '@/services/system.service'
import { assertValidThresholds, pickThresholds } from '@/utils/thresholds.util'
import { applyThresholdUpdate, THRESHOLD_HISTORY_LIMIT } from '@/utils/thresholdUpdate.util'
import {
  assertValidBirdCountTuning, assertValidDetectionTuning, firmwareDetectionConfig, pickBirdCountTuning,
  pickDetectionTuning, resolveBirdCountTuning, resolveDetectionTuning,
  DEFAULT_HEALTH_LEVELS, assertValidHealthLevels, pickHealthLevels, resolveHealthLevels,
} from '@/utils/detectionTuning.util'
import { assertValidFuzzyTuning, pickFuzzyTuning } from '@/utils/fuzzyTuning.util'
import { publishCommand } from '@/mqtt/mqtt.client'
import { NotFoundError, ForbiddenError, ConflictError, BadRequestError } from '@/utils/appError.util'
import type { Thresholds, CurrentUser, FarmMemberRole, FuzzyTuning } from '@/types'

/** AUTH-FR-010 — lời mời hết hạn sau 7 ngày nếu không phản hồi */
const INVITATION_TTL_MS = 7 * 86400_000

/**
 * FARM-FR-001, FARM-FR-009 — Technician thấy mọi farm (chỉ cấu trúc, để chọn House→Zone khi
 * setup thiết bị); Administrator không thấy farm nào (Report 3 §2.4).
 */
export async function listFarms(user: CurrentUser): Promise<Array<IFarm | FarmDetail>> {
  if (user.role === 'ADMIN') return []
  const filter = user.role === 'TECHNICIAN' ? {} : { $or: [{ owner_id: user._id }, { 'members.user_id': user._id }] }

  const farms = await Farm.find(filter).sort({ created_at: -1 })
  return user.role === 'FARM_OWNER' ? farms : farms.map(farm => onlyOwnMembership(farm, user))
}

/**
 * Domain Expert không quản lý thành viên (AUTH-FR-005) nên không cần — và không được
 * thấy — danh sách thành viên của farm; chỉ giữ bản ghi của chính mình. Technician không
 * là thành viên nên không thấy ai. Dùng chung cho danh sách và chi tiết farm để hai đường
 * không lệch nhau.
 */
function onlyOwnMembership(farm: IFarm, user: CurrentUser): FarmDetail {
  const plain = farm.toObject() as unknown as FarmDetail
  plain.members = plain.members.filter(m => String(m.user_id) === user._id)
  return plain
}

export interface Coordinates { lat: number; lng: number }

export interface CreateFarmInput {
  name: string; address: string; coordinates: Coordinates
}

/** Chỉ lấy 2 số lat/lng — route đã kiểm khoảng; không gán nguyên object client gửi */
const pickCoordinates = (c: Coordinates): Coordinates => ({ lat: Number(c.lat), lng: Number(c.lng) })

/**
 * FARM-FR-001 — chỉ Farm Owner tạo farm và thành Primary Owner (Report 3 §2.4: Admin không quản lý farm).
 * Một farm là một địa điểm, tọa độ bắt buộc (A-5) để có thời tiết của đúng nơi đó.
 */
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
  if (!hasDeviceAccess(farm, user)) throw ForbiddenError('Không có quyền truy cập farm này')

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

/** FARM-FR-001 — xóa mềm, chỉ Primary Owner */
export async function removeFarm(farmId: string, user: CurrentUser): Promise<void> {
  const farm = await findFarmOrThrow(farmId)
  if (!isPrimaryOwner(farm, user)) throw ForbiddenError('Chỉ Primary Owner mới được xóa farm')
  await softDeleteFarm(farm)
}

/**
 * Xoá mềm 1 farm và dọn những thứ còn treo theo nó — dùng chung cho chủ farm tự xoá
 * và cascade khi Admin xoá tài khoản chủ (AUTH-FR-012).
 */
export async function softDeleteFarm(farm: IFarm): Promise<void> {
  farm.is_deleted = true
  await farm.save()
  // Cảnh báo còn mở của farm đã xoá sẽ bị alertEscalation gửi lại cho một farm
  // không ai mở được nữa — đóng hết.
  await Alert.updateMany(
    { farm_id: farm._id, status: { $in: OPEN_STATUSES } },
    { status: 'RESOLVED', resolved_at: new Date(), acknowledgement_note: 'Farm đã bị xoá' },
  )
  // Lời mời còn chờ: nếu để nguyên, người được mời vẫn tạo được tài khoản từ link
  // (createAccountFromInvitation) cho một farm không ai mở được nữa
  await Invitation.updateMany({ farm_id: farm._id, status: 'PENDING' }, { $set: { status: 'EXPIRED' } })
}

export interface InviteMemberInput {
  email: string
  /** FARM_OWNER = đồng sở hữu (mặc định); DOMAIN_EXPERT = chuyên gia nuôi yến, phạm vi cả farm */
  role?: FarmMemberRole
}

/**
 * AUTH-FR-005/AUTH-FR-010, Flow 12 bước 1-2 — tạo Invitation thay vì thêm thẳng
 * vào farm.members. Không đòi email đã có tài khoản: chưa có thì người được mời
 * tạo tài khoản ngay từ link (createAccountFromInvitation, AUTH-FR-010) — không có
 * đăng ký công khai (Report 3 §1.2).
 * Mời đồng sở hữu (FARM_OWNER) hoặc Domain Expert (v2.0.0) — cả hai đều theo cả farm.
 */
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

  // Tài khoản đã có mang 1 role cố định (1 email = 1 role): không mời Technician/Admin,
  // cũng không mời chéo Farm Owner ↔ Domain Expert — báo ngay thay vì để lời mời chờ vô ích.
  if (existingMember && existingMember.role !== role) {
    throw ConflictError(`Email này đã là tài khoản ${existingMember.role} — ${role === 'DOMAIN_EXPERT' ? 'Domain Expert' : 'Farm Owner'} cần dùng email khác`)
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
  return invitation
}

/**
 * Flow 12 bước 3a/3b — chấp nhận lời mời. Idempotent theo trạng thái: gọi lại
 * trên invitation đã ACCEPTED/DECLINED/EXPIRED thì báo lỗi rõ ràng thay vì âm
 * thầm thành công, để UI không hiểu nhầm.
 */
export async function acceptInvitation(token: string, user: CurrentUser): Promise<IFarm> {
  const invitation = await findPendingInvitationOrThrow(token)
  if (invitation.invited_email !== user.email?.toLowerCase()) {
    throw ForbiddenError('Lời mời này gửi cho email khác, không phải tài khoản đang đăng nhập')
  }
  // 1 email = 1 role: tài khoản Farm Owner không nhận lời mời Domain Expert (và ngược lại),
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
      user_id: user._id, is_primary: false, role: invitation.invited_role, joined_at: new Date(),
    } as never)
    await farm.save()
  }
  return farm
}

/** Lời mời còn dùng được: không có → 404; đã trả lời hoặc hết hạn → 409 (hết hạn thì ghi luôn EXPIRED) */
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

/**
 * AUTH-FR-010 — người được mời chưa có tài khoản tạo nó ngay từ link: e-mail và role lấy
 * từ lời mời, người nhận chỉ đặt tên và mật khẩu; tài khoản vào thẳng farm của lời mời.
 * Thay cho đăng ký công khai đã bỏ (Report 3 §1.2). Email đã có tài khoản thì 409 — người
 * đó đăng nhập rồi `acceptInvitation`, không được tạo tài khoản thứ hai.
 */
export async function createAccountFromInvitation(token: string, input: CreateAccountFromInvitationInput): Promise<IUser> {
  const invitation = await findPendingInvitationOrThrow(token)
  // Kiểm farm TRƯỚC khi ghi gì: farm bị xoá giữa chừng thì không tạo tài khoản mồ côi
  const farm = await findFarmOrThrow(String(invitation.farm_id))
  if (await User.exists({ email: invitation.invited_email })) {
    throw ConflictError('Email này đã có tài khoản — đăng nhập rồi chấp nhận lời mời')
  }

  let user: IUser
  try {
    user = await User.create({
      email: invitation.invited_email, // đã chuẩn hoá lúc mời
      password_hash: input.password,   // pre-save hook tự hash
      full_name: input.full_name.trim(),
      role: invitation.invited_role,
    })
  } catch (err) {
    // 2 request cùng link chạy song song: unique index email chặn bản thứ hai
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
  if (!hasDeviceAccess(farm, user)) throw ForbiddenError('Không có quyền trên farm này')
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
  if (!hasDeviceAccess(farm, user)) throw ForbiddenError('Không có quyền trên house này')
  return Zone.find({ house_id: house._id }).sort({ created_at: -1 })
}

/** ENV-FR-006, ENV-FR-009 (lưu lịch sử thay đổi) */
/** ENV-FR-006 — GET đơn 1 Zone, chủ yếu để FE lấy `thresholds` hiện tại trước khi mở form sửa. */
export async function getZone(zoneId: string, user: CurrentUser): Promise<IZone> {
  const { zone, farm } = await findZoneChainOrThrow(zoneId)
  // Technician cần Zone (và cấu hình gửi xuống thiết bị) khi setup và đẩy cấu hình (FARM-FR-009)
  if (!hasDeviceAccess(farm, user)) throw ForbiddenError('Không có quyền trên zone này')
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
 * ENV-FR-021 — chỉnh hệ số bộ điều khiển mờ của 1 Zone: validate khoảng, lưu kèm
 * lịch sử, publish config/update để mọi ESP32 trong Zone áp dụng ngay (không cần
 * nạp lại firmware). Cùng quyền với sửa ngưỡng (route).
 */
export async function updateZoneFuzzyTuning(zoneId: string, user: CurrentUser, updates: Record<string, unknown>): Promise<IZone> {
  const { zone, house, farm } = await assertZoneAccess(zoneId, user)

  const picked = pickFuzzyTuning(updates)
  if (Object.keys(picked).length === 0) throw BadRequestError('Không có hệ số nào để cập nhật')
  return applyFuzzyTuning({ zone, house, farm }, user, picked, 'MANUAL')
}

/**
 * Áp hệ số mờ cho 1 Zone kèm mọi tác dụng phụ — dùng chung cho sửa tay (ENV-FR-021), chuyên gia hoàn
 * lại (EXPERT-FR-010) và áp gợi ý đã duyệt (EXPERT-FR-011): gộp + kiểm khoảng, lưu lịch sử có nguồn,
 * gửi `config/update` xuống ESP32, ghi audit, báo Farm Owner khi chuyên gia đổi (EXPERT-FR-009), mở/đóng
 * mục duyệt; chuyên gia đổi hệ số thì đề xuất đang chờ của Zone thành SUPERSEDED. `notify: false` khi
 * người gọi tự báo kết quả (duyệt đề xuất báo PROPOSAL_APPROVED) để Farm Owner không nhận 2 thông báo.
 */
export async function applyFuzzyTuning(
  chain: { zone: IZone; house: IHouse; farm: IFarm },
  user: CurrentUser,
  picked: Partial<FuzzyTuning>,
  source: FuzzyTuningSource,
  opts: { notify?: boolean } = {},
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

  publishCommand(String(farm._id), String(house._id), String(zone._id), 'config/update', { ...zone.fuzzy_tuning })
  const auditId = await logAction(user._id, 'FUZZY_TUNING_UPDATED', 'zone', String(zone._id), {
    source, before: oldValues, after: merged, zone_id: String(zone._id), house_id: String(house._id),
  }, { farmId: String(farm._id) })
  // Đề xuất đang chờ không còn khớp hệ số Zone khi chuyên gia đã tự đổi (EXPERT-FR-011)
  if (user.role === 'DOMAIN_EXPERT') {
    await CoefficientProposal.updateMany({ zone_id: zone._id, status: 'PROPOSED' }, { status: 'SUPERSEDED' })
  }
  // Hoàn lại do chuyên gia: mục duyệt tự báo Farm Owner và tự đóng (expertReview.service)
  if (source === 'EXPERT_REVERT') return zone

  if (opts.notify !== false) await notifyExpertDecision(user, farm._id, auditId, {
    what: source === 'SUGGESTION_APPROVED' ? 'áp gợi ý hệ số điều khiển mờ' : 'chỉnh hệ số điều khiển mờ',
    place: `Khu vực "${zone.name}"`, detail: formatChanges(oldValues, merged),
  })
  await trackParameterChange(chain, user, 'fuzzy', oldValues, merged)
  return zone
}

/**
 * EXPERT-FR-008 — Domain Expert chỉnh tham số phát hiện của 1 Zone: kiểm tra khoảng,
 * lưu lịch sử (người sửa, role, thời điểm, cũ/mới), gửi 5 tham số xuống ESP32
 * qua config/update (firmware kẹp lại rồi lưu NVS). Mức giảm tỷ lệ chim về chỉnh theo House.
 */
export async function updateZoneDetectionTuning(zoneId: string, user: CurrentUser, updates: Record<string, unknown>): Promise<IZone> {
  const { zone, house, farm } = await assertZoneAccess(zoneId, user)
  // BR-22 — Farm Owner chỉ chỉnh thay khi farm chưa có chuyên gia
  assertExpertDecision(farm, user)

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

  publishCommand(String(farm._id), String(house._id), String(zone._id), 'config/update', firmwareDetectionConfig(merged))
  const auditId = await logAction(user._id, 'DETECTION_TUNING_UPDATED', 'zone', String(zone._id), {
    before: oldValues, after: merged, zone_id: String(zone._id), house_id: String(house._id),
  }, { farmId: String(farm._id) })
  await notifyExpertDecision(user, farm._id, auditId, {
    what: 'chỉnh tham số phát hiện', place: `Khu vực "${zone.name}"`, detail: formatChanges(oldValues, merged),
  })
  return zone
}

/**
 * EXPERT-FR-008 (SRS v2.1.8) — Domain Expert chỉnh tham số đếm chim của 1 nhà yến: chim ra vào ở cửa
 * của cả nhà nên mức giảm tỷ lệ chim về (cảnh báo LOW_RETURN_RATE) đặt theo House, không theo Zone.
 * Cùng cách làm với tham số Zone: kiểm tra khoảng, lưu lịch sử, ghi audit. Backend dùng, không gửi thiết bị.
 */
/** ANALYTICS-FR-012, BR-28 — mức chỉ số sức khỏe của nhà (bản ghi cũ thiếu trường nào thì dùng mặc định) */
export async function getHouseHealthLevels(houseId: string, user: CurrentUser) {
  const { house } = await assertHouseAccess(houseId, user)
  return { house_id: String(house._id), health_levels: resolveHealthLevels(house.health_levels), defaults: DEFAULT_HEALTH_LEVELS }
}

/** ANALYTICS-FR-012 — Domain Expert đặt mức trong khoảng BR-28; Farm Owner chỉ khi farm chưa có chuyên gia (BR-22) */
export async function updateHouseHealthLevels(houseId: string, user: CurrentUser, updates: Record<string, unknown>) {
  const { house, farm } = await assertHouseAccess(houseId, user)
  assertExpertDecision(farm, user)

  const picked = pickHealthLevels(updates)
  if (Object.keys(picked).length === 0) throw BadRequestError('Không có mức nào để cập nhật')
  const oldValues = resolveHealthLevels(house.health_levels)
  const merged = { ...oldValues, ...picked }
  assertValidHealthLevels(merged)

  house.health_levels = merged
  await house.save()

  const auditId = await logAction(user._id, 'HEALTH_LEVELS_UPDATED', 'house', String(house._id), {
    before: oldValues, after: merged, house_id: String(house._id),
  }, { farmId: String(farm._id) })
  await notifyExpertDecision(user, farm._id, auditId, {
    what: 'chỉnh mức chỉ số sức khỏe', place: `Nhà "${house.name}"`, detail: formatChanges(oldValues, merged),
  })
  return { house_id: String(house._id), health_levels: merged, defaults: DEFAULT_HEALTH_LEVELS }
}

export async function updateHouseBirdCountTuning(houseId: string, user: CurrentUser, updates: Record<string, unknown>): Promise<IHouse> {
  const { house, farm } = await assertHouseAccess(houseId, user)
  // BR-22 — Farm Owner chỉ chỉnh thay khi farm chưa có chuyên gia
  assertExpertDecision(farm, user)

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
    before: oldValues, after: merged, house_id: String(house._id),
  }, { farmId: String(farm._id) })
  await notifyExpertDecision(user, farm._id, auditId, {
    what: 'chỉnh mức giảm tỷ lệ chim về', place: `Nhà "${house.name}"`, detail: formatChanges(oldValues, merged),
  })
  return house
}
