import { Router } from 'express'
import { body, query } from 'express-validator'
import * as streamController from '@/controllers/stream.controller'
import { validate } from '@/middlewares/validate.middleware'

// Chỉ cho dịch vụ trong mạng nội bộ (MediaMTX), không có JWT người dùng: bảo vệ bằng STREAM_AUTH_KEY,
// và reverse proxy chặn /internal từ bên ngoài (docs/bird-counting-plan.md §15.4)
const router = Router()

const optionalString = (field: string) => body(field).optional({ values: 'null' }).isString()

router.post('/stream-auth',
  query('key').isString(),
  ...['action', 'path', 'user', 'password', 'token', 'query'].map(optionalString),
  validate, streamController.streamAuth)

export default router
