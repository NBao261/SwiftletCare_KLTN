import { Router } from 'express'
import { body, param } from 'express-validator'
import * as ticketController from '@/controllers/tickets.controller'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'

const router = Router()
router.use(authenticate)

/** Module TICKET – SRS §5.9, §9.1 */
router.post('/',                   requireRole('FARM_OWNER','ADMIN'), body('type').notEmpty(), validate, ticketController.create)
router.get ('/',                   ticketController.list)
router.get ('/kpi',                requireRole('ADMIN'), ticketController.kpi)
router.get ('/:id',                param('id').isMongoId(), validate, ticketController.getOne)
router.put ('/:id/status',         requireRole('TECHNICIAN','ADMIN'), param('id').isMongoId(), body('status').notEmpty(), validate, ticketController.updateStatus)
// Farm Owner tự huỷ ticket của mình khi đã tự khắc phục / không cần lắp nữa
// (Flow 9 case 6c, Flow 9b case 4a) — khác /status ở chỗ không đòi SAT checklist
router.put ('/:id/cancel',         requireRole('FARM_OWNER','ADMIN'), param('id').isMongoId(), body('reason').notEmpty(), validate, ticketController.cancel)
router.post('/:id/notes',          param('id').isMongoId(), body('content').notEmpty(), validate, ticketController.addNote)
router.put ('/:id/sat-checklist',  requireRole('TECHNICIAN','ADMIN'), param('id').isMongoId(), validate, ticketController.updateSatChecklist)
router.post('/:id/escalate',       requireRole('TECHNICIAN','ADMIN'), param('id').isMongoId(), validate, ticketController.escalate)
router.post('/:id/rating',         requireRole('FARM_OWNER','ADMIN'), param('id').isMongoId(), body('satisfaction_rating').isInt({ min: 1, max: 5 }), validate, ticketController.rate)
// TICKET-FR-005b — Admin toàn quyền can thiệp: đổi Technician/priority/ngày hẹn/status bất kỳ lúc nào
router.put ('/:id/admin-override', requireRole('ADMIN'),
  param('id').isMongoId(), body('reason').notEmpty(),
  body('assigned_to').optional().isMongoId(),
  body('priority').optional().isIn(['P1', 'P2', 'P3']),
  body('status').optional().isIn(['NEW', 'IN_PROGRESS', 'AWAITING_FIELD_CONFIRMATION', 'CLOSED']),
  body('scheduled_visit_at').optional().isISO8601(),
  // toBoolean(): isBoolean() chỉ kiểm tra, không đổi kiểu — chuỗi "false"/"0" lọt xuống service là truthy và bỏ qua kiểm tra khu vực
  body('force').optional().isBoolean().toBoolean(),
  validate, ticketController.adminOverride)

export default router
