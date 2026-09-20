import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { User, IUser } from '@/models/user.model'
import { Farm } from '@/models/farm.model'
import { Invitation } from '@/models/invitation.model'
import { SalesAssignment } from '@/models/salesAssignment.model'
import { logAction } from '@/services/auditLog.service'
import { notifyAdmins } from '@/services/notification.service'
import type { JwtAccessPayload } from '@/types'
import { AppError, ConflictError, UnauthorizedError } from '@/utils/appError.util'

const ACCESS_TTL  = process.env.JWT_ACCESS_TTL  ?? '15m'
const REFRESH_TTL = process.env.JWT_REFRESH_TTL ?? '30d'
const REFRESH_TTL_MS = 30 * 86400 * 1000

/** Chuẩn hoá email dùng nhất quán ở MỌI nơi tra cứu/lưu — tránh 'User@Test.com'
 *  và 'user@test.com' bị coi là 2 tài khoản khác nhau. */
const normalizeEmail = (email: string) => email.toLowerCase().trim()

/** Hash 1 chiều (sha256) cho mã dùng 1 lần — OTP đăng nhập và token reset mật
 *  khẩu đều dùng chung, để lộ DB đọc cũng không lấy được mã gốc còn hiệu lực. */
const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex')

function signAccess(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: ACCESS_TTL } as jwt.SignOptions)
}

function signRefresh(userId: string): string {
  return jwt.sign({ sub: userId }, process.env.JWT_REFRESH_SECRET!, { expiresIn: REFRESH_TTL } as jwt.SignOptions)
}

export interface RegisterInput { email: string; password: string; full_name: string; phone?: string }
export interface LoginInput { email: string; password: string }

/** AUTH-FR-001 */
export async function registerUser(input: RegisterInput): Promise<IUser> {
  const normalizedEmail = normalizeEmail(input.email)
  const existing = await User.findOne({ email: normalizedEmail })
  if (existing) throw ConflictError('Email đã được đăng ký')

  // Flow 12 bước 3b — nếu email trùng một lời mời PENDING còn hạn, người dùng
  // nhận thẳng vai trò được mời (thay vì mặc định FARM_OWNER) và lời mời tự
  // động được accept ngay khi đăng ký xong, không cần thao tác thêm.
  const invitation = await Invitation.findOne({
    invited_email: normalizedEmail,
    status: 'PENDING',
    expires_at: { $gt: new Date() },
  })

  const user = new User({
    // Lưu dạng đã chuẩn hoá — nếu lưu input.email thô, dup-check ở trên (query
    // theo normalizedEmail) sẽ không khớp lần đăng ký sau với case khác, tạo
    // được 2 tài khoản cho cùng 1 email thật.
    email: normalizedEmail,
    password_hash: input.password, // hash tự động qua pre-save hook (User.ts)
    full_name: input.full_name,
    phone: input.phone,
    ...(invitation ? { role: invitation.invited_role } : {}),
  })
  await user.save()

  if (invitation) {
    invitation.status = 'ACCEPTED'
    invitation.responded_at = new Date()
    await invitation.save()

    if (invitation.invited_role === 'SALES_STAFF') {
      await SalesAssignment.findOneAndUpdate(
        { farm_id: invitation.farm_id, sales_staff_id: user._id },
        { $setOnInsert: { invited_by: invitation.invited_by } },
        { upsert: true },
      )
    } else {
      await Farm.findByIdAndUpdate(invitation.farm_id, {
        $addToSet: { members: { user_id: user._id, is_primary: false, joined_at: new Date() } },
      })
    }
  }

  return user
}

/** AUTH-FR-002, AUTH-FR-003 */
export async function loginUser(input: LoginInput): Promise<{ user: IUser; accessToken: string; refreshToken: string }> {
  const user = await User.findOne({ email: normalizeEmail(input.email) })
  if (!user || !(await user.comparePassword(input.password))) {
    // Email không tồn tại thì không ghi email vào log (SRS §12.3 — không lưu PII thô trong audit log)
    const userId = user ? String(user._id) : undefined
    await logAction(userId, 'LOGIN_FAILED', 'user', userId, { reason: user ? 'WRONG_PASSWORD' : 'UNKNOWN_EMAIL' })
    throw UnauthorizedError('Sai email hoặc mật khẩu')
  }
  // Chỉ báo lý do khoá SAU khi mật khẩu đúng (Flow 19 bước 4) — người đoán mò
  // mật khẩu không biết được tài khoản có bị khoá hay không.
  if (!user.is_active) {
    await logAction(String(user._id), 'LOGIN_FAILED', 'user', String(user._id), { reason: 'ACCOUNT_DISABLED' })
    const reason = user.deactivated_reason ?? null
    throw new AppError(
      403, 'ACCOUNT_DISABLED',
      reason ? `Tài khoản đã bị khoá. Lý do: ${reason}` : 'Tài khoản đã bị khoá',
      { reason },
    )
  }

  const accessToken  = signAccess(String(user._id), user.role)
  const refreshToken = signRefresh(String(user._id))

  user.refresh_tokens.push({ token: refreshToken, expires: new Date(Date.now() + REFRESH_TTL_MS) })
  await user.save()

  await logAction(String(user._id), 'LOGIN', 'user', String(user._id))
  return { user, accessToken, refreshToken }
}

/** AUTH-FR-003 */
export async function refreshAccessToken(refreshToken: string | undefined): Promise<{ accessToken: string }> {
  if (!refreshToken) throw UnauthorizedError('Thiếu refresh token')

  let payload: JwtAccessPayload
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as JwtAccessPayload
  } catch {
    throw UnauthorizedError('Refresh token không hợp lệ')
  }

  const user = await User.findById(payload.sub)
  if (!user) throw UnauthorizedError('Không tìm thấy user')

  const isValid = user.refresh_tokens.some(t => t.token === refreshToken && t.expires > new Date())
  if (!isValid) throw UnauthorizedError('Refresh token đã bị thu hồi hoặc hết hạn')

  return { accessToken: signAccess(String(user._id), user.role) }
}

/** AUTH-FR-006 */
export async function logoutUser(userId: string, refreshToken: string | undefined): Promise<void> {
  if (refreshToken) {
    await User.updateOne({ _id: userId }, { $pull: { refresh_tokens: { token: refreshToken } } })
  }
}

/** AUTH-FR-001/005 – gửi OTP (không tiết lộ email có tồn tại hay không) */
export async function sendOtp(email: string): Promise<void> {
  const user = await User.findOne({ email: normalizeEmail(email) })
  if (!user) return // im lặng, tránh dò email tồn tại

  const otp = crypto.randomInt(100000, 999999).toString()
  // Hash trước khi lưu — giống token reset mật khẩu, tránh lộ DB đọc là dùng
  // được OTP còn hiệu lực để đăng nhập (khác trước đây lưu thẳng plaintext).
  user.otp_code = hashToken(otp)
  user.otp_expires = new Date(Date.now() + 10 * 60 * 1000)
  await user.save()

  // TODO: gửi thật qua SMTP / Zalo ZNS (ALERT-FR-003) — hiện chỉ log ở dev
  // eslint-disable-next-line no-console
  console.log(`[DEV OTP] ${email} → ${otp}`)
}

/** AUTH-FR-001/005 */
export async function verifyOtp(email: string, otp: string): Promise<{ user: IUser; accessToken: string }> {
  const user = await User.findOne({ email: normalizeEmail(email) })
  if (!user || user.otp_code !== hashToken(otp) || !user.otp_expires || user.otp_expires < new Date()) {
    throw new AppError(400, 'INVALID_OTP', 'OTP không đúng hoặc đã hết hạn')
  }

  user.otp_code = undefined
  user.otp_expires = undefined
  await user.save()

  return { user, accessToken: signAccess(String(user._id), user.role) }
}

/** AUTH-FR-009 — TTL 15 phút, dùng 1 lần (Flow 11 bước 6) */
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000

/**
 * AUTH-FR-009 — gửi mã đặt lại mật khẩu. Im lặng khi email không tồn tại để
 * không biến endpoint này thành công cụ dò tài khoản (Flow 11 case 1a).
 */
export async function forgotPassword(email: string): Promise<void> {
  const user = await User.findOne({ email: normalizeEmail(email) })
  if (!user) return

  const token = crypto.randomInt(100000, 999999).toString()
  user.password_reset_token_hash = hashToken(token)
  user.password_reset_expires_at = new Date(Date.now() + RESET_TOKEN_TTL_MS)
  await user.save()

  // TODO(E6): gửi thật qua SMTP/Zalo — hiện log ở dev như luồng OTP
  // eslint-disable-next-line no-console
  console.log(`[DEV RESET] ${email} → ${token}`)
}

/**
 * AUTH-FR-009 — đặt mật khẩu mới. Thu hồi TOÀN BỘ refresh token cũ: nếu tài
 * khoản bị chiếm, đổi mật khẩu phải đá kẻ kia ra khỏi mọi thiết bị, không chỉ
 * chặn đăng nhập mới (Flow 11 bước 7).
 */
export async function resetPassword(email: string, token: string, newPassword: string): Promise<void> {
  const user = await User.findOne({ email: normalizeEmail(email) })
  if (
    !user ||
    !user.password_reset_token_hash ||
    user.password_reset_token_hash !== hashToken(token) ||
    !user.password_reset_expires_at ||
    user.password_reset_expires_at < new Date()
  ) {
    throw new AppError(400, 'INVALID_RESET_TOKEN', 'Mã đặt lại không đúng hoặc đã hết hạn')
  }

  user.password_hash = newPassword // pre-save hook tự hash (SEC-NFR-003)
  user.password_reset_token_hash = undefined
  user.password_reset_expires_at = undefined
  user.refresh_tokens = [] as never
  await user.save()

  await logAction(String(user._id), 'PASSWORD_RESET', 'user', String(user._id))
}

/** ALERT-FR-005/006 — Farm Owner chọn kênh nhận thông báo + giờ im lặng */
export async function updateNotificationPreferences(
  userId: string,
  prefs: Partial<{ push: boolean; zalo: boolean; sms: boolean; quiet_hours: { start: string; end: string } }>,
): Promise<IUser> {
  const user = await User.findById(userId)
  if (!user) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy người dùng')

  user.notification_preferences = {
    ...user.notification_preferences,
    ...prefs,
    quiet_hours: { ...user.notification_preferences.quiet_hours, ...prefs.quiet_hours },
  }
  await user.save()
  return user
}

/**
 * AUTH-FR-012 / PRIV-NFR-003 — user tự yêu cầu xoá tài khoản. Chỉ ĐÁNH DẤU,
 * việc xoá thật do Administrator xử lý trong ≤30 ngày (Flow 19) vì còn phải
 * kiểm tra ràng buộc Farm/Order dở dang trước khi xoá.
 */
export async function requestAccountDeletion(userId: string): Promise<IUser> {
  const user = await User.findById(userId)
  if (!user) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy người dùng')
  if (user.deletion_requested_at) {
    throw new AppError(409, 'CONFLICT', 'Bạn đã gửi yêu cầu xoá tài khoản trước đó, đang chờ xử lý')
  }

  user.deletion_requested_at = new Date()
  await user.save()

  await logAction(userId, 'DELETION_REQUESTED', 'user', userId)
  // Flow 19 bước 6 — Administrator nhận thông báo để xử lý trong ≤ 30 ngày
  await notifyAdmins({
    title: 'Yêu cầu xoá tài khoản mới',
    body: `${user.full_name} (${user.role ?? 'Buyer'}) vừa gửi yêu cầu xoá tài khoản — cần xử lý trong ≤ 30 ngày.`,
  })
  return user
}
