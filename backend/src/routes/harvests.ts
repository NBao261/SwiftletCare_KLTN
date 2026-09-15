import { Router } from 'express'
import { body, param } from 'express-validator'
import * as harvestController from '@/controllers/harvests'
import { authenticate, requireRole } from '@/middlewares/auth'
import { validate } from '@/middlewares/validate'

const router = Router()
router.use(authenticate)
router.use(requireRole('FARM_OWNER', 'ADMIN'))

/** MARKET-FR-001..005 */
router.post  ('/',    body('zone_id').isMongoId(), body('harvest_date').isISO8601(), validate, harvestController.create)
router.get   ('/',    harvestController.list)
router.get   ('/:id', param('id').isMongoId(), validate, harvestController.getOne)
router.put   ('/:id', param('id').isMongoId(), validate, harvestController.update)
router.delete('/:id', param('id').isMongoId(), validate, harvestController.remove)

export default router
