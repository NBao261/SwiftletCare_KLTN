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
