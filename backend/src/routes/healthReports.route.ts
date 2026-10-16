import { Router } from 'express'
import { body, param, query } from 'express-validator'
import * as healthReportController from '@/controllers/healthReports.controller'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'

const router = Router()
router.use(authenticate)
// EXPERT-FR-005/006 (SRS mục 4.4: Farm Owner R, Domain Expert R, Technician/Admin không liên quan) —
// Farm Owner và Domain Expert đọc; chỉ Domain Expert viết kết luận
router.use(requireRole('FARM_OWNER', 'DOMAIN_EXPERT'))

router.get('/', query('zoneId').isMongoId(), validate, healthReportController.list)
// Đặt trước '/:id' để "preview" không bị hiểu là một id
router.get('/preview',
  query('zoneId').isMongoId(), query('from').isISO8601(), query('to').optional().isISO8601(), validate, healthReportController.preview)
router.get('/:id', param('id').isMongoId(), validate, healthReportController.getOne)
router.put('/:id/conclusion', requireRole('DOMAIN_EXPERT'),
  param('id').isMongoId(), body('text').isString().trim().isLength({ min: 1, max: 4000 }), validate, healthReportController.setConclusion)

export default router
