import { Router } from 'express'
import { body, param, query } from 'express-validator'
import * as recommendationController from '@/controllers/recommendations.controller'
import { MAX_NAME_LENGTH } from '@/services/farm.service'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'

/**
 * EXPERT-FR-016…019 — vòng khuyến nghị (Report 3 §2.4): Domain Expert viết và bật/tắt luật, Farm Owner viết luật chờ chuyên gia bật (BR-22);
 * Farm Owner chấp nhận hoặc từ chối khuyến nghị, Domain Expert và thợ của nhà chỉ đọc; Administrator → 403.
 * Khoảng giá trị và trạng thái: service kiểm (400, 409).
 */
const router = Router()
router.use(authenticate)

const pageQuery = [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1 })]
const ruleBody = () => [
  body('name').isString().trim().notEmpty().isLength({ max: MAX_NAME_LENGTH }),
  // EXPERT-FR-016 — chỉ số không hỗ trợ trả 400 (service kiểm), không phải 422 của validator
  body('indicator').isString(),
  body('comparison').isString(),
  body('value').isFloat().toFloat(),
  body('window_days').isInt().toInt(),
  body('action').isObject(),
  body('action.type').isString().isIn(['WORK_ORDER', 'PARAMETER_CHANGE']),
  body('source').isString().trim().notEmpty().isLength({ max: 500 }),
  body('active').optional().isBoolean().toBoolean(),
]

// Luật — khai báo trước `/:id` để `rules` không bị coi là id khuyến nghị
router.get ('/rules', requireRole('FARM_OWNER', 'DOMAIN_EXPERT'), query('farmId').isString().isMongoId(), ...pageQuery,
  validate, recommendationController.listRules)
router.get ('/rules/effects', requireRole('FARM_OWNER', 'DOMAIN_EXPERT'), query('farmId').isString().isMongoId(),
  validate, recommendationController.ruleEffects)
// EXPERT-FR-016, BR-22 (Report 3 4.2.15) — Farm Owner viết luật được; farm có chuyên gia thì luật chờ chuyên gia bật
router.post('/rules', requireRole('FARM_OWNER', 'DOMAIN_EXPERT'), body('farm_id').isString().isMongoId(), ...ruleBody(),
  validate, recommendationController.createRule)
router.put ('/rules/:id', requireRole('FARM_OWNER', 'DOMAIN_EXPERT'), param('id').isMongoId(), ...ruleBody(),
  validate, recommendationController.updateRule)

// Khuyến nghị — cần farmId hoặc houseId (thợ dùng houseId của nhà được giao)
router.get ('/', requireRole('FARM_OWNER', 'DOMAIN_EXPERT', 'FARM_TECHNICIAN'),
  query('farmId').if(query('houseId').not().exists()).isString().isMongoId(),
  query('houseId').optional().isString().isMongoId(),
  query('status').optional().isString().isIn(['OPEN', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'MEASURED']),
  ...pageQuery, validate, recommendationController.list)
router.get ('/:id', requireRole('FARM_OWNER', 'DOMAIN_EXPERT', 'FARM_TECHNICIAN'), param('id').isMongoId(),
  validate, recommendationController.getOne)
router.post('/:id/accept', requireRole('FARM_OWNER'), param('id').isMongoId(), validate, recommendationController.accept)
// EXPERT-FR-018 — từ chối thiếu lý do → 422
router.post('/:id/reject', requireRole('FARM_OWNER'), param('id').isMongoId(),
  body('reason').isString().trim().notEmpty().isLength({ max: 1000 }), validate, recommendationController.reject)

export default router
