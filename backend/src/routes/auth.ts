import { Router, Request, Response, NextFunction } from 'express'
import { body } from 'express-validator'
import * as authController from '@/controllers/auth'
import { authenticate } from '@/middlewares/auth'
import { validate } from '@/middlewares/validate'

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

export default router
