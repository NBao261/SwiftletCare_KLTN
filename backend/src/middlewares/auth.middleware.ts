import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { User, canSignIn } from '@/models/user.model'
import type { JwtAccessPayload, Role } from '@/types'
import { AppError, UnauthorizedError, ForbiddenError } from '@/utils/appError.util'
import logger from '@/utils/logger.util'
import { setRequestActorRole } from '@/utils/requestContext.util'

// Route vẫn dùng được khi tài khoản đang giữ mật khẩu tạm (`must_change_password`)
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
    if (!user || !canSignIn(user)) {
      next(UnauthorizedError('User not found or inactive'))
      return
    }
    // mật khẩu tạm chỉ được đổi mật khẩu/đăng xuất. 403 vì 401 làm client refresh vòng lặp
    if (user.must_change_password && !PASSWORD_CHANGE_ALLOWED.has(`${req.method} ${req.baseUrl}${req.path}`)) {
      next(new AppError(403, 'PASSWORD_CHANGE_REQUIRED', 'Bạn cần đổi mật khẩu tạm trước khi tiếp tục'))
      return
    }
    req.user = {
      _id:                      String(user._id),
      email:                    user.email,
      role:                     user.role,
      full_name:                user.full_name,
      is_active:                true,
      notification_preferences: user.notification_preferences,
    }
    // Audit log ghi vai trò
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
