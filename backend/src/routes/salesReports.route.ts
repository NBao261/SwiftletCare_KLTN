import { Router } from 'express'
import * as salesReportsController from '@/controllers/salesReports.controller'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'

const router = Router()
router.use(authenticate)

/** GET /sales-reports – Module SALES, Giai đoạn 2 */
router.get('/', requireRole('SALES_STAFF','FARM_OWNER','ADMIN'), salesReportsController.get)

export default router
