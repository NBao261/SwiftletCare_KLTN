import { Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { User } from '@/models/User'
import type { AuthRequest, JwtAccessPayload, Role } from '@/types'
import logger from '@/utils/logger'

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
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
    req.user = user as AuthRequest['user']
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
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!roles.includes(req.user?.role)) {
      res.status(403).json({ error: 'Insufficient permissions' })
      return
    }
    next()
  }
}
