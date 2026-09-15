import { Router } from 'express'
import { body, param } from 'express-validator'
import * as marketController from '@/controllers/marketplace'
import { authenticate, requireRole } from '@/middlewares/auth'
import { validate } from '@/middlewares/validate'

const router = Router()

/** MARKET-FR-006..013 – public browsing endpoints require no auth */
router.get ('/listings',              marketController.listPublic)
router.get ('/listings/:id',          param('id').isMongoId(), validate, marketController.getOne)
router.get ('/trace/:traceCode',      marketController.traceByCode)
router.post('/listings/:id/inquiries',param('id').isMongoId(), body('buyer_name').notEmpty(), body('message').notEmpty(), validate, marketController.createInquiry)
router.get ('/farms/:id/profile',     param('id').isMongoId(), validate, marketController.farmProfile)

/** Farm Owner only */
router.post('/listings',                requireRole('FARM_OWNER','ADMIN'), authenticate, body('harvest_batch_id').isMongoId(), validate, marketController.createListing)
router.put ('/listings/:id',            requireRole('FARM_OWNER','ADMIN'), authenticate, param('id').isMongoId(), validate, marketController.updateListing)
router.get ('/listings/:id/inquiries',  authenticate, requireRole('FARM_OWNER','ADMIN'), param('id').isMongoId(), validate, marketController.listInquiries)
router.get ('/listings/:id/stats',      authenticate, requireRole('FARM_OWNER','ADMIN'), param('id').isMongoId(), validate, marketController.listingStats)

export default router
