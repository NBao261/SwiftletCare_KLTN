import { randomUUID } from 'crypto'
import { Request, Response, NextFunction } from 'express'
import { runWithRequestContext } from '@/utils/requestContext.util'

const CLIENT_MAX_LENGTH = 200
const REQUEST_ID_PATTERN = /^[\w-]{1,64}$/

// Ngữ cảnh request cho audit log; trả mã ở header X-Request-Id
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip?.replace(/^::ffff:/, '')
  const sent = req.get('x-request-id')
  const correlationId = sent && REQUEST_ID_PATTERN.test(sent) ? sent : randomUUID()
  res.setHeader('X-Request-Id', correlationId)
  const client = req.get('user-agent')?.slice(0, CLIENT_MAX_LENGTH)
  runWithRequestContext({ ip, client, correlationId }, next)
}
