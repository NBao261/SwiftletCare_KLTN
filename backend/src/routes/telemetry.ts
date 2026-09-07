import { Router } from 'express'
import { param, query } from 'express-validator'
import * as telemetryController from '@/controllers/telemetry'
import { authenticate } from '@/middlewares/auth'
import { validate } from '@/middlewares/validate'

const router = Router()
router.use(authenticate)

/** GET /telemetry/zones/:id/latest – ENV-FR-004 */
router.get('/zones/:id/latest',  [param('id').isMongoId()], validate, telemetryController.getLatest)

/** GET /telemetry/zones/:id/history?from=&to=&interval=  – ANALYTICS-FR-001 */
router.get(
  '/zones/:id/history',
  [param('id').isMongoId(), query('from').optional().isISO8601(), query('to').optional().isISO8601()],
  validate,
  telemetryController.getHistory,
)

export default router
