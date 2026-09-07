import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { User } from '@/models/User'
import type { JwtAccessPayload, Role } from '@/types'
import logger from '@/utils/logger'

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' })
    return
  }

  const token = authHeader.slice(7)
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as JwtAccessPayload
    const user = await User.findById(payload.sub).lean()
    if (!user || !user.is_active) {
      res.status(401).json({ error: 'User not found or inactive' })
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
    next()
  } catch (err) {
    if ((err as Error).name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' })
      return
    }
    logger.warn('Invalid token attempt', { err })
    res.status(401).json({ error: 'Invalid token' })
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' })
      return
    }
    next()
  }
}
