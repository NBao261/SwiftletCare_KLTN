import crypto from 'crypto'
import { User, IUser } from '@/models/user.model'
import { AuditLog } from '@/models/auditLog.model'
import { Farm } from '@/models/farm.model'
import { Ticket } from '@/models/ticket.model'
import { SalesAssignment } from '@/models/salesAssignment.model'
import {
  SalesAssignmentRequest, ISalesAssignmentRequest, SalesAssignmentRequestStatus, SalesAssignmentRequestType,
} from '@/models/salesAssignmentRequest.model'
import { Invitation } from '@/models/invitation.model'
import { logAction } from '@/services/auditLog.service'
import { forgotPassword } from '@/services/auth.service'
import { notifyUser } from '@/services/notification.service'
import { disconnectUser } from '@/socket'
import { paginate } from '@/utils/helpers.util'
import { AppError, NotFoundError, ConflictError, BadRequestError } from '@/utils/appError.util'
import logger from '@/utils/logger.util'
import type { Role } from '@/types'

const DUPLICATE_KEY = 11000

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
  /** Chỉ có khi khoá Technician còn ticket đang giao — Admin cần gán lại (TICKET-FR-005b) */
  openTickets?: number
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
    const openTickets = await Ticket.countDocuments({ assigned_to: user._id, status: { $ne: 'CLOSED' } })
    if (openTickets > 0) return { user, openTickets }
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
    const soleOwnerFarmIds = ownedFarms
      .filter(f => f.members.every(m => String(m.user_id) === userId))
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
    const otherMembers = farm.members.filter(m => String(m.user_id) !== userId)
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
      farm.is_deleted = true
      await farm.save()

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

  // Dọn các liên kết trỏ tới user, nếu không sẽ thành dữ liệu mồ côi: farm vẫn
  // hiện "đã có Sales Staff" trỏ tới tài khoản đã xoá, còn đề xuất/lời mời
  // đang chờ vẫn duyệt hoặc chấp nhận được sau khi người tạo đã biến mất.
  const [removedAssignments] = await Promise.all([
    SalesAssignment.deleteMany({ sales_staff_id: user._id }),
    SalesAssignmentRequest.updateMany(
      { status: 'PENDING', $or: [{ requested_by: user._id }, { sales_staff_email: contactEmail }] },
      { $set: { status: 'REJECTED', reviewed_by: adminId, review_note: 'Tài khoản liên quan đã bị xoá theo yêu cầu', reviewed_at: new Date() } },
    ),
    Invitation.updateMany({ status: 'PENDING', invited_by: user._id }, { $set: { status: 'EXPIRED' } }),
  ])

  user.email = `deleted-${String(user._id)}@swiftletcare.local`
  user.phone = undefined
  user.full_name = 'Tài khoản đã xoá'
  user.avatar_url = undefined
  user.is_active = false
  user.refresh_tokens = [] as never
  // Gỡ cờ yêu cầu để tài khoản rời khỏi hàng đợi /admin/delete-requests và
  // không bị xử lý (chạy lại cascade) lần 2
  user.deletion_requested_at = undefined
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
    farmsTransferred, farmsDeleted, salesAssignmentsRemoved: removedAssignments.deletedCount, forced: opts.force === true,
  })
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
  const after = [...new Set(regions.map(r => r.trim()).filter(Boolean))]
  technician.assigned_regions = after
  await technician.save()

  await logAction(adminId, 'TECHNICIAN_REGIONS_UPDATED', 'user', technicianId, { before, after })
  return technician
}

export interface CreateSalesStaffInput {
  email: string; password: string; full_name: string; phone?: string; farm_ids: string[]
}

export async function createSalesStaff(adminId: string, input: CreateSalesStaffInput): Promise<IUser> {
  const normalizedEmail = input.email.toLowerCase().trim()
  if (await User.findOne({ email: normalizedEmail })) throw ConflictError('Email đã được đăng ký')

  // Kiểm tra farm TRƯỚC khi tạo tài khoản — isMongoId() ở route chỉ kiểm định dạng,
  // id đúng dạng nhưng không tồn tại/đã xoá mềm sẽ tạo SalesAssignment mồ côi mà không báo lỗi.
  const farmIds = [...new Set(input.farm_ids)]
  const foundFarms = await Farm.find({ _id: { $in: farmIds }, is_deleted: false }).select('_id').lean()
  if (foundFarms.length !== farmIds.length) {
    const found = new Set(foundFarms.map(f => String(f._id)))
    throw NotFoundError(`Không tìm thấy farm: ${farmIds.filter(id => !found.has(id)).join(', ')}`)
  }

  const user = await User.create({
    email: normalizedEmail,
    password_hash: input.password,
    full_name: input.full_name,
    phone: input.phone,
    role: 'SALES_STAFF',
  })

  await Promise.all(farmIds.map(farmId =>
    SalesAssignment.findOneAndUpdate(
      { farm_id: farmId, sales_staff_id: user._id },
      { $setOnInsert: { invited_by: adminId } },
      { upsert: true },
    )))

  await logAction(adminId, 'USER_CREATED', 'user', String(user._id), { role: 'SALES_STAFF', farm_ids: farmIds })
  return user
}

/** Xoá bản ghi gán + audit; trả false nếu không có bản ghi nào để xoá */
async function removeAssignment(
  adminId: string, farmId: unknown, salesStaffId: unknown, extra: Record<string, unknown> = {},
): Promise<boolean> {
  const assignment = await SalesAssignment.findOneAndDelete({ farm_id: farmId, sales_staff_id: salesStaffId })
  if (!assignment) return false

  await logAction(adminId, 'SALES_STAFF_UNASSIGNED', 'sales_assignment', String(assignment._id), {
    farm_id: String(farmId), sales_staff_id: String(salesStaffId), ...extra,
  })
  return true
}

/**
 * Flow 16 case 1e — Admin gỡ Sales Staff khỏi 1 Farm. Chỉ xoá bản ghi gán,
 * không đụng tài khoản Sales Staff (có thể còn gán ở Farm khác) hay
 * Order/Product đã tạo trước đó.
 */
export async function unassignSalesStaff(adminId: string, farmId: string, salesStaffId: string): Promise<void> {
  if (!(await removeAssignment(adminId, farmId, salesStaffId))) {
    throw NotFoundError('Sales Staff này không được gán vào farm')
  }
}

// ── Duyệt đề xuất Sales Staff của Farm Owner — AUTH-FR-005d, Flow 16 bước 1b ───

export interface ListSalesStaffRequestsQuery extends ListQuery {
  status?: SalesAssignmentRequestStatus
  type?: SalesAssignmentRequestType
}

export async function listSalesStaffRequests(query: ListSalesStaffRequestsQuery) {
  const filter: Record<string, unknown> = {}
  if (query.status) filter.status = query.status
  // ADD gồm cả request cũ chưa có field `type`
  if (query.type) filter.type = query.type === 'REMOVE' ? 'REMOVE' : { $ne: 'REMOVE' }
  const { page, skip, limit } = paginate(query.page, query.limit)

  const [records, total] = await Promise.all([
    SalesAssignmentRequest.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit)
      .populate('farm_id', 'name region')
      .populate('requested_by', 'full_name email')
      .populate('sales_staff_id', 'full_name email')
      .populate('reviewed_by', 'full_name email')
      .lean(),
    SalesAssignmentRequest.countDocuments(filter),
  ])
  return { records, total, page, limit }
}

function assertSalesStaff(user: IUser): IUser {
  if (user.role !== 'SALES_STAFF') {
    throw ConflictError(`Email này thuộc tài khoản ${user.role}, không thể gán làm Sales Staff`)
  }
  return user
}

/**
 * Email chưa có tài khoản thì tạo mới với mật khẩu ngẫu nhiên rồi gửi mã đặt
 * lại mật khẩu (tái dùng luồng quên mật khẩu AUTH-FR-009) — Admin không cần
 * biết hay chuyển mật khẩu cho ai. Không tự đổi role nếu email đã thuộc
 * Farm Owner/Technician: đổi role ngầm sẽ tước quyền cũ của họ.
 */
async function findOrCreateSalesStaff(adminId: string, email: string): Promise<IUser> {
  const existing = await User.findOne({ email })
  if (existing) return assertSalesStaff(existing)

  try {
    const user = await User.create({
      email,
      password_hash: crypto.randomBytes(24).toString('hex'),
      full_name: email.split('@')[0],
      role: 'SALES_STAFF',
    })
    await forgotPassword(email)
    await logAction(adminId, 'USER_CREATED', 'user', String(user._id), { role: 'SALES_STAFF', via: 'SALES_STAFF_REQUEST' })
    return user
  } catch (err) {
    if ((err as { code?: number }).code !== DUPLICATE_KEY) throw err
    // Admin khác vừa duyệt cùng email gần như đồng thời — dùng tài khoản họ vừa tạo
    const raced = await User.findOne({ email })
    if (!raced) throw err
    return assertSalesStaff(raced)
  }
}

/** Đề xuất đã "duyệt" nhưng chưa có tác dụng gì mà im lặng quá lâu = tiến trình xử lý đã chết giữa chừng */
const STUCK_APPROVAL_MS = 60_000

async function approvalEffectsApplied(request: ISalesAssignmentRequest): Promise<boolean> {
  if (request.type === 'REMOVE') {
    return !(await SalesAssignment.exists({ farm_id: request.farm_id, sales_staff_id: request.sales_staff_id }))
  }
  return Boolean(await SalesAssignment.exists({ requested_via: request._id }))
}

export async function decideSalesStaffRequest(
  adminId: string, requestId: string, decision: 'APPROVED' | 'REJECTED', reason?: string,
): Promise<ISalesAssignmentRequest> {
  const trimmedReason = reason?.trim()
  if (decision === 'REJECTED' && !trimmedReason) {
    throw BadRequestError('Phải nhập lý do khi từ chối đề xuất')
  }

  const existing = await SalesAssignmentRequest.findById(requestId)
  if (!existing) throw NotFoundError('Không tìm thấy đề xuất')
  const isRemoval = existing.type === 'REMOVE'

  // Đề xuất đã "duyệt" mà tiến trình xử lý chết trước khi tạo được gì (không còn ai sửa được) thì duyệt lại
  // sau STUCK_APPROVAL_MS sẽ làm nốt phần còn thiếu. Trong khoảng đó người thứ hai vẫn nhận 409 — tức đang xử lý.
  let resumed = false
  if (existing.status !== 'PENDING') {
    const staleApproval = decision === 'APPROVED' && existing.status === 'APPROVED'
      && existing.reviewed_at !== undefined && Date.now() - existing.reviewed_at.getTime() > STUCK_APPROVAL_MS
    resumed = staleApproval && !(await approvalEffectsApplied(existing))
    if (!resumed) throw ConflictError(`Đề xuất này đã được xử lý (${existing.status})`)
  }

  // Mọi điều kiện biết trước được phải kiểm tra TRƯỚC khi nhận quyền xử lý: lỗi ở đây để đề xuất còn PENDING
  const farm = await Farm.findById(existing.farm_id).select('name').lean() // hook tự loại farm đã xoá mềm
  if (decision === 'APPROVED' && !isRemoval) {
    if (!farm) throw ConflictError('Farm của đề xuất này không còn tồn tại')
    const account = await User.findOne({ email: existing.sales_staff_email })
    if (account) assertSalesStaff(account)
  }

  // Nhận quyền xử lý NGUYÊN TỬ trước khi tạo/xoá bất cứ thứ gì: hai Admin bấm gần như đồng thời (kể cả một
  // duyệt, một từ chối) thì chỉ người thắng được chạm vào tài khoản/phân công; người thua nhận 409 mà không
  // để lại tác dụng phụ nào.
  let request: ISalesAssignmentRequest = existing
  if (!resumed) {
    const claimed = await SalesAssignmentRequest.findOneAndUpdate(
      { _id: requestId, status: 'PENDING' },
      {
        status: decision,
        reviewed_by: adminId,
        reviewed_at: new Date(),
        ...(trimmedReason ? { review_note: trimmedReason } : {}),
      },
      { new: true },
    )
    if (!claimed) {
      const current = await SalesAssignmentRequest.findById(requestId).select('status').lean()
      throw ConflictError(`Đề xuất này đã được xử lý (${current?.status ?? 'không rõ'})`)
    }
    request = claimed
  }

  try {
    if (decision === 'APPROVED') {
      if (isRemoval) {
        // Đã gỡ từ trước (VD Admin gỡ thẳng) thì coi như xong — không báo lỗi, thao tác idempotent
        await removeAssignment(adminId, request.farm_id, request.sales_staff_id, { requestedVia: requestId })
      } else {
        const salesStaff = await findOrCreateSalesStaff(adminId, request.sales_staff_email)
        await SalesAssignment.findOneAndUpdate(
          { farm_id: request.farm_id, sales_staff_id: salesStaff._id },
          { $setOnInsert: { invited_by: request.requested_by, requested_via: request._id } },
          { upsert: true },
        )
      }
    }
  } catch (err) {
    // Trả về PENDING để Admin xử lý lại (hoặc từ chối) thay vì kẹt ở "đã duyệt" mà chưa có gì được tạo. Lỗi hoàn
    // tác chỉ được ghi log: nếu ném ra sẽ che mất lỗi gốc; đề xuất kẹt lại sẽ được duyệt lại sau STUCK_APPROVAL_MS.
    if (!resumed) {
      await SalesAssignmentRequest.updateOne(
        { _id: requestId, status: decision, reviewed_by: adminId },
        { $set: { status: 'PENDING' }, $unset: { reviewed_by: 1, reviewed_at: 1, review_note: 1 } },
      ).catch(rollbackErr => logger.error('Không hoàn tác được trạng thái đề xuất sau khi xử lý lỗi', { rollbackErr, requestId }))
    }
    throw err
  }

  await logAction(adminId, `SALES_STAFF_REQUEST_${decision}`, 'sales_assignment_request', requestId, {
    type: isRemoval ? 'REMOVE' : 'ADD', resumed,
    farm_id: String(request.farm_id), email: request.sales_staff_email, reason: request.review_note,
  })

  // Flow 16 bước 1b/1d/1e — Farm Owner nhận kết quả (kèm lý do nếu bị từ chối)
  const farmName = farm?.name ?? 'của bạn'
  const email = request.sales_staff_email
  const message = isRemoval
    ? decision === 'APPROVED'
      ? { title: 'Yêu cầu gỡ Sales Staff đã được duyệt', body: `${email} đã được gỡ khỏi farm ${farmName}.` }
      : { title: 'Yêu cầu gỡ Sales Staff bị từ chối', body: `Yêu cầu gỡ ${email} khỏi farm ${farmName} bị từ chối. Lý do: ${request.review_note}.` }
    : decision === 'APPROVED'
      ? { title: 'Đề xuất Sales Staff đã được duyệt', body: `${email} đã được gán làm Sales Staff cho farm ${farmName}.` }
      : {
        title: 'Đề xuất Sales Staff bị từ chối',
        body: `Đề xuất ${email} cho farm ${farmName} bị từ chối. Lý do: ${request.review_note}. Bạn có thể đề xuất lại với email khác.`,
      }
  await notifyUser(String(request.requested_by), message)
  return request
}
