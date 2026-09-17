import { Request, Response } from 'express'
import * as authService from '@/services/auth.service'
import { asyncHandler } from '@/utils/asyncHandler.util'

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
export const register = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.registerUser(req.body)
  res.status(201).json({ success: true, data: user })
})

/** POST /auth/login – AUTH-FR-002 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { user, accessToken, refreshToken } = await authService.loginUser(req.body)
  setRefreshCookie(res, refreshToken)
  res.json({ success: true, data: { accessToken, user } })
})

/** POST /auth/refresh – AUTH-FR-003 */
export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = (req.cookies as Record<string, string | undefined>)?.refreshToken
  const { accessToken } = await authService.refreshAccessToken(token)
  res.json({ success: true, data: { accessToken } })
})

/** POST /auth/logout – AUTH-FR-006 */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = (req.cookies as Record<string, string | undefined>)?.refreshToken
  await authService.logoutUser(req.user._id, token)
  res.clearCookie('refreshToken')
  res.json({ success: true, data: { message: 'Đã đăng xuất' } })
})

/** POST /auth/otp/send – AUTH-FR-005 */
export const sendOtp = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as { email: string }
  await authService.sendOtp(email)
  res.json({ success: true, data: { message: 'Nếu email tồn tại, OTP đã được gửi' } })
})

/** POST /auth/otp/verify – AUTH-FR-005 */
export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const { email, otp } = req.body as { email: string; otp: string }
  const { user, accessToken } = await authService.verifyOtp(email, otp)
  res.json({ success: true, data: { accessToken, user } })
})

/** POST /auth/forgot-password – AUTH-FR-009, Flow 11 bước 6 */
export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.forgotPassword(req.body.email as string)
  res.json({ success: true, data: { message: 'Nếu email tồn tại, mã đặt lại mật khẩu đã được gửi' } })
})

/** POST /auth/reset-password – AUTH-FR-009, Flow 11 bước 7 */
export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email, token, newPassword } = req.body as { email: string; token: string; newPassword: string }
  await authService.resetPassword(email, token, newPassword)
  res.json({ success: true, data: { message: 'Đã đổi mật khẩu, vui lòng đăng nhập lại' } })
})

/** PUT /auth/notification-preferences – ALERT-FR-005/006 */
export const updateNotificationPreferences = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.updateNotificationPreferences(req.user._id, req.body)
  res.json({ success: true, data: user })
})

/** POST /auth/delete-request – AUTH-FR-012, PRIV-NFR-003 */
export const requestDeletion = asyncHandler(async (req: Request, res: Response) => {
  await authService.requestAccountDeletion(req.user._id)
  res.json({ success: true, data: { message: 'Đã ghi nhận yêu cầu xoá tài khoản, sẽ xử lý trong tối đa 30 ngày' } })
})
