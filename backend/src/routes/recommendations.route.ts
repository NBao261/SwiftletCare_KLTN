import { Router } from 'express'
import { body, param, query } from 'express-validator'
import * as recommendationController from '@/controllers/recommendations.controller'
import { MAX_NAME_LENGTH } from '@/services/farm.service'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'

const router = Router()
router.use(authenticate)

const pageQuery = [query('page').optional().isString().isInt({ min: 1 }), query('limit').optional().isString().isInt({ min: 1 })]
const ruleBody = () => [
  body('name').isString().trim().notEmpty().isLength({ max: MAX_NAME_LENGTH }),
  // Chỉ số không hỗ trợ: 400 ở service, không phải 422
  body('indicator').isString(),
  body('comparison').isString(),
  body('value').isFloat().toFloat(),
  body('window_days').isInt().toInt(),
  body('action').isObject(),
  body('action.type').isString().isIn(['WORK_ORDER', 'PARAMETER_CHANGE']),
  body('source').isString().trim().notEmpty().isLength({ max: 500 }),
  body('active').optional().isBoolean().toBoolean(),
]

// Trước '/:id'
router.get ('/rules', requireRole('FARM_OWNER', 'DOMAIN_EXPERT'), query('farmId').isString().isMongoId(), ...pageQuery,
  validate, recommendationController.listRules)
router.get ('/rules/effects', requireRole('FARM_OWNER', 'DOMAIN_EXPERT'), query('farmId').isString().isMongoId(),
  validate, recommendationController.ruleEffects)
router.post('/rules', requireRole('FARM_OWNER', 'DOMAIN_EXPERT'), body('farm_id').isString().isMongoId(), ...ruleBody(),
  validate, recommendationController.createRule)
router.put ('/rules/:id', requireRole('FARM_OWNER', 'DOMAIN_EXPERT'), param('id').isMongoId(), ...ruleBody(),
  validate, recommendationController.updateRule)

router.get ('/', requireRole('FARM_OWNER', 'DOMAIN_EXPERT', 'FARM_TECHNICIAN'),
  query('farmId').if(query('houseId').not().exists()).isString().isMongoId(),
  query('houseId').optional().isString().isMongoId(),
  query('status').optional().isString().isIn(['OPEN', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'MEASURED']),
  ...pageQuery, validate, recommendationController.list)
router.get ('/:id', requireRole('FARM_OWNER', 'DOMAIN_EXPERT', 'FARM_TECHNICIAN'), param('id').isMongoId(),
  validate, recommendationController.getOne)
router.post('/:id/accept', requireRole('FARM_OWNER'), param('id').isMongoId(), validate, recommendationController.accept)
router.post('/:id/reject', requireRole('FARM_OWNER'), param('id').isMongoId(),
  body('reason').isString().trim().notEmpty().isLength({ max: 1000 }), validate, recommendationController.reject)

export default router
