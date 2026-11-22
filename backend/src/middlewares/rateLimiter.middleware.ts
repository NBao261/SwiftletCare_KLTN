import { Request, Response } from 'express'
import rateLimit, { type Options } from 'express-rate-limit'
import jwt from 'jsonwebtoken'
import type { JwtAccessPayload } from '@/types'
import logger from '@/utils/logger.util'

/** SEC-NFR-004: API đếm theo tài khoản; login/reset đếm theo IP; refresh có suất riêng để không bị đá ra */

const MINUTE_MS = 60_000

const envNumber = (key: string, fallback: number): number => {
  const value = Number(process.env[key])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

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
      message: `Thao tác quá nhanh. Thử lại sau ${retryAfterSec} giây`,
      details: { retryAfterSec },
    },
  })
}

const common = { standardHeaders: true, legacyHeaders: true, handler: handleLimitReached } as const

/** Chỉ giải mã token, không tra DB; token lỗi thì đếm theo IP */
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

const OWN_LIMITER_PATHS = new Set([
  '/auth/login',
  '/auth/forgot-password', '/auth/reset-password', '/auth/refresh',
])

function isExemptFromApiLimit(req: Request): boolean {
  const path = req.path
  return path === '/health'
    || path.startsWith('/files/')
    || path.startsWith('/api-docs')
    // Mọi thiết bị gọi từ 1 IP, chặn là mất kết nối hết; đã có khoá riêng
    || path.startsWith('/internal/')
    || OWN_LIMITER_PATHS.has(path)
}

export const apiLimiter = rateLimit({
  ...common,
  windowMs: envNumber('RATE_LIMIT_WINDOW_MS', MINUTE_MS),
  limit: envNumber('RATE_LIMIT_MAX', 300),
  keyGenerator: userOrIpKey,
  skip: isExemptFromApiLimit,
})

const authWindowMs = envNumber('AUTH_RATE_LIMIT_WINDOW_MS', 15 * MINUTE_MS)
const authLimit = envNumber('AUTH_RATE_LIMIT_MAX', 10)

/** Chỉ đếm lần sai: người nhập đúng không bị trừ suất */
export const loginLimiter = rateLimit({
  ...common,
  windowMs: authWindowMs,
  limit: authLimit,
  skipSuccessfulRequests: true,
})

/** Đếm mọi lần: mỗi lần là 1 email */
export const passwordResetLimiter = rateLimit({
  ...common,
  windowMs: authWindowMs,
  limit: authLimit,
})

export const refreshLimiter = rateLimit({
  ...common,
  windowMs: MINUTE_MS,
  limit: envNumber('REFRESH_RATE_LIMIT_MAX', 30),
})
