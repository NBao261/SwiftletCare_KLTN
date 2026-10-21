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
// ANALYTICS-FR-011 — tỷ lệ thời gian tự động, tính từ lịch sử can thiệp tay (ENV-FR-019)
router.get('/autonomy',            query('zoneId').isMongoId(), validate, analyticsController.autonomy)
// ANALYTICS-FR-009 — dự báo độ ẩm/nhiệt độ 60 phút tới (Holt trend tắt dần) + MAE đánh giá lùi
// ANALYTICS-FR-010 — gợi ý hệ số mờ từ mô hình học trên dữ liệu thật (chỉ đề xuất, không tự áp dụng)
router.get('/control/suggestion', query('zoneId').isMongoId(), validate, analyticsController.tuningSuggestion)
router.get('/forecast',          query('zoneId').isMongoId(), validate, analyticsController.forecast)

// VISION/ANALYTICS-FR-002/003 — đếm chim là của cả nhà yến (SRS v2.1.8): `houseId`; `zoneId` là cách
// gửi cũ (frontend/mobile trước v2.1.8), được quy ra House chứa Zone. Trả rỗng cho tới khi có camera.
const birdScope = [
  query('houseId').optional().isString().isMongoId(),
  query('zoneId').optional().isString().isMongoId(),
  query('houseId').if(query('zoneId').not().exists()).exists().withMessage('Cần houseId'),
]
// isISO8601 (kể cả strict) vẫn nhận dạng JS không đọc được như '2026-283', '2026-W43' → Invalid Date → 500;
// kiểm tra luôn bằng Date.parse để trả 422
const dateRange = ['from', 'to'].map(name =>
  query(name).optional().isString().isISO8601().custom((v: string) => !Number.isNaN(Date.parse(v))).withMessage(`${name} không phải ngày hợp lệ`))
router.get('/bird-count/daily',  ...birdScope, ...dateRange, validate, analyticsController.birdCountDaily)
router.get('/bird-count/trends', ...birdScope, validate, analyticsController.birdCountTrends)
// VISION-FR-012 — số hôm nay của nhà yến khi mở trang; sau đó socket BIRD_COUNT_UPDATE (room house:<id>) gửi cùng con số
router.get('/bird-count/current', ...birdScope, validate, analyticsController.birdCountCurrent)
// VISION-FR-017 — số đếm theo khoảng 5 phút (biểu đồ theo giờ, bối cảnh ±30 phút khi kiểm chứng cảnh báo)
router.get('/bird-count/buckets',
  ...birdScope, ...dateRange, validate,
  analyticsController.birdCountBuckets)
// Môi trường đo theo Zone, tỷ lệ chim về lấy của nhà yến chứa Zone
router.get('/correlation',       query('zoneId').isMongoId(), validate, analyticsController.envBirdCorrelation)

export default router
