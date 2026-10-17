import { User, IUser } from '@/models/user.model'
import { AuditLog } from '@/models/auditLog.model'
import { Farm } from '@/models/farm.model'
import { Ticket } from '@/models/ticket.model'
import { Invitation } from '@/models/invitation.model'
import { logAction } from '@/services/auditLog.service'
import { softDeleteFarm } from '@/services/farm.service'
import { notifyAdmins, notifyUser } from '@/services/notification.service'
import { closeTicketsOfDeletedFarm, rerouteTicketsOutOfCoverage, type CoverageRerouteResult } from '@/services/ticket.service'
import { disconnectUser } from '@/socket'
import { paginate } from '@/utils/helpers.util'
import { AppError, NotFoundError, ConflictError, BadRequestError } from '@/utils/appError.util'
import type { Role } from '@/types'

/** Trả đủ id để Admin bấm gán lại, nhưng không bơm cả nghìn id vào 1 response */
const OPEN_TICKET_IDS_LIMIT = 100

// ── Quản lý tài khoản — AUTH-FR-011, AUTH-FR-012, Flow 19 ──────────────────────

export interface ListQuery { page?: string | number; limit?: string | number }

export interface ListUsersQuery extends ListQuery {
  role?: Role
  status?: 'active' | 'inactive'
}

export async function listUsers(query: ListUsersQuery) {
  const filter: Record<string, unknown> = {}
  if (query.role) filter.role = query.role
  if (query.status) filter.is_active = query.status === 'active'

  const { page, skip, limit } = paginate(query.page, query.limit)

  const [records, total] = await Promise.all([
    User.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ])
  return { records, total, page, limit }
}

export interface SetUserStatusResult {
  user: IUser
  /** Chỉ có khi khoá Technician còn ticket đang giao — đã điều phối lại (TICKET-FR-005b) */
  reroute?: CoverageRerouteResult
  /** Số ticket không ai trong vùng nhận được, về hàng đợi chung — Admin cần gán tay */
  openTickets?: number
  /** Id của chính các ticket đó, để Admin gán lại được ngay mà không phải tự đi tìm */
  openTicketIds?: string[]
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
): Promise<SetUserStatusResult> {
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
  if (isActive) return { user }

  disconnectUser(userId)
  if (user.role === 'TECHNICIAN') {
    // Người bị khoá không đăng nhập được, thông báo SLA cũng bỏ qua họ — để ticket
    // lại thì không ai xử lý. Điều phối lại như khi xoá tài khoản; ai không nhận
    // được thì về hàng đợi chung và trả id để Admin gán tay.
    const reroute = await rerouteTicketsOutOfCoverage({ technicianId: userId }, adminId, 'ACCOUNT_LOCKED')
    if (reroute.rerouted.length || reroute.unassigned.length) {
      return {
        user,
        reroute,
        ...(reroute.unassigned.length
          ? { openTickets: reroute.unassigned.length, openTicketIds: reroute.unassigned.slice(0, OPEN_TICKET_IDS_LIMIT) }
          : {}),
      }
    }
  }
  return { user }
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

export interface CompleteDeletionOptions {
  /** Bỏ qua cảnh báo ticket đang mở (Flow 19 bước 7c) và vẫn xoá */
  force?: boolean
}

/**
 * AUTH-FR-012 / PRIV-NFR-003 — Flow 19 bước 7-8. Cascade:
 * - Farm mà user là Primary Owner: còn thành viên khác → chuyển owner_id cho
 *   người có joined_at sớm nhất; hết thành viên → soft-delete Farm.
 * - Farm mà user chỉ là member thường: gỡ khỏi members.
 * - Anonymize thông tin cá nhân, không xoá document (giữ FK cho tickets/farms lịch sử).
 *
 * Mongo dev chạy standalone (không transaction) nên hàm này được thiết kế để CHẠY
 * LẠI được khi lỗi giữa chừng: cờ `deletion_requested_at` chỉ bị gỡ ở bước lưu
 * cuối, mỗi farm xử lý xong đã có audit riêng, còn farm đã chuyển/xoá thì lần
 * chạy sau không tìm thấy nữa (không bị xử lý hai lần).
 */
export async function completeDeletionRequest(
  adminId: string, userId: string, opts: CompleteDeletionOptions = {},
): Promise<IUser> {
  if (adminId === userId) throw BadRequestError('Không thể tự xử lý yêu cầu xoá tài khoản của chính mình')
  const user = await User.findById(userId)
  if (!user) throw NotFoundError('Không tìm thấy người dùng')
  if (!user.deletion_requested_at) {
    throw BadRequestError('Người dùng này chưa gửi yêu cầu xoá tài khoản')
  }

  const ownedFarms = await Farm.find({ owner_id: user._id, is_deleted: false })

  if (!opts.force) {
    // Farm chỉ có mình user sẽ bị xoá mềm → ticket đang mở của farm đó cũng thành mồ côi
    // Farm chỉ còn Domain Expert (không đồng sở hữu) cũng bị xoá mềm — xem vòng lặp bên dưới
    const soleOwnerFarmIds = ownedFarms
      .filter(f => f.members.every(m => String(m.user_id) === userId || m.role === 'DOMAIN_EXPERT'))
      .map(f => f._id)
    const openTickets = await Ticket.countDocuments({
      status: { $ne: 'CLOSED' },
      $or: [{ assigned_to: user._id }, { created_by: user._id }, { farm_id: { $in: soleOwnerFarmIds } }],
    })
    if (openTickets > 0) {
      throw new AppError(
        409, 'HAS_OPEN_TICKETS',
        `Người dùng còn ${openTickets} ticket đang mở — xử lý xong hoặc gửi force:true để vẫn xoá`,
        { openTickets },
      )
    }
  }

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
      // Farm đã xoá thì không ai mở được ticket của nó nữa (kể cả Admin) nhưng
      // chúng vẫn tính vào ngưỡng quá tải của Router và báo cáo — đóng hẳn,
      // giống removeFarm. Gọi cả khi force:true vì đó đúng là trường hợp còn
      // ticket mở (Flow 19 bước 7c).
      await closeTicketsOfDeletedFarm(String(farm._id), adminId)
    }
  }

  // Member thường (không phải owner) ở các farm khác — gỡ khỏi members
  await Farm.updateMany(
    { owner_id: { $ne: user._id }, 'members.user_id': user._id },
    { $pull: { members: { user_id: user._id } } },
  )

  // Technician bị xoá (kể cả khi Admin gửi force vì họ còn ticket mở): ticket đang giao
  // không được ở lại với một tài khoản đã ẩn danh — không ai xử lý, SLA vẫn chạy. Gỡ vùng
  // phụ trách TRƯỚC, nếu không rerouteTicketsOutOfCoverage coi họ "vẫn phụ trách" và bỏ qua.
  // Chạy trước bước ẩn danh để lỗi giữa chừng vẫn chạy lại được (gỡ vùng là idempotent).
  if (user.role === 'TECHNICIAN') {
    if (user.assigned_regions?.length) {
      user.assigned_regions = []
      await user.save()
    }
    await rerouteTicketsOutOfCoverage({ technicianId: userId }, adminId, 'ACCOUNT_DELETED')
  }

  // Tổng qua MỌI lần chạy (kể cả lần lỗi giữa chừng trước đó), đọc từ audit từng farm — tính TRƯỚC bước
  // ẩn danh không thể đảo ngược để một lỗi đọc DB ở đây vẫn cho phép chạy lại. Đây là số liệu theo audit
  // (ghi audit là best-effort, xem logAction), không phải nguồn sự thật về dữ liệu farm.
  const [farmsTransferred, farmsDeleted, ticketsRerouted] = await Promise.all([
    AuditLog.countDocuments({ action: 'FARM_OWNERSHIP_TRANSFERRED', 'metadata.fromUserId': userId }),
    AuditLog.countDocuments({ action: 'FARM_SOFT_DELETED', 'metadata.ownerId': userId }),
    AuditLog.countDocuments({ action: 'TICKET_REROUTED', 'metadata.from': userId, 'metadata.reason': 'ACCOUNT_DELETED' }),
  ])

  const contactEmail = user.email // giữ lại để gửi thông báo cuối sau khi ẩn danh

  // Lời mời đang chờ do user này gửi không được chấp nhận được nữa sau khi người mời đã biến mất
  await Invitation.updateMany({ status: 'PENDING', invited_by: user._id }, { $set: { status: 'EXPIRED' } })

  user.email = `deleted-${String(user._id)}@swiftletcare.local`
  user.phone = undefined
  user.full_name = 'Tài khoản đã xoá'
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
    farmsTransferred, farmsDeleted, ticketsRerouted, forced: opts.force === true,
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

/** Ticket được điều phối lại kèm theo, để màn hình Admin hiện ngay (TICKET-FR-005b) */
export interface UpdateTechnicianRegionsResult extends CoverageRerouteResult {
  technician: IUser
}

/** Bỏ khoảng trắng thừa, mục rỗng và mục trùng — dùng chung cho tạo và sửa vùng */
function normalizeRegions(regions: string[]): string[] {
  return [...new Set(regions.map(r => r.trim()).filter(Boolean))]
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
): Promise<UpdateTechnicianRegionsResult> {
  const technician = await User.findById(technicianId)
  if (!technician) throw NotFoundError('Không tìm thấy người dùng')
  if (technician.role !== 'TECHNICIAN') throw BadRequestError('Chỉ gán khu vực được cho tài khoản Technician')

  const before = [...(technician.assigned_regions ?? [])]
  const after = normalizeRegions(regions)
  technician.assigned_regions = after
  await technician.save()

  await logAction(adminId, 'TECHNICIAN_REGIONS_UPDATED', 'user', technicianId, { before, after })

  // Vùng bị gỡ: ticket đang mở ở đó không còn người xử lý được (họ mất quyền trên
  // chính ticket của mình) — điều phối lại ngay thay vì để kẹt im lặng.
  const removedRegions = before.filter(r => !after.includes(r))
  const reroute = removedRegions.length > 0
    ? await rerouteTicketsOutOfCoverage({ technicianId }, adminId, 'REGION_UNASSIGNED')
    : { rerouted: [], unassigned: [] }
  return { technician, ...reroute }
}
