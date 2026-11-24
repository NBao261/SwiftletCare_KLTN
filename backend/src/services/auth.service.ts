import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { User, IUser, canSignIn } from '@/models/user.model'
import { logAction } from '@/services/auditLog.service'
import { resetCodeMail, sendMail } from '@/services/mail.service'
import { notifyAdmins } from '@/services/notification.service'
import { criticalHasOutsideChannel } from '@/utils/notificationChannels.util'
import { ROLE_LABEL } from '@/utils/displayLabel.util'
import type { AlertSeverity, ChannelChoice, JwtAccessPayload, NotificationPreferences } from '@/types'
import { AppError, BadRequestError, ForbiddenError, UnauthorizedError } from '@/utils/appError.util'

const ACCESS_TTL  = process.env.JWT_ACCESS_TTL  ?? '15m'
const REFRESH_TTL = process.env.JWT_REFRESH_TTL ?? '30d'
const REFRESH_TTL_MS = 30 * 86400 * 1000

// Tránh 'User@Test.com' và 'user@test.com' thành 2 tài khoản
const normalizeEmail = (email: string) => email.toLowerCase().trim()

// Lộ DB cũng không lấy được mã còn hiệu lực
const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex')

// Hash giả: giữ thời gian bcrypt khi email không tồn tại, không lộ email qua thời gian phản hồi
const DUMMY_BCRYPT_HASH = '$2a$12$CwTycUXWue0Thq9StjUM0uJ8g/qXY7jkNwptbCFmehyoNwaN9pmlq'

function signAccess(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role }, process.env.JWT_ACCESS_SECRET!, { expiresIn: ACCESS_TTL } as jwt.SignOptions)
}

function signRefresh(userId: string): string {
  // jwtid: 2 lần đăng nhập cùng giây không trùng token, không thì logout máy này gỡ phiên máy kia
  return jwt.sign({ sub: userId }, process.env.JWT_REFRESH_SECRET!, { expiresIn: REFRESH_TTL, jwtid: crypto.randomUUID() } as jwt.SignOptions)
}

// Dọn token hết hạn ở đây, không thì mảng lớn dần
function issueRefreshToken(user: IUser): string {
  const token = signRefresh(String(user._id))
  const now = Date.now()
  user.refresh_tokens = user.refresh_tokens.filter(t => t.expires.getTime() > now) as never
  user.refresh_tokens.push({ token_hash: hashToken(token), expires: new Date(now + REFRESH_TTL_MS) })
  return token
}

export interface LoginInput { email: string; password: string }

// Chỉ gọi sau khi xác thực danh tính: người đoán mò không dò được trạng thái tài khoản
async function assertLoginAllowed(user: IUser): Promise<void> {
  if (canSignIn(user)) return

  await logAction(String(user._id), 'LOGIN_FAILED', 'user', String(user._id), { reason: 'ACCOUNT_DISABLED' })
  const reason = user.locked_reason ?? null
  throw new AppError(
    403, 'ACCOUNT_DISABLED',
    reason ? `Tài khoản đã bị khoá. Lý do: ${reason}` : 'Tài khoản đã bị khoá',
    { reason },
  )
}

// Client đọc lại sau thay đổi không qua màn của nó (liên kết Telegram qua bot, yêu cầu xoá)
export async function getCurrentUser(userId: string): Promise<IUser> {
  const user = await User.findById(userId)
  if (!user) throw UnauthorizedError('Tài khoản không còn tồn tại')
  return user
}

export async function loginUser(input: LoginInput): Promise<{ user: IUser; accessToken: string; refreshToken: string }> {
  const user = await User.findOne({ email: normalizeEmail(input.email) })
  const passwordMatches = user
    ? await user.comparePassword(input.password)
    : await bcrypt.compare(input.password, DUMMY_BCRYPT_HASH)
  if (!user || !passwordMatches) {
    // Không ghi email lạ vào log (PII)
    const userId = user ? String(user._id) : undefined
    await logAction(userId, 'LOGIN_FAILED', 'user', userId, { reason: user ? 'WRONG_PASSWORD' : 'UNKNOWN_EMAIL' })
    throw UnauthorizedError('Sai email hoặc mật khẩu')
  }
  await assertLoginAllowed(user)

  const accessToken  = signAccess(String(user._id), user.role)
  const refreshToken = issueRefreshToken(user)
  await user.save()

  await logAction(String(user._id), 'LOGIN', 'user', String(user._id))
  return { user, accessToken, refreshToken }
}

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

  const tokenHash = hashToken(refreshToken)
  const isValid = user.refresh_tokens.some(t => t.token_hash === tokenHash && t.expires > new Date())
  if (!isValid) throw UnauthorizedError('Refresh token đã bị thu hồi hoặc hết hạn')

  return { accessToken: signAccess(String(user._id), user.role) }
}

export async function logoutUser(userId: string, refreshToken: string | undefined): Promise<void> {
  if (refreshToken) {
    await User.updateOne({ _id: userId }, { $pull: { refresh_tokens: { token_hash: hashToken(refreshToken) } } })
  }
}

const RESET_TOKEN_TTL_MS = 15 * 60 * 1000

// Im lặng khi email không tồn tại: không thành công cụ dò tài khoản
export async function forgotPassword(email: string): Promise<void> {
  const user = await User.findOne({ email: normalizeEmail(email) })
  if (!user) return

  const token = crypto.randomInt(100000, 999999).toString()
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS)
  user.password_reset_token_hash = hashToken(token)
  user.password_reset_expires_at = expiresAt
  await user.save()

  // Không chờ SMTP: chờ thì lộ tài khoản qua thời gian phản hồi. Mã không ghi log
  void sendMail(resetCodeMail({ to: user.email, code: token, expiresAt }))
}

// Thu hồi mọi refresh token: tài khoản bị chiếm thì phải đá kẻ kia khỏi mọi thiết bị
export async function resetPassword(email: string, token: string, newPassword: string): Promise<void> {
  // select: false nên phải xin lại tường minh
  const user = await User.findOne({ email: normalizeEmail(email) })
    .select('+password_reset_token_hash +password_reset_expires_at')
  if (
    !user ||
    !user.password_reset_token_hash ||
    user.password_reset_token_hash !== hashToken(token) ||
    !user.password_reset_expires_at ||
    user.password_reset_expires_at < new Date()
  ) {
    throw new AppError(400, 'INVALID_RESET_TOKEN', 'Mã đặt lại không đúng hoặc đã hết hạn')
  }

  user.password_hash = newPassword
  user.password_reset_token_hash = undefined
  user.password_reset_expires_at = undefined
  // Hết là mật khẩu tạm
  user.must_change_password = false
  user.refresh_tokens = [] as never
  await user.save()

  await logAction(String(user._id), 'PASSWORD_RESET', 'user', String(user._id))
}

// Giữ phiên đang dùng. Sai mật khẩu hiện tại trả 400, vì 401 làm client tưởng token hết hạn
export async function changePassword(
  userId: string, currentPassword: string, newPassword: string, currentRefreshToken?: string,
): Promise<void> {
  const user = await User.findById(userId)
  if (!user) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy người dùng')
  if (!(await user.comparePassword(currentPassword))) {
    throw new AppError(400, 'INVALID_CURRENT_PASSWORD', 'Mật khẩu hiện tại không đúng')
  }
  if (await user.comparePassword(newPassword)) {
    throw new AppError(400, 'PASSWORD_UNCHANGED', 'Mật khẩu mới phải khác mật khẩu hiện tại')
  }

  user.password_hash = newPassword
  user.must_change_password = false
  const keep = currentRefreshToken ? hashToken(currentRefreshToken) : null
  user.refresh_tokens = user.refresh_tokens.filter(t => t.token_hash === keep) as never
  await user.save()

  await logAction(userId, 'PASSWORD_CHANGED', 'user', userId)
}

const SEVERITIES: AlertSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

export interface NotificationPreferencesInput {
  push?: boolean
  telegram?: boolean
  quiet_hours?: { start?: string; end?: string }
  // null = bỏ ghi đè
  by_severity?: Partial<Record<AlertSeverity, ChannelChoice | null>>
}

// CRITICAL phải còn 1 kênh ngoài ứng dụng (400). Domain Expert, Admin không chọn kênh; chỉ Farm Owner đặt giờ im lặng (403)
export async function updateNotificationPreferences(userId: string, input: NotificationPreferencesInput): Promise<IUser> {
  const user = await User.findById(userId)
  if (!user) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy người dùng')
  if (user.role !== 'FARM_OWNER' && user.role !== 'FARM_TECHNICIAN') {
    throw ForbiddenError('Tài khoản này chỉ nhận thông báo trong ứng dụng nên không chọn kênh')
  }
  if (input.quiet_hours && user.role !== 'FARM_OWNER') throw ForbiddenError('Chỉ Chủ nhà yến đặt giờ im lặng')

  const current = user.toObject().notification_preferences
  const bySeverity: Partial<Record<AlertSeverity, ChannelChoice>> = { ...current.by_severity }
  for (const severity of SEVERITIES) {
    if (!input.by_severity || !(severity in input.by_severity)) continue
    const choice = input.by_severity[severity]
    if (choice === null || choice === undefined) delete bySeverity[severity]
    else bySeverity[severity] = { ...bySeverity[severity], ...choice }
  }
  const next: NotificationPreferences = {
    push: input.push ?? current.push,
    telegram: input.telegram ?? current.telegram,
    quiet_hours: { ...current.quiet_hours, ...input.quiet_hours },
    by_severity: bySeverity,
  }
  if (!criticalHasOutsideChannel(next, !!user.telegram_chat_id)) {
    throw BadRequestError('Cảnh báo CRITICAL phải còn ít nhất một kênh ngoài ứng dụng (push, hoặc Telegram đã liên kết)')
  }
  user.notification_preferences = next
  await user.save()
  return user
}

// Chỉ đánh dấu: Admin xoá thật sau khi xử lý farm của họ
export async function requestAccountDeletion(userId: string): Promise<IUser> {
  const user = await User.findById(userId)
  if (!user) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy người dùng')
  if (user.deletion_requested_at) {
    throw new AppError(409, 'CONFLICT', 'Bạn đã gửi yêu cầu xoá tài khoản trước đó, đang chờ xử lý')
  }

  user.status = 'DELETION_REQUESTED'
  user.deletion_requested_at = new Date()
  await user.save()

  await logAction(userId, 'DELETION_REQUESTED', 'user', userId)
  await notifyAdmins({
    title: 'Yêu cầu xoá tài khoản mới',
    body: `${user.full_name} (${ROLE_LABEL[user.role]}) vừa gửi yêu cầu xoá tài khoản. Cần xử lý trong 30 ngày.`,
  })
  return user
}

export async function cancelAccountDeletion(userId: string): Promise<IUser> {
  const user = await User.findById(userId)
  if (!user) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy người dùng')
  if (!user.deletion_requested_at) {
    throw new AppError(409, 'CONFLICT', 'Bạn chưa gửi yêu cầu xoá tài khoản nào')
  }

  // tài khoản đang bị khoá vẫn khoá
  if (user.status === 'DELETION_REQUESTED') user.status = 'ACTIVE'
  user.deletion_requested_at = undefined
  user.deletion_reminder_sent_at = undefined
  await user.save()

  await logAction(userId, 'DELETION_CANCELLED', 'user', userId)
  // Báo để Admin không xử lý nhầm yêu cầu vừa rút lại
  await notifyAdmins({
    title: 'Yêu cầu xoá tài khoản đã được huỷ',
    body: `${user.full_name} (${ROLE_LABEL[user.role]}) đã huỷ yêu cầu xoá tài khoản.`,
  })
  return user
}
