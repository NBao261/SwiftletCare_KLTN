import { Router } from 'express'
import { body, param } from 'express-validator'
import * as ticketController from '@/controllers/tickets'
import { authenticate, requireRole } from '@/middlewares/auth'
import { validate } from '@/middlewares/validate'

const router = Router()
router.use(authenticate)

/** Module TICKET – SRS §5.9, §9.1 */
router.post('/',                   requireRole('FARM_OWNER','ADMIN'), body('type').notEmpty(), validate, ticketController.create)
router.get ('/',                   ticketController.list)
router.get ('/kpi',                requireRole('ADMIN'), ticketController.kpi)
router.get ('/:id',                param('id').isMongoId(), validate, ticketController.getOne)
router.put ('/:id/status',         requireRole('TECHNICIAN','ADMIN'), param('id').isMongoId(), body('status').notEmpty(), validate, ticketController.updateStatus)
router.post('/:id/notes',          param('id').isMongoId(), body('content').notEmpty(), validate, ticketController.addNote)
router.put ('/:id/sat-checklist',  requireRole('TECHNICIAN','ADMIN'), param('id').isMongoId(), validate, ticketController.updateSatChecklist)
router.post('/:id/escalate',       requireRole('TECHNICIAN','ADMIN'), param('id').isMongoId(), validate, ticketController.escalate)
router.post('/:id/rating',         requireRole('FARM_OWNER','ADMIN'), param('id').isMongoId(), body('satisfaction_rating').isInt({ min: 1, max: 5 }), validate, ticketController.rate)

export default router
