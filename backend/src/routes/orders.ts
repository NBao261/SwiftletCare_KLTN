import { Router } from 'express'
import { body, param } from 'express-validator'
import * as orderController from '@/controllers/orders'
import { authenticate, requireRole } from '@/middlewares/auth'
import { validate } from '@/middlewares/validate'

const router = Router()

/** Module SALES – Giai đoạn 2 (§9.1). POST/GET :orderCode hỗ trợ guest checkout (AUTH-FR-008) */
router.post('/',              body('shipping_address').notEmpty(), validate, orderController.create)
router.get ('/:orderCode',    param('orderCode').notEmpty(), validate, orderController.getByCode)
router.post('/:id/return-requests', param('id').isMongoId(), body('reason').notEmpty(), validate, orderController.createReturnRequest)

router.get ('/',               authenticate, requireRole('SALES_STAFF','ADMIN'), orderController.list)
router.put ('/:id/confirm',    authenticate, requireRole('SALES_STAFF'), param('id').isMongoId(), validate, orderController.confirm)
router.put ('/:id/status',     authenticate, requireRole('SALES_STAFF'), param('id').isMongoId(), body('status').notEmpty(), validate, orderController.updateStatus)

export default router
