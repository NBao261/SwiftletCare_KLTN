import { Router } from 'express'
import { body } from 'express-validator'
import * as authController from '@/controllers/auth.controller'
import { authenticate } from '@/middlewares/auth.middleware'
import { loginLimiter, passwordResetLimiter, refreshLimiter } from '@/middlewares/rateLimiter.middleware'
import { validate } from '@/middlewares/validate.middleware'

const router = Router()

// SEC-NFR-004 — đếm theo IP, đứng trước validate để request sai định dạng cũng bị tính.
// Gửi mã đặt lại mật khẩu đếm mọi lần; đăng nhập/nhập mã chỉ đếm lần sai (loginLimiter).
// Không có đăng ký công khai, không đăng nhập bằng OTP (Report 3 §1.2, §8): tài khoản do Admin
// tạo (AUTH-FR-005c) hoặc từ link lời mời (POST /invitations/:token/create-account, AUTH-FR-010).

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

/**
 * PUT /auth/password — đổi mật khẩu khi đang đăng nhập; route duy nhất (cùng logout)
 * còn dùng được khi đang giữ mật khẩu tạm Admin cấp. loginLimiter: chỉ đếm lần nhập
 * sai mật khẩu hiện tại, chống dò mật khẩu bằng một phiên bị chiếm.
 */
router.put(
  '/password',
  authenticate,
  loginLimiter,
  [body('current_password').isString().notEmpty(), body('new_password').isString().isLength({ min: 8 }).withMessage('Password must be at least 8 characters')],
  validate,
  authController.changePassword,
)

/** POST /auth/logout – AUTH-FR-006 */
router.post('/logout', authenticate, authController.logout)

/** POST /auth/forgot-password – AUTH-FR-009 */
router.post('/forgot-password', passwordResetLimiter, [body('email').isEmail()], validate, authController.forgotPassword)

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
