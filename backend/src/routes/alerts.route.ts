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

const photoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_PHOTO_BYTES, files: 1 } })

// .isString() trước: chặn ?type[$ne]= thành toán tử Mongo và tham số lặp thành mảng
router.get('/',
  query('farmId').optional().isString().isMongoId(),
  query('zoneId').optional().isString().isMongoId(),
  query('houseId').optional().isString().isMongoId(),
  query('nodeId').optional().isString().isMongoId(),
  query('status').optional().isString().isIn(['ACTIVE', 'ACKNOWLEDGED', 'DISMISSED', 'RESOLVED']),
  query('open').optional().isString().isIn(['true']),
  query('severity').optional().isString().isIn(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  query('type').optional().isString().isIn(ALERT_TYPES),
  query('verdict').optional().isString().isIn(['any', 'pending', 'confirmed', 'rejected']), validate, alertController.list)
// Trước '/:id'
router.get('/verdict-stats',
  query('farmId').optional().isString().isMongoId(), query('zoneId').optional().isString().isMongoId(), validate, alertController.verdictStats)
router.get('/:id', param('id').isMongoId(), validate, alertController.getOne)
router.get('/:id/evidence', requireRole('FARM_OWNER', 'DOMAIN_EXPERT'), param('id').isMongoId(), validate, alertController.evidence)
router.put(
  '/:id/acknowledge',
  // Service kiểm nhà của Farm Technician
  requireRole('FARM_OWNER', 'FARM_TECHNICIAN'),
  [
    param('id').isMongoId(), body('note').optional().isString().isLength({ max: 1000 }),
    body('cause').optional().isString().isIn(SITE_CAUSES),
  ],
  validate,
  alertController.acknowledge,
)
// Farm Owner chỉ khi farm chưa có chuyên gia (service kiểm)
router.put(
  '/:id/verdict',
  requireRole('FARM_OWNER', 'DOMAIN_EXPERT'),
  [
    param('id').isMongoId(), body('result').isIn(['CONFIRMED', 'REJECTED']),
    body('note').optional().isString().trim().isLength({ max: 1000 }),
    body('note').if(body('result').equals('REJECTED')).isString().trim().notEmpty().withMessage('Bác bỏ cảnh báo phải ghi lý do'),
    // mở Work Order
    body('needs_visit').optional().isBoolean({ strict: true }),
  ],
  validate,
  alertController.setVerdict,
)
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
