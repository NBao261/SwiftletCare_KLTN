import { Request, Response } from 'express'
import * as authService from '@/services/auth.service'
import * as telegramService from '@/services/telegram.service'
import { asyncHandler } from '@/utils/asyncHandler.util'

const REFRESH_COOKIE_MAX_AGE = 30 * 86400 * 1000
// clearCookie phải cùng options với lúc set, không thì trình duyệt không xoá
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
}

function setRefreshCookie(res: Response, token: string): void {
  res.cookie('refreshToken', token, { ...REFRESH_COOKIE_OPTIONS, maxAge: REFRESH_COOKIE_MAX_AGE })
}

/** Mobile không có cookie jar: nhận refreshToken qua JSON body */
function isMobileClient(req: Request): boolean {
  return req.headers['x-client'] === 'mobile'
}

function readRefreshToken(req: Request): string | undefined {
  return (req.body as Record<string, string | undefined>)?.refreshToken ??
    (req.cookies as Record<string, string | undefined>)?.refreshToken
}

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { user, accessToken, refreshToken } = await authService.loginUser(req.body)
  setRefreshCookie(res, refreshToken)
  const data: { accessToken: string; user: typeof user; refreshToken?: string } = { accessToken, user }
  if (isMobileClient(req)) data.refreshToken = refreshToken
  res.json({ success: true, data })
})

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getCurrentUser(req.user._id)
  res.json({ success: true, data: user })
})

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = readRefreshToken(req)
  const { accessToken } = await authService.refreshAccessToken(token)
  res.json({ success: true, data: { accessToken } })
})

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = readRefreshToken(req)
  await authService.logoutUser(req.user._id, token)
  res.clearCookie('refreshToken', REFRESH_COOKIE_OPTIONS)
  res.json({ success: true, data: { message: 'Đã đăng xuất' } })
})

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.forgotPassword(req.body.email as string)
  res.json({ success: true, data: { message: 'Nếu email tồn tại, mã đặt lại mật khẩu đã được gửi' } })
})

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email, token, newPassword } = req.body as { email: string; token: string; newPassword: string }
  await authService.resetPassword(email, token, newPassword)
  res.json({ success: true, data: { message: 'Đã đổi mật khẩu. Đăng nhập lại.' } })
})

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { current_password, new_password } = req.body as { current_password: string; new_password: string }
  await authService.changePassword(req.user._id, current_password, new_password, readRefreshToken(req))
  res.json({ success: true, data: { message: 'Đã đổi mật khẩu. Các thiết bị khác đã được đăng xuất.' } })
})

export const updateNotificationPreferences = asyncHandler(async (req: Request, res: Response) => {
  const { push, telegram, quiet_hours: quietHours, by_severity: bySeverity } = req.body as authService.NotificationPreferencesInput
  const user = await authService.updateNotificationPreferences(req.user._id, {
    push, telegram, quiet_hours: quietHours, by_severity: bySeverity,
  })
  res.json({ success: true, data: user })
})

export const createTelegramLink = asyncHandler(async (req: Request, res: Response) => {
  const link = await telegramService.createTelegramLink(req.user._id)
  res.json({ success: true, data: link })
})

export const unlinkTelegram = asyncHandler(async (req: Request, res: Response) => {
  await telegramService.unlinkTelegram(req.user._id)
  res.json({ success: true, data: { message: 'Đã huỷ liên kết Telegram' } })
})

export const requestDeletion = asyncHandler(async (req: Request, res: Response) => {
  await authService.requestAccountDeletion(req.user._id)
  res.json({ success: true, data: { message: 'Đã ghi nhận yêu cầu xoá tài khoản, sẽ xử lý trong tối đa 30 ngày' } })
})

export const cancelDeletion = asyncHandler(async (req: Request, res: Response) => {
  await authService.cancelAccountDeletion(req.user._id)
  res.json({ success: true, data: { message: 'Đã huỷ yêu cầu xoá tài khoản' } })
})
