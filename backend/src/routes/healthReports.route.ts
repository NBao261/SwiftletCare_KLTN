import { Router } from 'express'
import { body, param, query } from 'express-validator'
import * as healthReportController from '@/controllers/healthReports.controller'
import * as healthDayController from '@/controllers/healthDays.controller'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'

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
router.get('/days', ...dayScope, validate, healthDayController.listDays)
router.get('/days.csv', ...dayScope, validate, healthDayController.exportCsv)
router.get('/evaluation', ...dayScope, query('role').optional().isIn(['FARM_OWNER', 'DOMAIN_EXPERT']), validate, healthDayController.evaluation)
router.get('/days/:dayId', dayId, validate, healthDayController.getDay)
router.post('/days/:dayId/rating', dayId,
  body('rating').isIn(['GOOD', 'WATCH', 'ACTION']), body('note').optional().isString().trim().isLength({ max: 1000 }),
  validate, healthDayController.rate)
router.post('/days/:dayId/skip', dayId, validate, healthDayController.skip)
router.patch('/days/:dayId/rating/note', dayId, body('note').isString().trim().isLength({ min: 1, max: 1000 }), validate, healthDayController.addNote)

router.get('/', query('zoneId').isMongoId(), validate, healthReportController.list)
// Đặt trước '/:id' để "preview" không bị hiểu là một id
router.get('/preview',
  query('zoneId').isMongoId(), query('from').isISO8601(), query('to').optional().isISO8601(), validate, healthReportController.preview)
router.get('/:id', param('id').isMongoId(), validate, healthReportController.getOne)
router.put('/:id/conclusion', requireRole('DOMAIN_EXPERT'),
  param('id').isMongoId(), body('text').isString().trim().isLength({ min: 1, max: 4000 }), validate, healthReportController.setConclusion)

export default router
