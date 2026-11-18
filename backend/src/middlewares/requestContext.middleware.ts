import { randomUUID } from 'crypto'
import { Request, Response, NextFunction } from 'express'
import { runWithRequestContext } from '@/utils/requestContext.util'

/** Report 4 §6.1 — độ dài tối đa của User-Agent lưu vào audit log */
const CLIENT_MAX_LENGTH = 200
/** Mã request do client hay proxy gửi (`X-Request-Id`) chỉ nhận dạng ngắn, an toàn để ghi log */
const REQUEST_ID_PATTERN = /^[\w-]{1,64}$/

/**
 * Mở ngữ cảnh request (IP, User-Agent, mã request) cho mọi code chạy phía sau trong cùng request — VD
 * `logAction` tự điền `source_ip`, `client`, `correlation_id` của audit log (Report 4 §6.1). Mã request
 * trả lại ở header `X-Request-Id` để báo lỗi kèm mã. Gắn 1 lần trong app.config.ts, trước các router.
 */
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  // Bỏ tiền tố IPv4-mapped ("::ffff:1.2.3.4") cho dễ đọc trong audit log
  const ip = req.ip?.replace(/^::ffff:/, '')
  const sent = req.get('x-request-id')
  const correlationId = sent && REQUEST_ID_PATTERN.test(sent) ? sent : randomUUID()
  res.setHeader('X-Request-Id', correlationId)
  const client = req.get('user-agent')?.slice(0, CLIENT_MAX_LENGTH)
  runWithRequestContext({ ip, client, correlationId }, next)
}
