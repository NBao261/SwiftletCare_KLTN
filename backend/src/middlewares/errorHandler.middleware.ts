import { Request, Response, NextFunction } from 'express'
import { AppError } from '@/utils/appError.util'
import logger from '@/utils/logger.util'

interface MongoError extends Error {
  code?: number
  keyPattern?: Record<string, unknown>
}

export function errorHandler(err: MongoError | AppError, req: Request, res: Response, _next: NextFunction): void {
  logger.error('Unhandled error', { err, path: req.path, method: req.method })

  // Lỗi nghiệp vụ do service throw (NotFoundError/ForbiddenError/... — utils/appError.util.ts)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, ...(err.details !== undefined && { details: err.details }) },
    })
    return
  }

  if (err.name === 'ValidationError') {
    res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: err.message } })
    return
  }
  // ObjectId sai định dạng (VD :id không phải hex 24 ký tự) — trước đây rơi
  // xuống nhánh 500 mặc định, báo sai là lỗi server trong khi đây là lỗi input.
  if (err.name === 'CastError') {
    res.status(400).json({ success: false, error: { code: 'INVALID_ID', message: 'ID không hợp lệ' } })
    return
  }
  if ((err as MongoError).code === 11000) {
    const field = (err as MongoError).keyPattern ? Object.keys((err as MongoError).keyPattern!)[0] : 'field'
    res.status(409).json({ success: false, error: { code: 'DUPLICATE', message: `${field} đã tồn tại` } })
    return
  }

  res.status(500).json({ success: false, error: { code: 'SERVER_ERROR', message: 'Lỗi server' } })
}
