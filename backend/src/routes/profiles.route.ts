import { Router } from 'express'
import { body, param, query } from 'express-validator'
import * as profileController from '@/controllers/configProfiles.controller'
import { MAX_NAME_LENGTH } from '@/services/farm.service'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'

/**
 * EXPERT-FR-014, 015 — hồ sơ cấu hình (Report 3 §2.4): Farm Owner và Domain Expert của farm xem và soạn bản nháp; chỉ
 * Domain Expert duyệt, lưu trữ (BR-22, cả khi farm chưa có chuyên gia); chỉ Farm Owner áp cho các nhà. Farm Technician,
 * Administrator → 403. Khoảng giá trị và trạng thái: service kiểm (400, 409).
 */
const router = Router()
router.use(authenticate)

const READERS = ['FARM_OWNER', 'DOMAIN_EXPERT'] as const
const content = () => [
  body('name').isString().trim().notEmpty().isLength({ max: MAX_NAME_LENGTH }),
  body('stage').optional({ values: 'null' }).isString().isIn(['ATTRACTING', 'OCCUPIED']),
  body(['thresholds', 'fuzzy_tuning', 'detection_tuning', 'speaker_schedule']).optional({ values: 'null' }).isObject(),
]

router.get ('/', requireRole(...READERS), query('farmId').isString().isMongoId(),
  query('status').optional().isString().isIn(['DRAFT', 'APPROVED', 'ARCHIVED']),
  query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1 }), validate, profileController.list)
// BR-22 (Report 3 4.2.15) — Farm Owner soạn bản nháp để chuyên gia duyệt; duyệt và lưu trữ chỉ chuyên gia
router.post('/', requireRole(...READERS), body('farm_id').isString().isMongoId(), ...content(), validate, profileController.create)
router.get ('/:id', requireRole(...READERS), param('id').isMongoId(), validate, profileController.getOne)
router.put ('/:id', requireRole(...READERS), param('id').isMongoId(), ...content(), validate, profileController.update)
router.post('/:id/approve', requireRole('DOMAIN_EXPERT'), param('id').isMongoId(), validate, profileController.approve)
router.post('/:id/archive', requireRole('DOMAIN_EXPERT'), param('id').isMongoId(), validate, profileController.archive)
router.post('/:id/apply', requireRole('FARM_OWNER'), param('id').isMongoId(),
  body('house_ids').isArray({ min: 1 }), body('house_ids.*').isString().isMongoId(), validate, profileController.apply)

export default router
