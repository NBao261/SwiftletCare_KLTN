import { Router } from 'express'
import { body, param } from 'express-validator'
import * as farmController from '@/controllers/farms'
import { authenticate, requireRole } from '@/middlewares/auth'
import { validate } from '@/middlewares/validate'

const router = Router()
router.use(authenticate)

router.get   ('/',             farmController.list)
router.post  ('/',             requireRole('FARM_OWNER','ADMIN'), [body('name').trim().notEmpty(), body('address').trim().notEmpty()], validate, farmController.create)
router.get   ('/:id',         [param('id').isMongoId()], validate, farmController.getOne)
router.put   ('/:id',         requireRole('FARM_OWNER','ADMIN'), [param('id').isMongoId()], validate, farmController.update)
router.delete('/:id',         requireRole('FARM_OWNER','ADMIN'), [param('id').isMongoId()], validate, farmController.remove)
router.post  ('/:id/members', requireRole('FARM_OWNER','ADMIN'), [param('id').isMongoId(), body('email').isEmail()], validate, farmController.inviteMember)

// Houses
router.post('/:id/houses',   requireRole('FARM_OWNER','ADMIN'), [param('id').isMongoId(), body('name').trim().notEmpty()], validate, farmController.createHouse)
router.get ('/:id/houses',   [param('id').isMongoId()], validate, farmController.listHouses)

// Zones (under house)
router.post('/houses/:houseId/zones', requireRole('FARM_OWNER','ADMIN'), farmController.createZone)
router.get ('/houses/:houseId/zones', farmController.listZones)
router.put ('/zones/:zoneId/thresholds', requireRole('FARM_OWNER','ADMIN'), farmController.updateThresholds)

export default router
