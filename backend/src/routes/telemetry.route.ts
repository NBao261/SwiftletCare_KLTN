import { Router } from 'express'
import { param } from 'express-validator'
import * as telemetryController from '@/controllers/telemetry.controller'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'
import { isoRange } from '@/utils/inputRules.util'

const router = Router()
router.use(authenticate)
// Farm Technician chỉ ở nhà được giao (service kiểm); Admin không
router.use(requireRole('FARM_OWNER', 'DOMAIN_EXPERT', 'FARM_TECHNICIAN'))

router.get('/zones/:id/latest',  param('id').isMongoId(), validate, telemetryController.getLatest)

router.get(
  '/zones/:id/history',
  [param('id').isMongoId(), ...isoRange()],
  validate,
  telemetryController.getHistory,
)

export default router
