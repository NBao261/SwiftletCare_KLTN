import { Router } from 'express'
import { param, body } from 'express-validator'
import * as alertController from '@/controllers/alerts'
import { authenticate } from '@/middlewares/auth'
import { validate } from '@/middlewares/validate'

const router = Router()
router.use(authenticate)

/** GET  /alerts?farmId=&severity=&status=&page=&limit= – ALERT-FR-007 */
router.get('/',     alertController.list)

/** GET  /alerts/:id */
router.get('/:id',  [param('id').isMongoId()], validate, alertController.getOne)

/** PUT  /alerts/:id/acknowledge – ALERT-FR-009 */
router.put(
  '/:id/acknowledge',
  [param('id').isMongoId(), body('note').optional().isString()],
  validate,
  alertController.acknowledge,
)

export default router
