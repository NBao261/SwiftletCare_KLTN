import { Router } from 'express'
import { body, query } from 'express-validator'
import * as systemController from '@/controllers/system.controller'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'
import { THRESHOLD_KEYS } from '@/utils/thresholds.util'

const router = Router()
router.use(authenticate, requireRole('ADMIN'))

/** Module SYSTEM – SRS §5.11 */
router.get('/audit-logs',
  query('actorId').optional().isMongoId(),
  query('targetId').optional().isMongoId(),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  validate,
  systemController.listAuditLogs,
)

router.get('/settings/default-thresholds', systemController.getDefaultThresholds)
router.put('/settings/default-thresholds',
  ...THRESHOLD_KEYS.map(key => body(key).optional().isFloat()),
  validate,
  systemController.updateDefaultThresholds,
)

router.get('/health-overview', systemController.getHealthOverview)

export default router
