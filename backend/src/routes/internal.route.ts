import { Router } from 'express'
import { body, query } from 'express-validator'
import { mqttAuth } from '@/controllers/mqttAuth.controller'
import * as streamController from '@/controllers/stream.controller'
import { validate } from '@/middlewares/validate.middleware'

// Không có JWT: bảo vệ bằng khoá, reverse proxy chặn /internal từ ngoài
const router = Router()

const optionalString = (field: string) => body(field).optional({ values: 'null' }).isString()

router.post('/stream-auth',
  query('key').isString(),
  ...['action', 'path', 'user', 'password', 'token', 'query'].map(optionalString),
  validate, streamController.streamAuth)

router.post('/mqtt-auth',
  query('key').isString(), body('username').isString(), body('password').isString(),
  validate, mqttAuth)

export default router
