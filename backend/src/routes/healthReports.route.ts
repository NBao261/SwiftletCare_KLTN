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
const readers = requireRole('FARM_OWNER', 'DOMAIN_EXPERT', 'FARM_TECHNICIAN')
const ownerOrExpert = requireRole('FARM_OWNER', 'DOMAIN_EXPERT')

// Trước '/:id'
const dayScope = [
  query('houseId').optional().isString().isMongoId(), query('farmId').optional().isString().isMongoId(),
  query('from').optional().isString().isDate({ format: 'YYYY-MM-DD', strictMode: true }),
  query('to').optional().isString().isDate({ format: 'YYYY-MM-DD', strictMode: true }),
]
const dayId = param('dayId').isMongoId()
router.get('/days', readers, ...dayScope, query('myRatingState').optional().isString().isIn(['PENDING', 'RATED', 'SKIPPED', 'EXPIRED']),
  validate, healthDayController.listDays)
router.get('/days.csv', readers, ...dayScope, query('lang').optional().isString().isIn(REASON_LANGS), validate, healthDayController.exportCsv)
router.get('/evaluation', ownerOrExpert, ...dayScope, query('role').optional().isString().isIn([...ASSESSOR_ROLES]), validate, healthDayController.evaluation)
router.get('/disagreements', ownerOrExpert, ...dayScope, validate, healthDayController.disagreements)
router.get('/days/:dayId', readers, dayId, validate, healthDayController.getDay)
const assessorOnly = requireRole(...ASSESSOR_ROLES)
router.post('/days/:dayId/rating', assessorOnly, dayId,
  body('rating').isIn(['GOOD', 'WATCH', 'ACTION']), body('note').optional().isString().trim().isLength({ max: 1000 }),
  validate, healthDayController.rate)
router.post('/days/:dayId/skip', assessorOnly, dayId, validate, healthDayController.skip)
router.patch('/days/:dayId/rating/note', assessorOnly, dayId, body('note').isString().trim().isLength({ min: 1, max: 1000 }), validate, healthDayController.addNote)

router.get('/', readers,
  query('houseId').optional().isString().isMongoId(), query('farmId').optional().isString().isMongoId(),
  query('kind').optional().isString().isIn(HOUSE_REPORT_KINDS),
  query('from').optional().isString().isDate({ format: 'YYYY-MM-DD', strictMode: true }),
  query('to').optional().isString().isDate({ format: 'YYYY-MM-DD', strictMode: true }),
  // toBoolean(): isBoolean() không đổi kiểu
  query('hasConclusion').optional().isString().isBoolean().toBoolean(),
  validate, healthReportController.list)
router.post('/', readers,
  body('houseId').isMongoId(),
  body('from').isDate({ format: 'YYYY-MM-DD', strictMode: true }), body('to').isDate({ format: 'YYYY-MM-DD', strictMode: true }),
  validate, healthReportController.createCustom)
router.get('/:id', readers, param('id').isMongoId(), validate, healthReportController.getOne)
router.put('/:id/conclusion', requireRole('DOMAIN_EXPERT'),
  param('id').isMongoId(), body('text').isString().trim().isLength({ min: 1, max: 4000 }), validate, healthReportController.setConclusion)

export default router
