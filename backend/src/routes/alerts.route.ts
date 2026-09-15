import { Router } from 'express'
import { param, body } from 'express-validator'
import * as alertController from '@/controllers/alerts.controller'
import { authenticate } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'

const router = Router()
router.use(authenticate)

router.get('/',    alertController.list)
router.get('/:id', param('id').isMongoId(), validate, alertController.getOne)
router.put(
  '/:id/acknowledge',
  [param('id').isMongoId(), body('note').optional().isString()],
  validate,
  alertController.acknowledge,
)

export default router
