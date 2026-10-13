import { Router } from 'express'
import { body, param, query } from 'express-validator'
import * as scheduleController from '@/controllers/maintenanceSchedules.controller'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'

const router = Router()
router.use(authenticate)

/** TICKET-FR-013 — Admin/Technician lên lịch bảo trì định kỳ theo Farm; Farm Owner chỉ xem */
router.get('/', requireRole('FARM_OWNER', 'TECHNICIAN', 'ADMIN'), query('farmId').optional().isMongoId(), validate, scheduleController.list)
router.post('/', requireRole('TECHNICIAN', 'ADMIN'),
  body('farm_id').isMongoId(), body('zone_id').optional().isMongoId(),
  body('description').isString().trim().isLength({ min: 1, max: 500 }),
  body('interval_days').isInt({ min: 1, max: 365 }).toInt(),
  body('next_due_at').isISO8601(),
  validate, scheduleController.create)
router.put('/:id', requireRole('TECHNICIAN', 'ADMIN'), param('id').isMongoId(),
  body('zone_id').optional().isMongoId(),
  body('description').optional().isString().trim().isLength({ min: 1, max: 500 }),
  body('interval_days').optional().isInt({ min: 1, max: 365 }).toInt(),
  body('next_due_at').optional().isISO8601(),
  body('is_active').optional().isBoolean().toBoolean(),
  validate, scheduleController.update)
router.delete('/:id', requireRole('TECHNICIAN', 'ADMIN'), param('id').isMongoId(), validate, scheduleController.remove)

export default router
