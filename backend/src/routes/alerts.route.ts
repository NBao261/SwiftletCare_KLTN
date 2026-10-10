import { Router } from 'express'
import { param, body } from 'express-validator'
import * as alertController from '@/controllers/alerts.controller'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'

const router = Router()
router.use(authenticate)

router.get('/',    alertController.list)
router.get('/:id', param('id').isMongoId(), validate, alertController.getOne)
router.put(
  '/:id/acknowledge',
  // ALERT-FR-009 — Admin chỉ xem: xác nhận thay sẽ chặn alertEscalation tự tạo ticket (TICKET-FR-002)
  requireRole('FARM_OWNER', 'TECHNICIAN'),
  [param('id').isMongoId(), body('note').optional().isString()],
  validate,
  alertController.acknowledge,
)

export default router
