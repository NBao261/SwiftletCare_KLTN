import { Router } from 'express'
import { param } from 'express-validator'
import * as returnRequestController from '@/controllers/returnRequests'
import { authenticate, requireRole } from '@/middlewares/auth'
import { validate } from '@/middlewares/validate'

const router = Router()
router.use(authenticate)

/** Module SALES – Giai đoạn 2 */
router.put('/:id/verify',  requireRole('SALES_STAFF'), param('id').isMongoId(), validate, returnRequestController.verify)
router.put('/:id/resolve', requireRole('ADMIN'), param('id').isMongoId(), validate, returnRequestController.resolve)

export default router
