import crypto from 'crypto'
import { User, IUser } from '@/models/user.model'
import { AuditLog } from '@/models/auditLog.model'
import { Farm } from '@/models/farm.model'
import { Invitation } from '@/models/invitation.model'
import { logAction } from '@/services/auditLog.service'
import { softDeleteFarm } from '@/services/farm.service'
import { notifyAdmins, notifyUser } from '@/services/notification.service'
import { disconnectUser } from '@/socket'
import { escapeRegex, paginate } from '@/utils/helpers.util'
import { assertRegionCode, toRegionCode } from '@/utils/regions.util'
import { NotFoundError, ConflictError, BadRequestError } from '@/utils/appError.util'
import type { Role } from '@/types'

// ── Quản lý tài khoản — AUTH-FR-011, AUTH-FR-012, Flow 19 ──────────────────────

export interface ListQuery { page?: string | number; limit?: string | number }

export interface ListUsersQuery extends ListQuery {
  role?: Role
  /** inactive = đang bị khoá; deleted = đã xoá theo yêu cầu (cũng is_active=false nhưng không mở khoá được) */
  status?: 'active' | 'inactive' | 'deleted'
  /** Tìm theo tên, email hoặc SĐT (không phân biệt hoa/thường) */
  q?: string
  /** Technician phụ trách vùng này */
  region?: string
}

export async function listUsers(query: ListUsersQuery) {
  const filter: Record<string, unknown> = {}
  if (query.role) filter.role = query.role
  if (query.status === 'active') filter.is_active = true
  if (query.status === 'inactive') Object.assign(filter, { is_active: false, deleted_at: null })
  if (query.status === 'deleted') filter.deleted_at = { $ne: null }
  if (query.region) filter.assigned_regions = toRegionCode(query.region) ?? query.region
  const term = query.q?.trim()
  if (term) {
    const pattern = new RegExp(escapeRegex(term), 'i')
    filter.$or = [{ full_name: pattern }, { email: pattern }, { phone: pattern }]
  }

  const { page, skip, limit } = paginate(query.page, query.limit)

  const [records, total] = await Promise.all([
    User.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ])
  return { records, total, page, limit }
}


/**
 * AUTH-FR-011 — khoá/mở khoá tài khoản. Lý do bắt buộc khi khoá (không bắt buộc
 * khi mở khoá). Middleware `authenticate` đã tự chặn is_active=false ở request
 * kế tiếp, nên không cần thu hồi refresh_tokens riêng ở đây — vẫn xoá cho chắc,
 * để user không giữ được phiên nào nếu quay lại dùng refresh token cũ. Kết nối
 * Socket.io đang mở cũng bị ngắt ngay (JWT còn hạn không đủ để giữ realtime).
 */
export async function setUserStatus(
  adminId: string, userId: string, isActive: boolean, reason?: string,
): Promise<IUser> {
  // Không cho tự khoá mình: người gọi luôn là 1 Admin đang hoạt động, nên chặn
  // tự khoá là đủ đảm bảo hệ thống luôn còn ít nhất 1 Admin (Flow 19 case 2a).
  if (adminId === userId) throw BadRequestError('Không thể tự khoá tài khoản của chính mình')
  const trimmedReason = reason?.trim()
  if (!isActive && !trimmedReason) {
    throw BadRequestError('Phải nhập lý do khi khoá tài khoản')
  }

  const user = await User.findById(userId)
  if (!user) throw NotFoundError('Không tìm thấy người dùng')
  // Tài khoản đã xoá theo Nghị định 13 thì PII đã bị ẩn danh — mở khoá lại sẽ
  // tạo ra tài khoản "sống" nhưng rỗng thông tin.
  if (user.deleted_at) throw ConflictError('Tài khoản đã bị xoá theo yêu cầu, không thể khoá/mở khoá')

  user.is_active = isActive
  if (isActive) {
    user.deactivated_at = undefined
    user.deactivated_reason = undefined
  } else {
    user.deactivated_at = new Date()
    user.deactivated_reason = trimmedReason
    user.refresh_tokens = [] as never
  }
  await user.save()

  await logAction(adminId, isActive ? 'ACCOUNT_UNLOCKED' : 'ACCOUNT_LOCKED', 'user', userId, { reason: trimmedReason })
  if (!isActive) disconnectUser(userId)
  return user
}

export async function listDeletionRequests(query: ListQuery) {
  const { page, skip, limit } = paginate(query.page, query.limit)
  const filter = { deletion_requested_at: { $ne: null } }

  const [records, total] = await Promise.all([
    User.find(filter).sort({ deletion_requested_at: 1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ])
  return { records, total, page, limit }
}


/**
 * AUTH-FR-012 / PRIV-NFR-003 — Flow 19 bước 7-8. Cascade:
 * - Farm mà user là Primary Owner: còn thành viên khác → chuyển owner_id cho
 *   người có joined_at sớm nhất; hết thành viên → soft-delete Farm.
 * - Farm mà user chỉ là member thường: gỡ khỏi members.
 * - Anonymize thông tin cá nhân, không xoá document (giữ FK cho farms/audit lịch sử).
 *
 * Mongo dev chạy standalone (không transaction) nên hàm này được thiết kế để CHẠY
 * LẠI được khi lỗi giữa chừng: cờ `deletion_requested_at` chỉ bị gỡ ở bước lưu
 * cuối, mỗi farm xử lý xong đã có audit riêng, còn farm đã chuyển/xoá thì lần
 * chạy sau không tìm thấy nữa (không bị xử lý hai lần).
 */
export async function completeDeletionRequest(adminId: string, userId: string): Promise<IUser> {
  if (adminId === userId) throw BadRequestError('Không thể tự xử lý yêu cầu xoá tài khoản của chính mình')
  const user = await User.findById(userId)
  if (!user) throw NotFoundError('Không tìm thấy người dùng')
  if (!user.deletion_requested_at) {
    throw BadRequestError('Người dùng này chưa gửi yêu cầu xoá tài khoản')
  }

  const ownedFarms = await Farm.find({ owner_id: user._id, is_deleted: false })

  for (const farm of ownedFarms) {
    // Quyền chủ chỉ chuyển cho đồng sở hữu (AUTH-FR-012) — Domain Expert là người được mời
    // vận hành, không nhận quyền chủ; farm không còn đồng sở hữu thì bị xoá mềm.
    const otherMembers = farm.members.filter(m => String(m.user_id) !== userId && m.role !== 'DOMAIN_EXPERT')
    if (otherMembers.length > 0) {
      const nextOwner = otherMembers.reduce((earliest, m) =>
        m.joined_at < earliest.joined_at ? m : earliest)
      farm.owner_id = nextOwner.user_id
      farm.members.forEach(m => { m.is_primary = String(m.user_id) === String(nextOwner.user_id) })
      const selfIndex = farm.members.findIndex(m => String(m.user_id) === userId)
      if (selfIndex !== -1) farm.members.splice(selfIndex, 1)
      await farm.save()

      await logAction(adminId, 'FARM_OWNERSHIP_TRANSFERRED', 'farm', String(farm._id), {
        fromUserId: userId, toUserId: String(nextOwner.user_id),
      })
      await notifyUser(String(nextOwner.user_id), {
        title: 'Bạn trở thành chủ sở hữu farm',
        body: `Chủ farm "${farm.name}" đã xoá tài khoản, quyền chủ sở hữu đã được chuyển cho bạn.`,
      })
    } else {
      await softDeleteFarm(farm)

      await logAction(adminId, 'FARM_SOFT_DELETED', 'farm', String(farm._id), {
        reason: 'OWNER_ACCOUNT_DELETED', ownerId: userId,
      })
    }
  }

  // Member thường (không phải owner) ở các farm khác — gỡ khỏi members
  await Farm.updateMany(
    { owner_id: { $ne: user._id }, 'members.user_id': user._id },
    { $pull: { members: { user_id: user._id } } },
  )



  // Tổng qua MỌI lần chạy (kể cả lần lỗi giữa chừng trước đó), đọc từ audit từng farm — tính TRƯỚC bước
  // ẩn danh không thể đảo ngược để một lỗi đọc DB ở đây vẫn cho phép chạy lại. Đây là số liệu theo audit
  // (ghi audit là best-effort, xem logAction), không phải nguồn sự thật về dữ liệu farm.
  const [farmsTransferred, farmsDeleted] = await Promise.all([
    AuditLog.countDocuments({ action: 'FARM_OWNERSHIP_TRANSFERRED', 'metadata.fromUserId': userId }),
    AuditLog.countDocuments({ action: 'FARM_SOFT_DELETED', 'metadata.ownerId': userId }),
  ])

  const contactEmail = user.email // giữ lại để gửi thông báo cuối sau khi ẩn danh

  // Lời mời đang chờ do user này gửi không được chấp nhận được nữa sau khi người mời đã biến mất
  await Invitation.updateMany({ status: 'PENDING', invited_by: user._id }, { $set: { status: 'EXPIRED' } })

  user.email = `deleted-${String(user._id)}@swiftletcare.local`
  user.phone = undefined
  user.full_name = 'Tài khoản đã xoá'
  // Tài khoản đã ẩn danh không còn phụ trách vùng nào
  if (user.role === 'TECHNICIAN') user.assigned_regions = []
  user.avatar_url = undefined
  // Chat id Telegram là dữ liệu cá nhân và còn là đường gửi tin tới người thật (PRIV-NFR-003)
  user.telegram_chat_id = undefined
  user.telegram_link_code_hash = undefined
  user.telegram_link_expires_at = undefined
  user.is_active = false
  user.refresh_tokens = [] as never
  // Gỡ cờ yêu cầu để tài khoản rời khỏi hàng đợi /admin/delete-requests và
  // không bị xử lý (chạy lại cascade) lần 2
  user.deletion_requested_at = undefined
  user.deletion_reminder_sent_at = undefined
  user.deleted_at = new Date()
  await user.save()
  disconnectUser(userId)

  // Chỉ báo "đã xoá" SAU khi ẩn danh đã lưu thành công: lưu lỗi thì user không bị báo nhầm,
  // và lần chạy lại gửi đúng 1 lần. Email cũ truyền riêng vì tài khoản vừa bị ẩn danh.
  await notifyUser(userId, {
    title: 'Tài khoản của bạn đã được xoá',
    body: 'Yêu cầu xoá tài khoản và dữ liệu cá nhân của bạn trên SwiftletCare đã hoàn tất.',
  }, { email: contactEmail, emailOnly: true })

  await logAction(adminId, 'ACCOUNT_DELETED', 'user', userId, {
    farmsTransferred, farmsDeleted,
  })
  return user
}

/**
 * AUTH-FR-012 — Admin từ chối yêu cầu xoá (VD còn nghĩa vụ lưu hồ sơ). Lý do bắt
 * buộc và được gửi lại cho người yêu cầu; tài khoản giữ nguyên, rời hàng đợi.
 */
export async function rejectDeletionRequest(adminId: string, userId: string, reason: string): Promise<IUser> {
  if (adminId === userId) throw BadRequestError('Không thể tự xử lý yêu cầu xoá tài khoản của chính mình')
  const trimmedReason = reason.trim()
  if (!trimmedReason) throw BadRequestError('Phải nhập lý do khi từ chối yêu cầu xoá')

  const user = await User.findById(userId)
  if (!user) throw NotFoundError('Không tìm thấy người dùng')
  if (!user.deletion_requested_at) throw BadRequestError('Người dùng này chưa gửi yêu cầu xoá tài khoản')

  const requestedAt = user.deletion_requested_at
  user.deletion_requested_at = undefined
  user.deletion_reminder_sent_at = undefined
  await user.save()

  await logAction(adminId, 'DELETION_REJECTED', 'user', userId, { reason: trimmedReason, requestedAt })
  await notifyUser(userId, {
    title: 'Yêu cầu xoá tài khoản bị từ chối',
    body: `Yêu cầu xoá tài khoản của bạn chưa được thực hiện. Lý do: ${trimmedReason}`,
  })
  return user
}

/** Hạn xử lý yêu cầu xoá (PRIV-NFR-003) và số ngày còn lại thì bắt đầu nhắc Admin */
const DELETION_DEADLINE_DAYS = 30
const DELETION_REMIND_DAYS_BEFORE = 7
const DAY_MS = 86_400_000

/**
 * AUTH-FR-012 — yêu cầu xoá đã chờ tới ngày thứ 23 mà Admin chưa xử lý: nhắc 1
 * lần, kèm số ngày còn lại. `deletion_reminder_sent_at` chặn nhắc lặp mỗi lần
 * job chạy; huỷ / từ chối / hoàn tất đều gỡ cờ này. Trả số yêu cầu đã nhắc.
 */
export async function remindPendingDeletionRequests(now = new Date()): Promise<number> {
  const remindBefore = new Date(now.getTime() - (DELETION_DEADLINE_DAYS - DELETION_REMIND_DAYS_BEFORE) * DAY_MS)
  const due = await User.find({
    deletion_requested_at: { $ne: null, $lte: remindBefore },
    deletion_reminder_sent_at: null,
  }).select('full_name role deletion_requested_at').lean()

  for (const user of due) {
    const deadline = new Date(user.deletion_requested_at!.getTime() + DELETION_DEADLINE_DAYS * DAY_MS)
    const daysLeft = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / DAY_MS))
    // Ghi cờ trước khi gửi: gửi lỗi thì mất 1 lần nhắc, còn ngược lại thì lỗi ghi sẽ nhắc lặp mãi
    await User.updateOne({ _id: user._id }, { $set: { deletion_reminder_sent_at: now } })
    await notifyAdmins({
      title: 'Yêu cầu xoá tài khoản sắp quá hạn',
      body: `${user.full_name} (${user.role}) đã chờ xoá tài khoản từ ${user.deletion_requested_at!.toLocaleDateString('vi-VN')} — còn ${daysLeft} ngày trước hạn 30 ngày.`,
    })
  }
  return due.length
}

// ── Admin tự tạo tài khoản Technician — AUTH-FR-005c ─────────────────────────


/**
 * Quy mỗi vùng về mã danh mục (nhận cả tên/tên tỉnh cũ), bỏ mục rỗng và trùng — dùng
 * chung cho tạo và sửa vùng. Vùng lạ ném 400: lưu chuỗi tự do thì không khớp được farm nào.
 */
function normalizeRegions(regions: string[]): string[] {
  const codes = [...new Set(regions.filter(r => r.trim()).map(assertRegionCode))]
  if (codes.length === 0) throw BadRequestError('Technician phải phụ trách ít nhất 1 khu vực')
  return codes
}

export interface CreateTechnicianInput {
  email: string; password: string; full_name: string; phone?: string; assigned_regions: string[]
}

export async function createTechnician(adminId: string, input: CreateTechnicianInput): Promise<IUser> {
  const normalizedEmail = input.email.toLowerCase().trim()
  if (await User.findOne({ email: normalizedEmail })) throw ConflictError('Email đã được đăng ký')

  const user = await User.create({
    email: normalizedEmail,
    password_hash: input.password, // pre-save hook tự hash
    full_name: input.full_name,
    phone: input.phone || undefined,
    role: 'TECHNICIAN',
    assigned_regions: normalizeRegions(input.assigned_regions),
    // Admin biết mật khẩu này — Technician phải tự đổi ở lần đăng nhập đầu
    must_change_password: true,
  })

  await logAction(adminId, 'USER_CREATED', 'user', String(user._id), { role: 'TECHNICIAN' })
  return user
}

/**
 * AUTH-FR-005c, Flow 21 case 4a-x — Admin điều chỉnh khu vực phụ trách. Có
 * hiệu lực ngay ở request kế tiếp vì middleware authenticate đọc lại
 * assigned_regions từ DB mỗi request, không lấy từ JWT.
 */
export async function updateTechnicianRegions(
  adminId: string, technicianId: string, regions: string[],
): Promise<IUser> {
  const technician = await User.findById(technicianId)
  if (!technician) throw NotFoundError('Không tìm thấy người dùng')
  if (technician.role !== 'TECHNICIAN') throw BadRequestError('Chỉ gán khu vực được cho tài khoản Technician')

  const before = [...(technician.assigned_regions ?? [])]
  const after = normalizeRegions(regions)
  technician.assigned_regions = after
  await technician.save()

  await logAction(adminId, 'TECHNICIAN_REGIONS_UPDATED', 'user', technicianId, { before, after })
  return technician
}

/** Technician còn dùng được (chưa xoá theo yêu cầu) */
async function findManageableTechnician(technicianId: string): Promise<IUser> {
  const technician = await User.findById(technicianId)
  if (!technician) throw NotFoundError('Không tìm thấy người dùng')
  if (technician.role !== 'TECHNICIAN') throw BadRequestError('Chỉ áp dụng cho tài khoản Technician')
  if (technician.deleted_at) throw ConflictError('Tài khoản đã bị xoá theo yêu cầu')
  return technician
}

/**
 * AUTH-FR-005c — Technician quên mật khẩu mà email chưa nối SMTP thật, hoặc tài khoản
 * nghi bị lộ: Admin cấp mật khẩu tạm (sinh ngẫu nhiên, trả ĐÚNG 1 lần). Mọi phiên cũ bị
 * thu hồi và Technician phải đổi mật khẩu ở lần đăng nhập kế tiếp.
 */
export async function resetTechnicianPassword(
  adminId: string, technicianId: string,
): Promise<{ technician: IUser; temporaryPassword: string }> {
  const technician = await findManageableTechnician(technicianId)
  const temporaryPassword = crypto.randomBytes(9).toString('base64url') // 12 ký tự

  technician.password_hash = temporaryPassword // pre-save hook tự hash (SEC-NFR-003)
  technician.must_change_password = true
  technician.refresh_tokens = [] as never
  await technician.save()
  disconnectUser(technicianId)

  await logAction(adminId, 'TECHNICIAN_PASSWORD_RESET', 'user', technicianId)
  return { technician, temporaryPassword }
}
