import { Router } from 'express'
import { param, body, query } from 'express-validator'
import * as alertController from '@/controllers/alerts.controller'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'

const router = Router()
router.use(authenticate)

router.get('/',
  query('verdict').optional().isIn(['pending', 'confirmed', 'rejected']), validate, alertController.list)
// EXPERT-FR-003 — đặt trước '/:id' để "verdict-stats" không bị hiểu là một id
router.get('/verdict-stats',
  query('farmId').optional().isMongoId(), query('zoneId').optional().isMongoId(), validate, alertController.verdictStats)
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
// EXPERT-FR-003 — chỉ Domain Expert kiểm chứng cảnh báo suy luận
router.put(
  '/:id/verdict',
  requireRole('DOMAIN_EXPERT'),
  [param('id').isMongoId(), body('result').isIn(['CONFIRMED', 'REJECTED']), body('note').optional().isString().trim().isLength({ max: 1000 })],
  validate,
  alertController.setVerdict,
)

export default router
