import { Router } from 'express'
import { body, param, query } from 'express-validator'
import * as notificationController from '@/controllers/notifications.controller'
import { authenticate } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'

const router = Router()
// Service lọc theo user
router.use(authenticate)

router.get('/', query('unread').optional().isString().isIn(['true', 'false']), validate, notificationController.list)
// Trước '/:id/read'
router.put('/read-all', notificationController.markAllRead)
router.put('/:id/read', param('id').isMongoId(), validate, notificationController.markRead)
router.post('/push-tokens', body('token').isString().trim().notEmpty(), body('platform').isIn(['android', 'ios']), validate, notificationController.registerPushToken)
router.delete('/push-tokens', body('token').isString().trim().notEmpty(), validate, notificationController.removePushToken)

export default router
