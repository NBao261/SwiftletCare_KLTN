import { Router } from 'express'
import { param, body, query } from 'express-validator'
import * as alertController from '@/controllers/alerts.controller'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'
import multer from 'multer'
import { ALERT_TYPES } from '@/services/alert.service'
import { MAX_PHOTO_BYTES } from '@/services/workOrder.service'
import { ONSITE_OBSERVATIONS } from '@/models/alert.model'
import { SITE_CAUSES } from '@/models/workOrder.model'

const router = Router()
router.use(authenticate)

// Ảnh tại chỗ giữ trong RAM rồi service đẩy lên MinIO (EXPERT-FR-021)
const photoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_PHOTO_BYTES, files: 1 } })

// Mọi bộ lọc đều phải là chuỗi thuộc tập cho phép: `?type[$ne]=X` mà không chặn thì
// thành toán tử Mongo trong filter (và làm lẫn cảnh báo thường vào hàng chờ kiểm chứng)
// .isString() trước: express-validator kiểm isIn/isMongoId trên TỪNG phần tử nên tham số lặp
// (?verdict=a&verdict=b) qua được và tới service dưới dạng mảng
router.get('/',
  query('farmId').optional().isString().isMongoId(),
  query('zoneId').optional().isString().isMongoId(),
  query('houseId').optional().isString().isMongoId(),
  query('status').optional().isString().isIn(['ACTIVE', 'ACKNOWLEDGED', 'DISMISSED', 'RESOLVED']),
  query('severity').optional().isString().isIn(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  query('type').optional().isString().isIn(ALERT_TYPES),
  query('verdict').optional().isString().isIn(['pending', 'confirmed', 'rejected']), validate, alertController.list)
// EXPERT-FR-003 — đặt trước '/:id' để "verdict-stats" không bị hiểu là một id
router.get('/verdict-stats',
  query('farmId').optional().isString().isMongoId(), query('zoneId').optional().isString().isMongoId(), validate, alertController.verdictStats)
router.get('/:id', param('id').isMongoId(), validate, alertController.getOne)
// ALERT-FR-014 — bằng chứng của cảnh báo suy luận: chỉ người xem được dữ liệu vận hành của farm
router.get('/:id/evidence', requireRole('FARM_OWNER', 'DOMAIN_EXPERT'), param('id').isMongoId(), validate, alertController.evidence)
// ALERT-FR-009 — xác nhận đã xử lý là việc của người vận hành; Domain Expert chỉ đọc
// và kiểm chứng (mục 4.4)
router.put(
  '/:id/acknowledge',
  // ALERT-FR-009 — Farm Owner; Farm Technician ở nhà được giao (service kiểm nhà); Domain Expert, Admin chỉ xem (§2.4)
  requireRole('FARM_OWNER', 'FARM_TECHNICIAN'),
  [
    param('id').isMongoId(), body('note').optional().isString().isLength({ max: 1000 }),
    // ALERT-FR-018 — nguyên nhân tìm thấy tại chỗ
    body('cause').optional().isString().isIn(SITE_CAUSES),
  ],
  validate,
  alertController.acknowledge,
)
// EXPERT-FR-003 — Domain Expert kiểm chứng cảnh báo suy luận; Farm Owner chỉ khi farm chưa có
// chuyên gia (BR-22, service kiểm). Bác bỏ phải có lý do (422)
router.put(
  '/:id/verdict',
  requireRole('FARM_OWNER', 'DOMAIN_EXPERT'),
  [
    param('id').isMongoId(), body('result').isIn(['CONFIRMED', 'REJECTED']),
    body('note').optional().isString().trim().isLength({ max: 1000 }),
    body('note').if(body('result').equals('REJECTED')).isString().trim().notEmpty().withMessage('Bác bỏ cảnh báo phải ghi lý do'),
    // BR-39 — chuyên gia xác nhận cần thợ tới nhà: mở Work Order
    body('needs_visit').optional().isBoolean({ strict: true }),
  ],
  validate,
  alertController.setVerdict,
)
// EXPERT-FR-021 — chỉ thợ được giao nhà trả lời yêu cầu kiểm tra tại chỗ (service kiểm nhà, nhà khác → 403)
router.post(
  '/:id/onsite-check',
  requireRole('FARM_TECHNICIAN'),
  photoUpload.single('photo'),
  [
    param('id').isMongoId(),
    body('observation').isString().isIn(ONSITE_OBSERVATIONS),
    body('note').optional().isString().isLength({ max: 1000 }),
  ],
  validate,
  alertController.answerOnsiteCheck,
)

export default router
