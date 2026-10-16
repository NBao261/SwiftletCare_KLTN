import { Router } from 'express'
import { param, body, query } from 'express-validator'
import * as alertController from '@/controllers/alerts.controller'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'
import { ALERT_TYPES } from '@/services/alert.service'

const router = Router()
router.use(authenticate)

// Mọi bộ lọc đều phải là chuỗi thuộc tập cho phép: `?type[$ne]=X` mà không chặn thì
// thành toán tử Mongo trong filter (và làm lẫn cảnh báo thường vào hàng chờ kiểm chứng)
// .isString() trước: express-validator kiểm isIn/isMongoId trên TỪNG phần tử nên tham số lặp
// (?verdict=a&verdict=b) qua được và tới service dưới dạng mảng
router.get('/',
  query('farmId').optional().isString().isMongoId(),
  query('zoneId').optional().isString().isMongoId(),
  query('status').optional().isString().isIn(['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED']),
  query('severity').optional().isString().isIn(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  query('type').optional().isString().isIn(ALERT_TYPES),
  query('verdict').optional().isString().isIn(['pending', 'confirmed', 'rejected']), validate, alertController.list)
// EXPERT-FR-003 — đặt trước '/:id' để "verdict-stats" không bị hiểu là một id
router.get('/verdict-stats',
  query('farmId').optional().isString().isMongoId(), query('zoneId').optional().isString().isMongoId(), validate, alertController.verdictStats)
router.get('/:id', param('id').isMongoId(), validate, alertController.getOne)
// ALERT-FR-009 — xác nhận đã xử lý là việc của người vận hành; Domain Expert chỉ đọc
// và kiểm chứng (mục 4.4)
router.put(
  '/:id/acknowledge',
  // ALERT-FR-009 — Admin chỉ xem: xác nhận thay sẽ chặn alertEscalation tự tạo ticket (TICKET-FR-002)
  requireRole('FARM_OWNER', 'TECHNICIAN'),
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
