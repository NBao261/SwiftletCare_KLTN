import { Router } from 'express'
import { body } from 'express-validator'
import * as authController from '@/controllers/auth.controller'
import { authenticate } from '@/middlewares/auth.middleware'
import { loginLimiter, otpSendLimiter, refreshLimiter } from '@/middlewares/rateLimiter.middleware'
import { validate } from '@/middlewares/validate.middleware'

const router = Router()

// SEC-NFR-004 — đếm theo IP, đứng trước validate để request sai định dạng cũng bị tính.
// Gửi email/OTP đếm mọi lần; đăng nhập/nhập mã chỉ đếm lần sai (loginLimiter).

/** POST /auth/register – AUTH-FR-001 */
router.post(
  '/register',
  otpSendLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('full_name').trim().notEmpty(),
  ],
  validate,
  authController.register,
)

/** POST /auth/login – AUTH-FR-002 */
router.post(
  '/login',
  loginLimiter,
  [body('email').isEmail(), body('password').notEmpty()],
  validate,
  authController.login,
)

/** POST /auth/refresh – AUTH-FR-003 */
router.post('/refresh', refreshLimiter, authController.refresh)

/** POST /auth/logout – AUTH-FR-006 */
router.post('/logout', authenticate, authController.logout)

/** POST /auth/otp/send – AUTH-FR-005 */
router.post('/otp/send', otpSendLimiter, [body('email').isEmail()], validate, authController.sendOtp)

/** POST /auth/otp/verify – AUTH-FR-005 */
router.post(
  '/otp/verify',
  loginLimiter,
  [body('email').isEmail(), body('otp').isLength({ min: 6, max: 6 }).isNumeric()],
  validate,
  authController.verifyOtp,
)

/** POST /auth/forgot-password – AUTH-FR-009 */
router.post('/forgot-password', otpSendLimiter, [body('email').isEmail()], validate, authController.forgotPassword)

/** POST /auth/reset-password – AUTH-FR-009 */
router.post(
  '/reset-password',
  loginLimiter,
  [body('email').isEmail(), body('token').notEmpty(), body('newPassword').isLength({ min: 8 })],
  validate,
  authController.resetPassword,
)

/** PUT /auth/notification-preferences – ALERT-FR-005/006 */
router.put('/notification-preferences', authenticate, authController.updateNotificationPreferences)

/** ALERT-FR-013 — liên kết / hủy liên kết bot Telegram để nhận cảnh báo ngoài ứng dụng */
router.post('/telegram/link', authenticate, authController.createTelegramLink)
router.delete('/telegram/link', authenticate, authController.unlinkTelegram)

/** POST /auth/delete-request – AUTH-FR-012 */
router.post('/delete-request', authenticate, authController.requestDeletion)
/** DELETE /auth/delete-request – AUTH-FR-012, đổi ý trước khi Admin xử lý */
router.delete('/delete-request', authenticate, authController.cancelDeletion)

export default router
