import { Router } from 'express'
import { param, body } from 'express-validator'
import * as alertController from '@/controllers/alerts.controller'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'

const router = Router()
router.use(authenticate)

router.get('/',    alertController.list)
router.get('/:id', param('id').isMongoId(), validate, alertController.getOne)
// ALERT-FR-009 — xác nhận đã xử lý là việc của người vận hành; Domain Expert chỉ đọc
// và kiểm chứng (mục 4.4)
router.put(
  '/:id/acknowledge',
  requireRole('FARM_OWNER', 'TECHNICIAN', 'ADMIN'),
  [param('id').isMongoId(), body('note').optional().isString()],
  validate,
  alertController.acknowledge,
)

export default router
