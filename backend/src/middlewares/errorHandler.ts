import { Request, Response, NextFunction } from 'express'
import logger from '@/utils/logger'

interface MongoError extends Error {
  code?: number
  keyPattern?: Record<string, unknown>
}

export function errorHandler(err: MongoError, req: Request, res: Response, _next: NextFunction): void {
  logger.error('Unhandled error', { err, path: req.path, method: req.method })

  if (err.name === 'ValidationError') {
    res.status(422).json({ error: 'Validation failed', details: err.message })
    return
  }
  if (err.code === 11000) {
    const field = err.keyPattern ? Object.keys(err.keyPattern)[0] : 'field'
    res.status(409).json({ error: 'Duplicate entry', field })
    return
  }

  const status = (err as { status?: number }).status ?? 500
  const message = status === 500 ? 'Internal server error' : err.message
  res.status(status).json({ error: message })
}
