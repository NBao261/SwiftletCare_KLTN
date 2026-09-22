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
// TICKET-FR-004b — Technician không sắp xếp được đúng giờ Farm Owner chọn thì tự dời, lý do bắt buộc
router.put ('/:id/scheduled-date',   requireRole('TECHNICIAN','ADMIN'), param('id').isMongoId(),
  body('scheduled_visit_at').isISO8601(), body('reason').trim().notEmpty(), validate, ticketController.reschedule)
// Flow 9 case 4a — Technician bị gán nhầm xin chuyển cho người khác
router.post('/:id/reassign-request', requireRole('TECHNICIAN'), param('id').isMongoId(),
  body('reason').trim().notEmpty(), validate, ticketController.requestReassign)
// TICKET-FR-014..017, Flow 23 — chat Farm Owner ↔ Technician phụ trách (realtime qua Socket, REST để tải lịch sử/gửi dự phòng)
router.get ('/:id/messages', requireRole('FARM_OWNER','TECHNICIAN','ADMIN'), param('id').isMongoId(), validate, ticketController.listMessages)
router.post('/:id/messages', requireRole('FARM_OWNER','TECHNICIAN','ADMIN'), param('id').isMongoId(),
  body('content').isString().trim().isLength({ min: 1, max: 2000 }),
  body('client_message_id').optional().isString().isLength({ max: 100 }),
  validate, ticketController.sendMessage)
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
