import { Router } from 'express'
import { query } from 'express-validator'
import * as analyticsController from '@/controllers/analytics.controller'
import { authenticate } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'

const router = Router()
router.use(authenticate)

router.get('/bird-count/daily',  query('zoneId').isMongoId(), validate, analyticsController.birdCountDaily)
router.get('/bird-count/trends', query('zoneId').isMongoId(), validate, analyticsController.birdCountTrends)
router.get('/correlation',       query('zoneId').isMongoId(), validate, analyticsController.envBirdCorrelation)

export default router
