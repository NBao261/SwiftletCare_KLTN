import { Router } from 'express'
import { body, param, query } from 'express-validator'
import * as maintenanceController from '@/controllers/maintenance.controller'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'
import { MAINTENANCE_BASES, MAINTENANCE_EQUIPMENT, MAINTENANCE_PLAN_STATES } from '@/models/maintenancePlan.model'

const router = Router()
router.use(authenticate)

// Report 3 §2.4: Farm Owner định nghĩa kế hoạch và checklist; Farm Technician đọc (nhà được giao, service kiểm nhà);
// Domain Expert đọc và góp ý; Administrator không thấy
const READERS = ['FARM_OWNER', 'DOMAIN_EXPERT', 'FARM_TECHNICIAN'] as const
const idParam = param('id').isMongoId()
const scope = [
  query('farmId').optional().isString().isMongoId(),
  query('houseId').optional().isString().isMongoId(),
]
const checklist = (field: ReturnType<typeof body>) =>
  field.isArray({ min: 1, max: 30 }).withMessage('Checklist có 1 đến 30 mục')

router.get('/plans', requireRole(...READERS), ...scope,
  query('state').optional().isString().isIn(MAINTENANCE_PLAN_STATES), validate, maintenanceController.listPlans)
router.post('/plans', requireRole('FARM_OWNER'),
  body('house_id').isString().isMongoId(),
  body('equipment').isString().isIn(MAINTENANCE_EQUIPMENT),
  body('basis').isString().isIn(MAINTENANCE_BASES),
  // OPS-FR-005 — khoảng ≤ 0 → 422
  body('interval').isFloat({ gt: 0 }).withMessage('Khoảng bảo trì phải lớn hơn 0').toFloat(),
  checklist(body('checklist_template')), body('checklist_template.*').isString().trim().notEmpty().isLength({ max: 200 }),
  body('source').isString().trim().notEmpty().withMessage('Cần ghi nguồn của chu kỳ').isLength({ max: 300 }),
  body('note').optional().isString().isLength({ max: 1000 }),
  validate, maintenanceController.createPlan)
router.put('/plans/:id', requireRole('FARM_OWNER'), idParam,
  body('interval').optional().isFloat({ gt: 0 }).withMessage('Khoảng bảo trì phải lớn hơn 0').toFloat(),
  checklist(body('checklist_template').optional()), body('checklist_template.*').optional().isString().trim().notEmpty().isLength({ max: 200 }),
  body('source').optional().isString().trim().notEmpty().isLength({ max: 300 }),
  body('note').optional().isString().isLength({ max: 1000 }),
  validate, maintenanceController.updatePlan)
router.delete('/plans/:id', requireRole('FARM_OWNER'), idParam, validate, maintenanceController.retirePlan)
router.post('/plans/:id/comments', requireRole('DOMAIN_EXPERT'), idParam,
  body('text').isString().trim().notEmpty().isLength({ max: 1000 }), validate, maintenanceController.addComment)
router.get('/due', requireRole(...READERS), ...scope, validate, maintenanceController.listDue)

export default router
