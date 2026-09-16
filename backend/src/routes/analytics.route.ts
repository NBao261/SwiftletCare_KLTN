import { Router } from 'express'
import { query } from 'express-validator'
import * as analyticsController from '@/controllers/analytics.controller'
import { authenticate } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'

const router = Router()
router.use(authenticate)

// ANALYTICS-FR-001/005 — biểu đồ môi trường + so sánh đa Zone (Farm Owner dùng hằng ngày)
router.get('/env/summary',       query('zoneId').isMongoId(), validate, analyticsController.envSummary)
router.get('/env/compare',       query('zoneIds').notEmpty(), validate, analyticsController.envCompare)

// VISION/ANALYTICS-FR-002/003 — phụ thuộc module VISION, trả rỗng cho tới khi có camera
router.get('/bird-count/daily',  query('zoneId').isMongoId(), validate, analyticsController.birdCountDaily)
router.get('/bird-count/trends', query('zoneId').isMongoId(), validate, analyticsController.birdCountTrends)
router.get('/correlation',       query('zoneId').isMongoId(), validate, analyticsController.envBirdCorrelation)

export default router
