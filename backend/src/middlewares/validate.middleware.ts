import { Request, Response, NextFunction } from 'express'
import { validationResult } from 'express-validator'
import { AppError } from '@/utils/appError.util'

/**
 * Express-validator middleware — đi qua `next(err)` để dùng chung envelope
 * `{success:false, error:{code,message,details}}` với mọi lỗi khác, thay vì
 * tự viết `{error:'Validation failed', details}` riêng 1 kiểu.
 */
export function validate(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    next(new AppError(422, 'VALIDATION_ERROR', 'Dữ liệu gửi lên không hợp lệ', errors.array()))
    return
  }
  next()
}
