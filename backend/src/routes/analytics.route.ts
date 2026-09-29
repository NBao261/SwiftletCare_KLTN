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
// ANALYTICS-FR-008 — hiệu quả bộ điều khiển mờ (dữ liệu để chỉnh hệ số ENV-FR-021)
router.get('/control/performance', query('zoneId').isMongoId(), validate, analyticsController.controlPerformance)
// ANALYTICS-FR-009 — dự báo độ ẩm/nhiệt độ 60 phút tới (Holt trend tắt dần) + MAE đánh giá lùi
// ANALYTICS-FR-010 — gợi ý hệ số mờ từ mô hình học trên dữ liệu thật (chỉ đề xuất, không tự áp dụng)
router.get('/control/suggestion', query('zoneId').isMongoId(), validate, analyticsController.tuningSuggestion)
router.get('/forecast',          query('zoneId').isMongoId(), validate, analyticsController.forecast)

// VISION/ANALYTICS-FR-002/003 — phụ thuộc module VISION, trả rỗng cho tới khi có camera
router.get('/bird-count/daily',  query('zoneId').isMongoId(), validate, analyticsController.birdCountDaily)
router.get('/bird-count/trends', query('zoneId').isMongoId(), validate, analyticsController.birdCountTrends)
router.get('/correlation',       query('zoneId').isMongoId(), validate, analyticsController.envBirdCorrelation)

export default router
