import { Request, Response, NextFunction } from 'express'
import { runWithRequestContext } from '@/utils/requestContext.util'

/**
 * Mở ngữ cảnh request (hiện chỉ có IP) cho mọi code chạy phía sau trong cùng
 * request — VD `logAction` tự điền `audit_logs.ip_address`. Gắn 1 lần trong
 * app.config.ts, trước các router.
 */
export function requestContext(req: Request, _res: Response, next: NextFunction): void {
  // Bỏ tiền tố IPv4-mapped ("::ffff:1.2.3.4") cho dễ đọc trong audit log
  const ip = req.ip?.replace(/^::ffff:/, '')
  runWithRequestContext({ ip }, next)
}
