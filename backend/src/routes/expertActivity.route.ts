import { Router } from 'express'
import { query } from 'express-validator'
import * as expertActivityController from '@/controllers/expertActivity.controller'
import { EXPERT_DECISION_ACTIONS } from '@/services/expertActivity.service'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'

const router = Router()
// EXPERT-FR-009 — chỉ Farm Owner và Domain Expert của farm (service kiểm thành viên);
// Technician, Administrator → 403
router.use(authenticate, requireRole('FARM_OWNER', 'DOMAIN_EXPERT'))

router.get('/',
  query('farmId').isString().isMongoId(),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  query('type').optional().isString().isIn([...EXPERT_DECISION_ACTIONS]),
  query('zoneId').optional().isString().isMongoId(),
  query('houseId').optional().isString().isMongoId(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1 }),
  validate,
  expertActivityController.list,
)

export default router
