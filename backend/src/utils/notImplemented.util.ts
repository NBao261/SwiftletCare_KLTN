import { Response } from 'express'

/**
 * Response chuẩn cho endpoint chưa triển khai — cùng envelope với AppError
 * (utils/appError.util.ts) để frontend luôn xử lý 1 format lỗi duy nhất, bất kể
 * endpoint đã code xong hay còn là stub. Khi implement service thật cho
 * controller nào, chỉ cần xóa dòng gọi hàm này.
 */
export function notImplemented(res: Response): void {
  res.status(501).json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Endpoint chưa được triển khai' } })
}
