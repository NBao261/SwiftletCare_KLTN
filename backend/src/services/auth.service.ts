import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { User, IUser } from '@/models/user.model'
import type { JwtAccessPayload } from '@/types'
import { AppError, ConflictError, UnauthorizedError } from '@/utils/appError.util'

const ACCESS_TTL  = process.env.JWT_ACCESS_TTL  ?? '15m'
const REFRESH_TTL = process.env.JWT_REFRESH_TTL ?? '30d'
const REFRESH_TTL_MS = 30 * 86400 * 1000

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
  const existing = await User.findOne({ email: input.email })
  if (existing) throw ConflictError('Email đã được đăng ký')

  const user = new User({
    email: input.email,
    password_hash: input.password, // hash tự động qua pre-save hook (User.ts)
    full_name: input.full_name,
    phone: input.phone,
  })
  await user.save()
  return user
}

/** AUTH-FR-002, AUTH-FR-003 */
export async function loginUser(input: LoginInput): Promise<{ user: IUser; accessToken: string; refreshToken: string }> {
  const user = await User.findOne({ email: input.email })
  if (!user || !(await user.comparePassword(input.password))) {
    throw UnauthorizedError('Sai email hoặc mật khẩu')
  }
  if (!user.is_active) throw new AppError(403, 'ACCOUNT_DISABLED', 'Tài khoản đã bị khóa')

  const accessToken  = signAccess(String(user._id), user.role)
  const refreshToken = signRefresh(String(user._id))

  user.refresh_tokens.push({ token: refreshToken, expires: new Date(Date.now() + REFRESH_TTL_MS) })
  await user.save()

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
  const user = await User.findOne({ email })
  if (!user) return // im lặng, tránh dò email tồn tại

  const otp = crypto.randomInt(100000, 999999).toString()
  user.otp_code = otp
  user.otp_expires = new Date(Date.now() + 10 * 60 * 1000)
  await user.save()

  // TODO: gửi thật qua SMTP / Zalo ZNS (ALERT-FR-003) — hiện chỉ log ở dev
  // eslint-disable-next-line no-console
  console.log(`[DEV OTP] ${email} → ${otp}`)
}

/** AUTH-FR-001/005 */
export async function verifyOtp(email: string, otp: string): Promise<{ user: IUser; accessToken: string }> {
  const user = await User.findOne({ email })
  if (!user || user.otp_code !== otp || !user.otp_expires || user.otp_expires < new Date()) {
    throw new AppError(400, 'INVALID_OTP', 'OTP không đúng hoặc đã hết hạn')
  }

  user.otp_code = undefined
  user.otp_expires = undefined
  await user.save()

  return { user, accessToken: signAccess(String(user._id), user.role) }
}
