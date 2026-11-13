import { Router } from 'express'
import { body, param, query } from 'express-validator'
import multer from 'multer'
import * as workOrderController from '@/controllers/workOrders.controller'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'
import { SITE_CAUSES, WORK_ORDER_STATUSES } from '@/models/workOrder.model'
import { MAX_PHOTO_BYTES, MAX_WORK_ORDER_PHOTOS } from '@/services/workOrder.service'

const router = Router()
router.use(authenticate)

// Ảnh sửa chữa giữ trong RAM rồi service đẩy lên MinIO (ALERT-FR-018)
const photoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_PHOTO_BYTES, files: MAX_WORK_ORDER_PHOTOS } })
const idParam = param('id').isMongoId()

// Report 3 §2.4: Farm Owner mở, duyệt, mở lại, huỷ, giao lại; Farm Technician thực hiện ở nhà được giao (service
// kiểm nhà); Domain Expert chỉ đọc; Administrator không thấy Work Order
const READERS = ['FARM_OWNER', 'DOMAIN_EXPERT', 'FARM_TECHNICIAN'] as const
const DOERS = ['FARM_OWNER', 'FARM_TECHNICIAN'] as const

// .isString() trước: tham số lặp không thành mảng, `?x[$ne]=` không thành toán tử Mongo
router.get('/',
  requireRole(...READERS),
  query('farmId').optional().isString().isMongoId(),
  query('houseId').optional().isString().isMongoId(),
  query('alertId').optional().isString().isMongoId(),
  query('assigneeId').optional().isString().custom(v => v === 'me' || /^[a-f\d]{24}$/i.test(v)).withMessage('assigneeId là id hoặc "me"'),
  query('status').optional().isString().isIn(WORK_ORDER_STATUSES),
  query('open').optional().isString().isIn(['true', 'false']),
  validate, workOrderController.list)
router.post('/',
  requireRole('FARM_OWNER'),
  body('house_id').isString().isMongoId(),
  body('title').isString().trim().notEmpty().isLength({ max: 200 }),
  body('description').optional().isString().isLength({ max: 2000 }),
  body('alert_id').optional().isString().isMongoId(),
  validate, workOrderController.create)
// OPS-FR-009 — đặt trước '/:id' để "metrics" không bị hiểu là một id
router.get('/metrics',
  requireRole('FARM_OWNER', 'DOMAIN_EXPERT'),
  query('farmId').isString().isMongoId(),
  query('houseId').optional().isString().isMongoId(),
  query('from').isString().isISO8601(),
  query('to').isString().isISO8601(),
  validate, workOrderController.metrics)
router.get('/:id', requireRole(...READERS), idParam, validate, workOrderController.getOne)

router.post('/:id/start', requireRole(...DOERS), idParam, validate, workOrderController.start)
router.post('/:id/done',
  requireRole(...DOERS),
  photoUpload.array('photos', MAX_WORK_ORDER_PHOTOS),
  idParam,
  body('cause').optional().isString().isIn(SITE_CAUSES),
  body('work_note').optional().isString().isLength({ max: 2000 }),
  validate, workOrderController.done)

// OPS-FR-007 — checklist của Work Order phòng ngừa: thợ nhà được giao, Farm Owner
const checklistPhoto = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_PHOTO_BYTES, files: 1 } })
router.put('/:id/checklist',
  requireRole(...DOERS),
  checklistPhoto.single('photo'),
  idParam,
  body('item_index').isInt({ min: 0 }).toInt(),
  body('result').isString().isIn(['OK', 'DEFECT']),
  body('note').optional().isString().isLength({ max: 1000 }),
  validate, workOrderController.updateChecklist)

router.post('/:id/approve', requireRole('FARM_OWNER'), idParam, validate, workOrderController.approve)
router.post('/:id/reopen', requireRole('FARM_OWNER'), idParam,
  body('note').isString().trim().notEmpty().withMessage('Mở lại phải ghi chú').isLength({ max: 1000 }),
  validate, workOrderController.reopen)
router.post('/:id/cancel', requireRole('FARM_OWNER'), idParam,
  body('reason').isString().trim().notEmpty().withMessage('Huỷ phải ghi lý do').isLength({ max: 1000 }),
  validate, workOrderController.cancel)
router.post('/:id/reassign', requireRole('FARM_OWNER'), idParam,
  body('assignee_id').isString().isMongoId(),
  validate, workOrderController.reassign)

export default router
