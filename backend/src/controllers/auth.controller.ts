import { Request, Response, NextFunction } from 'express'
import * as authService from '@/services/auth.service'

const REFRESH_COOKIE_MAX_AGE = 30 * 86400 * 1000

function setRefreshCookie(res: Response, token: string): void {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge:   REFRESH_COOKIE_MAX_AGE,
  })
}

/** POST /auth/register – AUTH-FR-001 */
export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await authService.registerUser(req.body)
    res.status(201).json({ success: true, data: user })
  } catch (err) { next(err) }
}

/** POST /auth/login – AUTH-FR-002 */
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { user, accessToken, refreshToken } = await authService.loginUser(req.body)
    setRefreshCookie(res, refreshToken)
    res.json({ success: true, data: { accessToken, user } })
  } catch (err) { next(err) }
}

/** POST /auth/refresh – AUTH-FR-003 */
export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = (req.cookies as Record<string, string | undefined>)?.refreshToken
    const { accessToken } = await authService.refreshAccessToken(token)
    res.json({ success: true, data: { accessToken } })
  } catch (err) { next(err) }
}

/** POST /auth/logout – AUTH-FR-006 */
export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = (req.cookies as Record<string, string | undefined>)?.refreshToken
    await authService.logoutUser(req.user._id, token)
    res.clearCookie('refreshToken')
    res.json({ success: true, data: { message: 'Đã đăng xuất' } })
  } catch (err) { next(err) }
}

/** POST /auth/otp/send – AUTH-FR-005 */
export async function sendOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email } = req.body as { email: string }
    await authService.sendOtp(email)
    res.json({ success: true, data: { message: 'Nếu email tồn tại, OTP đã được gửi' } })
  } catch (err) { next(err) }
}

/** POST /auth/otp/verify – AUTH-FR-005 */
export async function verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, otp } = req.body as { email: string; otp: string }
    const { user, accessToken } = await authService.verifyOtp(email, otp)
    res.json({ success: true, data: { accessToken, user } })
  } catch (err) { next(err) }
}

/** POST /auth/forgot-password – AUTH-FR-009, Flow 11 bước 6 */
export async function forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.forgotPassword(req.body.email as string)
    res.json({ success: true, data: { message: 'Nếu email tồn tại, mã đặt lại mật khẩu đã được gửi' } })
  } catch (err) { next(err) }
}

/** POST /auth/reset-password – AUTH-FR-009, Flow 11 bước 7 */
export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, token, newPassword } = req.body as { email: string; token: string; newPassword: string }
    await authService.resetPassword(email, token, newPassword)
    res.json({ success: true, data: { message: 'Đã đổi mật khẩu, vui lòng đăng nhập lại' } })
  } catch (err) { next(err) }
}

/** PUT /auth/notification-preferences – ALERT-FR-005/006 */
export async function updateNotificationPreferences(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await authService.updateNotificationPreferences(req.user._id, req.body)
    res.json({ success: true, data: user })
  } catch (err) { next(err) }
}

/** POST /auth/delete-request – AUTH-FR-012, PRIV-NFR-003 */
export async function requestDeletion(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await authService.requestAccountDeletion(req.user._id)
    res.json({ success: true, data: { message: 'Đã ghi nhận yêu cầu xoá tài khoản, sẽ xử lý trong tối đa 30 ngày' } })
  } catch (err) { next(err) }
}
