import { Router } from 'express'
import { body, param, query } from 'express-validator'
import * as notificationController from '@/controllers/notifications.controller'
import { authenticate } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'

const router = Router()
// EXPERT-FR-006/007 — hộp thông báo của chính người gọi: mọi role đã đăng nhập, service lọc theo user
router.use(authenticate)

router.get('/', query('unread').optional().isString().isIn(['true', 'false']), validate, notificationController.list)
// Đặt trước '/:id/read' cho rõ ràng — 'read-all' không phải một id
router.put('/read-all', notificationController.markAllRead)
router.put('/:id/read', param('id').isMongoId(), validate, notificationController.markRead)
// ALERT-FR-002 — FCM device token của máy đang đăng nhập (đăng ký sau khi đăng nhập, gỡ khi đăng xuất)
router.post('/push-tokens', body('token').isString().trim().notEmpty(), body('platform').isIn(['android', 'ios']), validate, notificationController.registerPushToken)
router.delete('/push-tokens', body('token').isString().trim().notEmpty(), validate, notificationController.removePushToken)

export default router
