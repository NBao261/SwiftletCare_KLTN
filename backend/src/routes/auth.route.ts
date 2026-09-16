import { Router, Request, Response, NextFunction } from 'express'
import { body } from 'express-validator'
import * as authController from '@/controllers/auth.controller'
import { authenticate } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'

const router = Router()

/** POST /auth/register – AUTH-FR-001 */
router.post(
  '/register',
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
  [body('email').isEmail(), body('password').notEmpty()],
  validate,
  authController.login,
)

/** POST /auth/refresh – AUTH-FR-003 */
router.post('/refresh', authController.refresh)

/** POST /auth/logout – AUTH-FR-006 */
router.post('/logout', authenticate, authController.logout)

/** POST /auth/otp/send – AUTH-FR-005 */
router.post('/otp/send', [body('email').isEmail()], validate, authController.sendOtp)

/** POST /auth/otp/verify – AUTH-FR-005 */
router.post('/otp/verify', authController.verifyOtp)

/** POST /auth/forgot-password – AUTH-FR-009 */
router.post('/forgot-password', [body('email').isEmail()], validate, authController.forgotPassword)

/** POST /auth/reset-password – AUTH-FR-009 */
router.post(
  '/reset-password',
  [body('email').isEmail(), body('token').notEmpty(), body('newPassword').isLength({ min: 8 })],
  validate,
  authController.resetPassword,
)

/** PUT /auth/notification-preferences – ALERT-FR-005/006 */
router.put('/notification-preferences', authenticate, authController.updateNotificationPreferences)

/** POST /auth/delete-request – AUTH-FR-012 */
router.post('/delete-request', authenticate, authController.requestDeletion)

export default router
