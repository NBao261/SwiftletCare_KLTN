import { Router } from 'express'
import { param } from 'express-validator'
import * as inventoryController from '@/controllers/inventory.controller'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'

const router = Router()
router.use(authenticate)
router.use(requireRole('SALES_STAFF', 'FARM_OWNER'))

/** GET /inventory/:productId – Module SALES, Giai đoạn 2 */
router.get('/:productId', param('productId').isMongoId(), validate, inventoryController.getByProduct)

export default router
