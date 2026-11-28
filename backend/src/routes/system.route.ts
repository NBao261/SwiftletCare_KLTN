import { Router } from 'express'
import { body, query } from 'express-validator'
import * as systemController from '@/controllers/system.controller'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'
import { isoRange } from '@/utils/inputRules.util'
import { REF5_ENTRY_PATTERN, SOURCE_MAX_LENGTH, THRESHOLD_KEYS, THRESHOLD_LIMITS } from '@/utils/thresholds.util'

const router = Router()
router.use(authenticate, requireRole('ADMIN'))

router.get('/audit-logs',
  query('actorId').optional().isString().isMongoId(),
  query('targetId').optional().isString().isMongoId(),
  ...isoRange(),
  validate,
  systemController.listAuditLogs,
)

router.get('/settings/default-thresholds', systemController.getDefaultThresholds)
// Nguồn phải chứa mã một mục của REF-5
router.put('/settings/default-thresholds',
  ...THRESHOLD_KEYS.map(key => body(key).optional().isFloat({ min: THRESHOLD_LIMITS[key].min, max: THRESHOLD_LIMITS[key].max })),
  body('source').isString().bail().trim().isLength({ min: 1, max: SOURCE_MAX_LENGTH }).matches(REF5_ENTRY_PATTERN),
  validate,
  systemController.updateDefaultThresholds,
)

router.get('/health-overview', systemController.getHealthOverview)

export default router
