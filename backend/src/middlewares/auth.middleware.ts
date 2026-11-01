import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { User } from '@/models/user.model'
import type { JwtAccessPayload, Role } from '@/types'
import { AppError, UnauthorizedError, ForbiddenError } from '@/utils/appError.util'
import logger from '@/utils/logger.util'
import { setRequestActorRole } from '@/utils/requestContext.util'

/**
 * Đi qua `next(err)` để errorHandler.middleware.ts xử lý — trước đây middleware
 * này tự viết `res.status(...).json({error: '...'})` trực tiếp, tạo ra 1 dạng
 * response khác với envelope `{success:false, error:{code,message}}` mà mọi
 * AppError khác dùng. Hệ quả thật: code `TOKEN_EXPIRED` trước đây nằm ở top-level
 * (`{error:'...', code:'TOKEN_EXPIRED'}`) trong khi `services/api/client.ts` phía
 * frontend check `err.response.data.error.code` (kỳ vọng `error` là object) — 2 bên
 * không khớp nên luồng tự refresh access token khi hết hạn chưa từng hoạt động.
 */
/** Route vẫn dùng được khi tài khoản đang giữ mật khẩu tạm (`must_change_password`) */
const PASSWORD_CHANGE_ALLOWED = new Set(['PUT /auth/password', 'POST /auth/logout'])

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    next(UnauthorizedError('Missing or invalid Authorization header'))
    return
  }

  const token = authHeader.slice(7)
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as JwtAccessPayload
    const user = await User.findById(payload.sub).lean()
    if (!user || !user.is_active) {
      next(UnauthorizedError('User not found or inactive'))
      return
    }
    // Mật khẩu tạm do Admin cấp: chỉ cho đổi mật khẩu hoặc đăng xuất (AUTH-FR-005c).
    // 403 chứ không phải 401 — 401 làm frontend tưởng token hết hạn và refresh vòng lặp.
    if (user.must_change_password && !PASSWORD_CHANGE_ALLOWED.has(`${req.method} ${req.baseUrl}${req.path}`)) {
      next(new AppError(403, 'PASSWORD_CHANGE_REQUIRED', 'Bạn cần đổi mật khẩu tạm trước khi tiếp tục'))
      return
    }
    req.user = {
      _id:                      String(user._id),
      email:                    user.email,
      role:                     user.role,
      full_name:                user.full_name,
      is_active:                user.is_active,
      notification_preferences: user.notification_preferences,
    }
    // Audit log ghi vai trò người làm (EXPERT-FR-009) mà không phải truyền qua từng service
    setRequestActorRole(user.role)
    next()
  } catch (err) {
    if ((err as Error).name === 'TokenExpiredError') {
      next(new AppError(401, 'TOKEN_EXPIRED', 'Token đã hết hạn'))
      return
    }
    logger.warn('Invalid token attempt', { err })
    next(UnauthorizedError('Invalid token'))
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(ForbiddenError('Insufficient permissions'))
      return
    }
    next()
  }
}
