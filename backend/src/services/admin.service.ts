import { User, IUser, SIGN_IN_FILTER } from '@/models/user.model'
import { AuditLog } from '@/models/auditLog.model'
import { Farm } from '@/models/farm.model'
import { Invitation } from '@/models/invitation.model'
import { logAction } from '@/services/auditLog.service'
import { softDeleteFarm } from '@/services/farm.service'
import { sendMail, temporaryPasswordMail } from '@/services/mail.service'
import { notifyAdmins, notifyUser } from '@/services/notification.service'
import { removeUserPushTokens } from '@/services/push.service'
import { disconnectUser } from '@/socket'
import { escapeRegex, paginate } from '@/utils/helpers.util'
import { NotFoundError, ConflictError, BadRequestError } from '@/utils/appError.util'
import { generateTemporaryPassword } from '@/utils/password.util'
import { ROLE_LABEL } from '@/utils/displayLabel.util'
import type { Role } from '@/types'

export interface ListQuery { page?: string | number; limit?: string | number }

export interface ListUsersQuery extends ListQuery {
  role?: Role
  status?: 'active' | 'inactive' | 'deleted'
  q?: string
}

export async function listUsers(query: ListUsersQuery) {
  const filter: Record<string, unknown> = {}
  if (query.role) filter.role = query.role
  if (query.status === 'active') Object.assign(filter, SIGN_IN_FILTER)
  if (query.status === 'inactive') filter.status = 'LOCKED'
  if (query.status === 'deleted') filter.status = 'DELETED'
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

export interface CreateFarmOwnerInput {
  email: string
  full_name: string
  phone?: string
}

// Mật khẩu tạm không trả về và không ghi log
export async function createFarmOwner(
  adminId: string, input: CreateFarmOwnerInput,
): Promise<Record<string, unknown> & { temporary_password_emailed: boolean }> {
  const email = input.email.toLowerCase().trim()
  // 1 email = 1 tài khoản, kể cả bị khoá hay chờ xoá
  if (await User.exists({ email })) throw ConflictError('Email này đã có tài khoản')

  const temporaryPassword = generateTemporaryPassword()
  const user = await User.create({
    email,
    full_name: input.full_name.trim(),
    ...(input.phone?.trim() && { phone: input.phone.trim() }),
    role: 'FARM_OWNER',
    password_hash: temporaryPassword, // pre-save hook tự hash
    must_change_password: true,
  })
  await logAction(adminId, 'FARM_OWNER_CREATED', 'user', String(user._id), { email })
  const emailed = await sendMail(temporaryPasswordMail({ to: email, fullName: user.full_name, temporaryPassword }))
  return { ...(user.toJSON() as Record<string, unknown>), temporary_password_emailed: emailed }
}

// authenticate đã chặn LOCKED, vẫn xoá refresh_tokens cho chắc; ngắt luôn socket
export async function setUserStatus(
  adminId: string, userId: string, isActive: boolean, reason?: string,
): Promise<IUser> {
  // Chặn tự khoá là đủ để luôn còn 1 Admin
  if (adminId === userId) throw BadRequestError('Không thể tự khoá tài khoản của chính mình')
  const trimmedReason = reason?.trim()
  if (!isActive && !trimmedReason) {
    throw BadRequestError('Phải nhập lý do khi khoá tài khoản')
  }

  const user = await User.findById(userId)
  if (!user) throw NotFoundError('Không tìm thấy người dùng')
  // PII đã ẩn danh: mở khoá sẽ tạo tài khoản sống mà rỗng
  if (user.status === 'DELETED') throw ConflictError('Tài khoản đã bị xoá theo yêu cầu, không thể khoá/mở khoá')
  // đang chờ xoá thì xử lý yêu cầu trước
  if (!isActive && user.status === 'DELETION_REQUESTED') {
    throw ConflictError('Tài khoản đang chờ xoá: xử lý hoặc từ chối yêu cầu xoá trước khi khoá')
  }

  if (isActive) {
    if (user.status === 'LOCKED') user.status = 'ACTIVE'
    user.locked_at = undefined
    user.locked_reason = undefined
  } else {
    user.status = 'LOCKED'
    user.locked_at = new Date()
    user.locked_reason = trimmedReason
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


// Không có transaction nên phải chạy lại được: cờ deletion_requested_at chỉ gỡ ở bước lưu cuối
export async function completeDeletionRequest(adminId: string, userId: string): Promise<IUser> {
  if (adminId === userId) throw BadRequestError('Không thể tự xử lý yêu cầu xoá tài khoản của chính mình')
  const user = await User.findById(userId)
  if (!user) throw NotFoundError('Không tìm thấy người dùng')
  if (!user.deletion_requested_at) {
    throw BadRequestError('Người dùng này chưa gửi yêu cầu xoá tài khoản')
  }

  const ownedFarms = await Farm.find({ owner_id: user._id, is_deleted: false })

  for (const farm of ownedFarms) {
    // Chỉ chuyển cho đồng sở hữu; không còn thì xoá mềm farm
    const otherMembers = farm.members.filter(m => String(m.user_id) !== userId && m.role !== 'DOMAIN_EXPERT' && m.role !== 'FARM_TECHNICIAN')
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
        title: 'Bạn trở thành chủ sở hữu trang trại',
        body: `Chủ nhà yến của trang trại "${farm.name}" đã xoá tài khoản, quyền chủ sở hữu đã được chuyển cho bạn.`,
      })
    } else {
      await softDeleteFarm(farm)

      await logAction(adminId, 'FARM_SOFT_DELETED', 'farm', String(farm._id), {
        reason: 'OWNER_ACCOUNT_DELETED', ownerId: userId,
      })
    }
  }

  await Farm.updateMany(
    { owner_id: { $ne: user._id }, 'members.user_id': user._id },
    { $pull: { members: { user_id: user._id } } },
  )



  // Đọc từ audit qua mọi lần chạy, trước bước ẩn danh không đảo ngược
  const [farmsTransferred, farmsDeleted] = await Promise.all([
    AuditLog.countDocuments({ action: 'FARM_OWNERSHIP_TRANSFERRED', 'metadata.fromUserId': userId }),
    AuditLog.countDocuments({ action: 'FARM_SOFT_DELETED', 'metadata.ownerId': userId }),
  ])

  const contactEmail = user.email // Giữ để gửi thông báo sau khi ẩn danh

  // Người mời đã biến mất
  await Invitation.updateMany({ status: 'PENDING', invited_by: user._id }, { $set: { status: 'EXPIRED' } })

  user.email = `deleted-${String(user._id)}@swiftletcare.local`
  user.phone = undefined
  user.full_name = 'Tài khoản đã xoá'
  user.avatar_url = undefined
  user.telegram_chat_id = undefined
  user.telegram_link_code_hash = undefined
  user.telegram_link_expires_at = undefined
  user.status = 'DELETED'
  user.refresh_tokens = [] as never
  // Để không chạy lại cascade lần 2
  user.deletion_requested_at = undefined
  user.deletion_reminder_sent_at = undefined
  user.deleted_at = new Date()
  await user.save()
  disconnectUser(userId)
  await removeUserPushTokens(userId)

  // Chỉ báo sau khi lưu ẩn danh thành công: lỗi thì không báo nhầm
  await notifyUser(userId, {
    title: 'Tài khoản của bạn đã được xoá',
    body: 'Yêu cầu xoá tài khoản và dữ liệu cá nhân của bạn trên SwiftletCare đã hoàn tất.',
  }, { email: contactEmail, emailOnly: true })

  await logAction(adminId, 'ACCOUNT_DELETED', 'user', userId, {
    farmsTransferred, farmsDeleted,
  })
  return user
}

// Lý do được gửi lại người yêu cầu
export async function rejectDeletionRequest(adminId: string, userId: string, reason: string): Promise<IUser> {
  if (adminId === userId) throw BadRequestError('Không thể tự xử lý yêu cầu xoá tài khoản của chính mình')
  const trimmedReason = reason.trim()
  if (!trimmedReason) throw BadRequestError('Phải nhập lý do khi từ chối yêu cầu xoá')

  const user = await User.findById(userId)
  if (!user) throw NotFoundError('Không tìm thấy người dùng')
  if (!user.deletion_requested_at) throw BadRequestError('Người dùng này chưa gửi yêu cầu xoá tài khoản')

  const requestedAt = user.deletion_requested_at
  // tài khoản đang bị khoá vẫn khoá
  if (user.status === 'DELETION_REQUESTED') user.status = 'ACTIVE'
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

const DELETION_DEADLINE_DAYS = 30
const DELETION_REMIND_DAYS_BEFORE = 7
const DAY_MS = 86_400_000

// deletion_reminder_sent_at chặn nhắc lặp
export async function remindPendingDeletionRequests(now = new Date()): Promise<number> {
  const remindBefore = new Date(now.getTime() - (DELETION_DEADLINE_DAYS - DELETION_REMIND_DAYS_BEFORE) * DAY_MS)
  const due = await User.find({
    deletion_requested_at: { $ne: null, $lte: remindBefore },
    deletion_reminder_sent_at: null,
  }).select('full_name role deletion_requested_at').lean()

  for (const user of due) {
    const deadline = new Date(user.deletion_requested_at!.getTime() + DELETION_DEADLINE_DAYS * DAY_MS)
    const daysLeft = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / DAY_MS))
    // Ghi cờ trước khi gửi: lỗi thì mất 1 lần nhắc, không nhắc lặp mãi
    await User.updateOne({ _id: user._id }, { $set: { deletion_reminder_sent_at: now } })
    await notifyAdmins({
      title: 'Yêu cầu xoá tài khoản sắp quá hạn',
      body: `${user.full_name} (${ROLE_LABEL[user.role]}) đã chờ xoá tài khoản từ ${user.deletion_requested_at!.toLocaleDateString('vi-VN')}, còn ${daysLeft} ngày trước hạn 30 ngày.`,
    })
  }
  return due.length
}

