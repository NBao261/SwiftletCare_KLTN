import { Router } from 'express'
import { body, param, query } from 'express-validator'
import * as healthReportController from '@/controllers/healthReports.controller'
import * as healthDayController from '@/controllers/healthDays.controller'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'
import { HOUSE_REPORT_KINDS } from '@/models/houseHealthReport.model'
import { ASSESSOR_ROLES } from '@/services/healthDay.service'
import { REASON_LANGS } from '@/utils/healthReason.util'

const router = Router()
router.use(authenticate)
// EXPERT-FR-005/006 (SRS mục 4.4: Farm Owner R, Domain Expert R, Technician/Admin không liên quan) —
// Farm Owner và Domain Expert đọc; chỉ Domain Expert viết kết luận
router.use(requireRole('FARM_OWNER', 'DOMAIN_EXPERT'))

// ANALYTICS-FR-012…014, EXPERT-FR-012/013 — trạng thái ngày theo nhà yến, chấm độc lập (BR-31), CSV,
// độ khớp. Đặt trước '/:id' để "days", "evaluation" không bị hiểu là một id.
const dayScope = [
  query('houseId').optional().isMongoId(), query('farmId').optional().isMongoId(),
  query('from').optional().isDate({ format: 'YYYY-MM-DD', strictMode: true }),
  query('to').optional().isDate({ format: 'YYYY-MM-DD', strictMode: true }),
]
const dayId = param('dayId').isMongoId()
router.get('/days', ...dayScope, query('myRatingState').optional().isIn(['PENDING', 'RATED', 'SKIPPED', 'EXPIRED']),
  validate, healthDayController.listDays)
router.get('/days.csv', ...dayScope, query('lang').optional().isIn(REASON_LANGS), validate, healthDayController.exportCsv)
router.get('/evaluation', ...dayScope, query('role').optional().isIn([...ASSESSOR_ROLES]), validate, healthDayController.evaluation)
// EXPERT-FR-022 — chuyên gia xem các ngày người chấm đánh giá khác hệ thống (quyền BR-22 kiểm ở service)
router.get('/disagreements', ...dayScope, validate, healthDayController.disagreements)
router.get('/days/:dayId', dayId, validate, healthDayController.getDay)
// BR-31 (Report 3 4.2.0) — chỉ người chấm; G-20 thêm FARM_TECHNICIAN cùng ASSESSOR_ROLES
const assessorOnly = requireRole(...ASSESSOR_ROLES)
router.post('/days/:dayId/rating', assessorOnly, dayId,
  body('rating').isIn(['GOOD', 'WATCH', 'ACTION']), body('note').optional().isString().trim().isLength({ max: 1000 }),
  validate, healthDayController.rate)
router.post('/days/:dayId/skip', assessorOnly, dayId, validate, healthDayController.skip)
router.patch('/days/:dayId/rating/note', assessorOnly, dayId, body('note').isString().trim().isLength({ min: 1, max: 1000 }), validate, healthDayController.addNote)

// EXPERT-FR-005 — báo cáo theo nhà (houseId | farmId); zoneId là kiểu cũ (báo cáo tuần theo Zone), giữ cho màn hiện có
router.get('/',
  query('zoneId').optional().isMongoId(), query('houseId').optional().isMongoId(), query('farmId').optional().isMongoId(),
  query('kind').optional().isIn(HOUSE_REPORT_KINDS),
  query('from').optional().isDate({ format: 'YYYY-MM-DD', strictMode: true }),
  query('to').optional().isDate({ format: 'YYYY-MM-DD', strictMode: true }),
  validate, healthReportController.list)
router.post('/',
  body('houseId').isMongoId(),
  body('from').isDate({ format: 'YYYY-MM-DD', strictMode: true }), body('to').isDate({ format: 'YYYY-MM-DD', strictMode: true }),
  validate, healthReportController.createCustom)
// Đặt trước '/:id' để "preview" không bị hiểu là một id
router.get('/preview',
  query('zoneId').isMongoId(), query('from').isISO8601(), query('to').optional().isISO8601(), validate, healthReportController.preview)
router.get('/:id', param('id').isMongoId(), validate, healthReportController.getOne)
router.put('/:id/conclusion', requireRole('DOMAIN_EXPERT'),
  param('id').isMongoId(), body('text').isString().trim().isLength({ min: 1, max: 4000 }), validate, healthReportController.setConclusion)

export default router
