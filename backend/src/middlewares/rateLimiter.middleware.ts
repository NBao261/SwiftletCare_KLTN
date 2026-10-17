import { Request, Response } from 'express'
import rateLimit, { type Options } from 'express-rate-limit'
import jwt from 'jsonwebtoken'
import type { JwtAccessPayload } from '@/types'
import logger from '@/utils/logger.util'

/**
 * SEC-NFR-004 — 3 suất tách biệt, để một nhóm request không chặn lây nhóm khác:
 * - `apiLimiter`: API đã đăng nhập, đếm theo TÀI KHOẢN. Trước đây đếm theo IP nên
 *   mọi người chung mạng (hoặc sau proxy) dùng chung 1 suất, và chính trang Tổng
 *   quan (gọi API theo từng zone, ~85 request/lần mở) đã đủ chặn cả /auth/refresh.
 * - `loginLimiter` / `otpSendLimiter`: đăng nhập, OTP — đếm theo IP, chặt hơn
 *   nhiều, vì đây mới là chỗ bị dò mật khẩu và spam email.
 * - `refreshLimiter`: /auth/refresh có suất riêng — hết suất API thì vẫn làm mới
 *   được token, không bị đá ra màn đăng nhập.
 */

const MINUTE_MS = 60_000

const envNumber = (key: string, fallback: number): number => {
  const value = Number(process.env[key])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

/** Cùng envelope `{success:false, error:{code,message}}` với errorHandler — frontend đọc được lý do */
function handleLimitReached(req: Request, res: Response, _next: unknown, options: Options): void {
  const resetTime = (req as Request & { rateLimit?: { resetTime?: Date } }).rateLimit?.resetTime
  const retryAfterSec = resetTime
    ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
    : Math.ceil(options.windowMs / 1000)
  res.setHeader('Retry-After', String(retryAfterSec))
  logger.warn('Rate limit reached', { path: req.path, method: req.method })
  res.status(options.statusCode).json({
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: `Thao tác quá nhanh, vui lòng thử lại sau ${retryAfterSec} giây`,
      details: { retryAfterSec },
    },
  })
}

// standardHeaders: RateLimit-*; legacyHeaders: X-RateLimit-* như SRS mục 9 ghi
const common = { standardHeaders: true, legacyHeaders: true, handler: handleLimitReached } as const

/**
 * Chỉ giải mã access token, không tra DB: token hợp lệ thì đếm theo tài khoản,
 * thiếu/sai/hết hạn thì đếm theo IP. Request đó vẫn bị `authenticate` từ chối sau.
 */
function userOrIpKey(req: Request): string {
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(header.slice(7), process.env.JWT_ACCESS_SECRET!) as JwtAccessPayload
      if (payload.sub) return `user:${payload.sub}`
    } catch {
      // rơi xuống đếm theo IP
    }
  }
  return `ip:${req.ip}`
}

/** Các route đếm ở limiter riêng (đăng ký trong auth.route.ts) */
const OWN_LIMITER_PATHS = new Set([
  '/auth/login', '/auth/register', '/auth/otp/send', '/auth/otp/verify',
  '/auth/forgot-password', '/auth/reset-password', '/auth/refresh',
])

function isExemptFromApiLimit(req: Request): boolean {
  const path = req.path
  return path === '/health'
    || path.startsWith('/files/')   // file audio phục vụ tĩnh (STORAGE_DRIVER=local)
    || path.startsWith('/api-docs')
    || OWN_LIMITER_PATHS.has(path)
}

/** Mount toàn cục trong app.config.ts */
export const apiLimiter = rateLimit({
  ...common,
  windowMs: envNumber('RATE_LIMIT_WINDOW_MS', MINUTE_MS),
  limit: envNumber('RATE_LIMIT_MAX', 300),
  keyGenerator: userOrIpKey,
  skip: isExemptFromApiLimit,
})

const authWindowMs = envNumber('AUTH_RATE_LIMIT_WINDOW_MS', 15 * MINUTE_MS)
const authLimit = envNumber('AUTH_RATE_LIMIT_MAX', 10)

/**
 * Đăng nhập, xác thực OTP, đặt lại mật khẩu — chỉ đếm lần SAI (chống dò), người
 * nhập đúng không bị trừ suất.
 */
export const loginLimiter = rateLimit({
  ...common,
  windowMs: authWindowMs,
  limit: authLimit,
  skipSuccessfulRequests: true,
})

/** Đăng ký, gửi OTP, quên mật khẩu — đếm MỌI lần, vì mỗi lần thành công là 1 email gửi đi */
export const otpSendLimiter = rateLimit({
  ...common,
  windowMs: authWindowMs,
  limit: authLimit,
})

export const refreshLimiter = rateLimit({
  ...common,
  windowMs: MINUTE_MS,
  limit: envNumber('REFRESH_RATE_LIMIT_MAX', 30),
})
