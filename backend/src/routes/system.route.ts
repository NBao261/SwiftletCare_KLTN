import { Router } from 'express'
import { body, query } from 'express-validator'
import * as systemController from '@/controllers/system.controller'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'
import { THRESHOLD_KEYS, THRESHOLD_LIMITS } from '@/utils/thresholds.util'

const router = Router()
router.use(authenticate, requireRole('ADMIN'))

/** Module SYSTEM – SRS §5.11 */
router.get('/audit-logs',
  query('actorId').optional().isMongoId(),
  query('targetId').optional().isMongoId(),
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  validate,
  systemController.listAuditLogs,
)

router.get('/settings/default-thresholds', systemController.getDefaultThresholds)
router.put('/settings/default-thresholds',
  ...THRESHOLD_KEYS.map(key => body(key).optional().isFloat({ min: THRESHOLD_LIMITS[key].min, max: THRESHOLD_LIMITS[key].max })),
  validate,
  systemController.updateDefaultThresholds,
)

router.get('/settings/sla', systemController.getSlaHours)
router.put('/settings/sla',
  ...['P1', 'P2', 'P3'].flatMap(p => [
    body(`${p}.response_hours`).optional().isFloat({ gt: 0 }),
    body(`${p}.resolve_hours`).optional().isFloat({ gt: 0 }),
  ]),
  validate,
  systemController.updateSlaHours,
)

// TICKET-FR-005 — ngưỡng quá tải: Technician có từ N ticket mở trở lên không được Router gán thêm
router.get('/settings/ticket-routing', systemController.getTicketRouting)
router.put('/settings/ticket-routing',
  body('max_open_tickets_per_technician').isInt({ min: 1, max: 100 }).toInt(),
  validate,
  systemController.updateTicketRouting,
)

router.get('/health-overview', systemController.getHealthOverview)

export default router
