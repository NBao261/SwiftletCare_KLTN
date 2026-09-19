import { User, IUser } from '@/models/user.model'
import { Farm } from '@/models/farm.model'
import { SalesAssignment } from '@/models/salesAssignment.model'
import { logAction } from '@/services/auditLog.service'
import { NotFoundError, ConflictError, BadRequestError } from '@/utils/appError.util'
import type { Role } from '@/types'

// ── Quản lý tài khoản — AUTH-FR-011, AUTH-FR-012, Flow 19 ──────────────────────

export interface ListUsersQuery {
  role?: Role
  status?: 'active' | 'inactive'
  page?: number
  limit?: number
}

export async function listUsers(query: ListUsersQuery) {
  const filter: Record<string, unknown> = {}
  if (query.role) filter.role = query.role
  if (query.status) filter.is_active = query.status === 'active'

  const page = query.page ?? 1
  const limit = Math.min(query.limit ?? 20, 100)

  const [records, total] = await Promise.all([
    User.find(filter).sort({ created_at: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ])
  return { records, total, page, limit }
}

/**
 * AUTH-FR-011 — khoá/mở khoá tài khoản. Lý do bắt buộc khi khoá (không bắt buộc
 * khi mở khoá). Middleware `authenticate` đã tự chặn is_active=false ở request
 * kế tiếp, nên không cần thu hồi refresh_tokens riêng ở đây — vẫn xoá cho chắc,
 * để user không giữ được phiên nào nếu quay lại dùng refresh token cũ.
 */
export async function setUserStatus(
  adminId: string, userId: string, isActive: boolean, reason?: string,
): Promise<IUser> {
  if (!isActive && !reason?.trim()) {
    throw BadRequestError('Phải nhập lý do khi khoá tài khoản')
  }

  const user = await User.findById(userId)
  if (!user) throw NotFoundError('Không tìm thấy người dùng')

  user.is_active = isActive
  if (isActive) {
    user.deactivated_at = undefined
    user.deactivated_reason = undefined
  } else {
    user.deactivated_at = new Date()
    user.deactivated_reason = reason
    user.refresh_tokens = [] as never
  }
  await user.save()

  await logAction(adminId, isActive ? 'ACCOUNT_UNLOCKED' : 'ACCOUNT_LOCKED', 'user', userId, { reason })
  return user
}

export interface ListQuery { page?: number; limit?: number }

export async function listDeletionRequests(query: ListQuery) {
  const page = query.page ?? 1
  const limit = Math.min(query.limit ?? 20, 100)
  const filter = { deletion_requested_at: { $ne: null } }

  const [records, total] = await Promise.all([
    User.find(filter).sort({ deletion_requested_at: 1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ])
  return { records, total, page, limit }
}

/**
 * AUTH-FR-012 / PRIV-NFR-003 — Flow 19 bước 7-8. Cascade:
 * - Farm mà user là Primary Owner: còn thành viên khác → chuyển owner_id cho
 *   người có joined_at sớm nhất; hết thành viên → soft-delete Farm.
 * - Farm mà user chỉ là member thường: gỡ khỏi members.
 * - Anonymize thông tin cá nhân, không xoá document (giữ FK cho tickets/farms lịch sử).
 */
export async function completeDeletionRequest(adminId: string, userId: string): Promise<IUser> {
  const user = await User.findById(userId)
  if (!user) throw NotFoundError('Không tìm thấy người dùng')
  if (!user.deletion_requested_at) {
    throw BadRequestError('Người dùng này chưa gửi yêu cầu xoá tài khoản')
  }

  const ownedFarms = await Farm.find({ owner_id: user._id, is_deleted: false })
  for (const farm of ownedFarms) {
    const otherMembers = farm.members.filter(m => String(m.user_id) !== userId)
    if (otherMembers.length > 0) {
      const nextOwner = otherMembers.reduce((earliest, m) =>
        m.joined_at < earliest.joined_at ? m : earliest)
      farm.owner_id = nextOwner.user_id
      farm.members.forEach(m => { m.is_primary = String(m.user_id) === String(nextOwner.user_id) })
      const selfIndex = farm.members.findIndex(m => String(m.user_id) === userId)
      if (selfIndex !== -1) farm.members.splice(selfIndex, 1)
      await farm.save()
    } else {
      farm.is_deleted = true
      await farm.save()
    }
  }

  // Member thường (không phải owner) ở các farm khác — gỡ khỏi members
  await Farm.updateMany(
    { owner_id: { $ne: user._id }, 'members.user_id': user._id },
    { $pull: { members: { user_id: user._id } } },
  )

  user.email = `deleted-${String(user._id)}@swiftletcare.local`
  user.phone = undefined
  user.full_name = 'Tài khoản đã xoá'
  user.avatar_url = undefined
  user.is_active = false
  user.refresh_tokens = [] as never
  await user.save()

  await logAction(adminId, 'ACCOUNT_DELETED', 'user', userId, { farmsTransferred: ownedFarms.length })
  return user
}

// ── Admin tự tạo tài khoản Technician / Sales Staff — AUTH-FR-005c, Flow 16 ────

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
    phone: input.phone,
    role: 'TECHNICIAN',
    assigned_regions: input.assigned_regions,
  })

  await logAction(adminId, 'USER_CREATED', 'user', String(user._id), { role: 'TECHNICIAN' })
  return user
}

export interface CreateSalesStaffInput {
  email: string; password: string; full_name: string; phone?: string; farm_ids: string[]
}

export async function createSalesStaff(adminId: string, input: CreateSalesStaffInput): Promise<IUser> {
  const normalizedEmail = input.email.toLowerCase().trim()
  if (await User.findOne({ email: normalizedEmail })) throw ConflictError('Email đã được đăng ký')

  const user = await User.create({
    email: normalizedEmail,
    password_hash: input.password,
    full_name: input.full_name,
    phone: input.phone,
    role: 'SALES_STAFF',
  })

  await Promise.all(input.farm_ids.map(farmId =>
    SalesAssignment.findOneAndUpdate(
      { farm_id: farmId, sales_staff_id: user._id },
      { $setOnInsert: { invited_by: adminId } },
      { upsert: true },
    )))

  await logAction(adminId, 'USER_CREATED', 'user', String(user._id), { role: 'SALES_STAFF', farm_ids: input.farm_ids })
  return user
}
