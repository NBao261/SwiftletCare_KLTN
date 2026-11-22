import { Router } from 'express'
import { body } from 'express-validator'
import * as authController from '@/controllers/auth.controller'
import { authenticate } from '@/middlewares/auth.middleware'
import { loginLimiter, passwordResetLimiter, refreshLimiter } from '@/middlewares/rateLimiter.middleware'
import { validate } from '@/middlewares/validate.middleware'

const router = Router()

// SEC-NFR-004: đứng trước validate để request sai định dạng cũng bị đếm

router.post(
  '/login',
  loginLimiter,
  [body('email').isEmail(), body('password').notEmpty()],
  validate,
  authController.login,
)

router.post('/refresh', refreshLimiter, authController.refresh)

/** Dùng được khi giữ mật khẩu tạm; loginLimiter chống dò mật khẩu hiện tại */
router.put(
  '/password',
  authenticate,
  loginLimiter,
  [body('current_password').isString().notEmpty(), body('new_password').isString().isLength({ min: 8 }).withMessage('Password must be at least 8 characters')],
  validate,
  authController.changePassword,
)

router.post('/logout', authenticate, authController.logout)
router.get('/me', authenticate, authController.me)

router.post('/forgot-password', passwordResetLimiter, [body('email').isEmail()], validate, authController.forgotPassword)

router.post(
  '/reset-password',
  loginLimiter,
  [body('email').isEmail(), body('token').notEmpty(), body('newPassword').isLength({ min: 8 })],
  validate,
  authController.resetPassword,
)

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
router.put('/notification-preferences', authenticate,
  body('push').optional().isBoolean({ strict: true }),
  body('telegram').optional().isBoolean({ strict: true }),
  // Chuỗi rỗng = tắt giờ im lặng
  body(['quiet_hours.start', 'quiet_hours.end']).optional().isString()
    .custom((v: string) => v === '' || HHMM.test(v)).withMessage('Giờ dạng HH:mm, hoặc rỗng để tắt giờ im lặng'),
  body('by_severity').optional().isObject(),
  // null = bỏ ghi đè của mức đó
  body(['by_severity.CRITICAL', 'by_severity.HIGH', 'by_severity.MEDIUM', 'by_severity.LOW'])
    .optional({ values: 'null' }).isObject(),
  body('by_severity.*.push').optional().isBoolean({ strict: true }),
  body('by_severity.*.telegram').optional().isBoolean({ strict: true }),
  validate, authController.updateNotificationPreferences)

router.post('/telegram/link', authenticate, authController.createTelegramLink)
router.delete('/telegram/link', authenticate, authController.unlinkTelegram)

router.post('/delete-request', authenticate, authController.requestDeletion)
router.delete('/delete-request', authenticate, authController.cancelDeletion)

export default router
