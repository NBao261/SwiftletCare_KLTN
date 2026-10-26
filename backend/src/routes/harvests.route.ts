import { Router } from 'express'
import { body, param } from 'express-validator'
import * as harvestController from '@/controllers/harvests.controller'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'

const router = Router()
router.use(authenticate)

/** HARVEST-FR-001..005 — Farm Owner ghi nhận; Domain Expert chỉ xem (mục 4.4) */
const canRead  = requireRole('FARM_OWNER', 'DOMAIN_EXPERT')
const canWrite = requireRole('FARM_OWNER')
router.post  ('/',    canWrite, body('zone_id').isMongoId(), body('harvest_date').isISO8601(), validate, harvestController.create)
router.get   ('/',    canRead,  harvestController.list)
router.get   ('/:id', canRead,  param('id').isMongoId(), validate, harvestController.getOne)
router.put   ('/:id', canWrite, param('id').isMongoId(), validate, harvestController.update)
router.delete('/:id', canWrite, param('id').isMongoId(), validate, harvestController.remove)

export default router
