import { Router } from 'express'
import { body, param } from 'express-validator'
import * as productController from '@/controllers/products.controller'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'

const router = Router()

/** Module SALES – Giai đoạn 2 (§5.10, §9.1) */
router.get ('/', productController.listPublic) // Public

router.post('/:id/submit-review', authenticate, requireRole('SALES_STAFF','FARM_OWNER'), param('id').isMongoId(), validate, productController.submitReview)
router.put ('/:id/review',        authenticate, requireRole('ADMIN'), param('id').isMongoId(), body('review_status').notEmpty(), validate, productController.review)
router.post('/',                  authenticate, requireRole('SALES_STAFF','FARM_OWNER'), body('harvest_batch_id').isMongoId(), validate, productController.create)
router.put ('/:id',               authenticate, requireRole('SALES_STAFF','FARM_OWNER'), param('id').isMongoId(), validate, productController.update)

export default router
