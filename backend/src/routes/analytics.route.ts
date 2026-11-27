import { Router } from 'express'
import { query } from 'express-validator'
import * as analyticsController from '@/controllers/analytics.controller'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'
import { isPeriodParam } from '@/utils/period.util'

const router = Router()
router.use(authenticate)
// Farm Technician chỉ ở nhà được giao (service kiểm); Admin không
router.use(requireRole('FARM_OWNER', 'DOMAIN_EXPERT', 'FARM_TECHNICIAN'))

router.get('/env/summary',       query('zoneId').isMongoId(), validate, analyticsController.envSummary)
// Danh sách ID cách nhau bằng dấu phẩy, tối đa 6 (service cũng kiểm)
router.get('/env/compare',       query('zoneIds').isString().bail().custom((value: string) => {
  const ids = value.split(',').filter(Boolean)
  return ids.length >= 1 && ids.length <= 6 && ids.every(id => /^[a-fd]{24}$/i.test(id))
}).withMessage('zoneIds là 1-6 ID cách nhau bằng dấu phẩy'), validate, analyticsController.envCompare)
router.get('/control/performance', query('zoneId').isMongoId(), validate, analyticsController.controlPerformance)
router.get('/autonomy',            query('zoneId').isMongoId(), validate, analyticsController.autonomy)
router.get('/control/suggestion', requireRole('FARM_OWNER', 'DOMAIN_EXPERT'), query('zoneId').isMongoId(), validate, analyticsController.tuningSuggestion)
router.get('/forecast',          query('zoneId').isMongoId(), validate, analyticsController.forecast)

// zoneId cũ được quy ra House chứa Zone
const birdScope = [
  query('houseId').optional().isString().isMongoId(),
  query('zoneId').optional().isString().isMongoId(),
  query('houseId').if(query('zoneId').not().exists()).exists().withMessage('Cần houseId'),
]
// isISO8601 vẫn nhận '2026-W43' (Invalid Date, 500): kiểm thêm Date.parse để trả 422
const dateRange = ['from', 'to'].map(name =>
  query(name).optional().isString().isISO8601().custom((v: string) => !Number.isNaN(Date.parse(v))).withMessage(`${name} không phải ngày hợp lệ`))
router.get('/bird-count/daily',  ...birdScope, ...dateRange, validate, analyticsController.birdCountDaily)
router.get('/bird-count/trends', ...birdScope, validate, analyticsController.birdCountTrends)
router.get('/bird-count/current', ...birdScope, validate, analyticsController.birdCountCurrent)
router.get('/bird-count/buckets',
  ...birdScope, ...dateRange, validate,
  analyticsController.birdCountBuckets)
const energyPeriod = ['from', 'to'].map(name =>
  query(name).optional().isString().bail().custom(isPeriodParam).withMessage(`${name} phải là YYYY-MM-DD hoặc ngày giờ ISO có múi giờ`))
router.get('/energy', query('houseId').isString().bail().isMongoId(), ...energyPeriod, validate, analyticsController.energy)
router.get('/correlation',       query('zoneId').isMongoId(), validate, analyticsController.envBirdCorrelation)

export default router
