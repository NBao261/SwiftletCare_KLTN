import { Router } from 'express'
import { query } from 'express-validator'
import * as analyticsController from '@/controllers/analytics'
import { authenticate } from '@/middlewares/auth'
import { validate } from '@/middlewares/validate'

const router = Router()
router.use(authenticate)

/** GET /analytics/bird-count/daily?zoneId=&from=&to= – ANALYTICS-FR-003 */
router.get('/bird-count/daily',  [query('zoneId').isMongoId()], validate, analyticsController.birdCountDaily)

/** GET /analytics/bird-count/trends?zoneId=&days= – ANALYTICS-FR-004 */
router.get('/bird-count/trends', [query('zoneId').isMongoId()], validate, analyticsController.birdCountTrends)

/** GET /analytics/correlation?zoneId=&metric=&days= – ANALYTICS-FR-005 */
router.get('/correlation',       [query('zoneId').isMongoId()], validate, analyticsController.envBirdCorrelation)

export default router
