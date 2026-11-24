import { Request, Response, NextFunction } from 'express'
import { MulterError } from 'multer'
import { AppError } from '@/utils/appError.util'
import logger from '@/utils/logger.util'
import { loggablePath } from '@/utils/requestLog.util'

interface MongoError extends Error {
  code?: number
  keyPattern?: Record<string, unknown>
}

export function errorHandler(err: MongoError | AppError | MulterError, req: Request, res: Response, _next: NextFunction): void {
  logger.error('Unhandled error', { err, path: loggablePath(req), method: req.method })

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message, ...(err.details !== undefined && { details: err.details }) },
    })
    return
  }

  if (err instanceof MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'File vượt quá dung lượng cho phép (nhạc 10MB, ảnh 5MB)'
      : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE'
        ? 'Quá số file cho phép hoặc sai tên trường file'
        : `File upload không hợp lệ: ${err.message}`
    res.status(400).json({ success: false, error: { code: 'INVALID_UPLOAD', message } })
    return
  }

  if (err.name === 'ValidationError') {
    res.status(422).json({ success: false, error: { code: 'VALIDATION_ERROR', message: err.message } })
    return
  }
  // ObjectId sai định dạng là lỗi input, không phải 500
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
