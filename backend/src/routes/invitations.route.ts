import { Router } from 'express'
import { body, param } from 'express-validator'
import * as farmController from '@/controllers/farms.controller'
import { authenticate } from '@/middlewares/auth.middleware'
import { loginLimiter } from '@/middlewares/rateLimiter.middleware'
import { validate } from '@/middlewares/validate.middleware'
import { LIMITS, newPasswordField } from '@/utils/inputRules.util'

// Không mount dưới /farms: xem và từ chối là link công khai; chỉ /accept cần đăng nhập
const router = Router()

router.get   ('/:token',         param('token').isString().isLength({ min: 1, max: 128 }), validate, farmController.getInvitation)
router.post  ('/:token/accept',  param('token').isString().isLength({ min: 1, max: 128 }), validate, authenticate, farmController.acceptInvitation)
router.post  ('/:token/create-account', loginLimiter, param('token').isString().isLength({ min: 1, max: 128 }),
  body('full_name').isString().bail().trim().notEmpty().isLength({ max: LIMITS.fullName }),
  newPasswordField('password'),
  validate, farmController.createAccountFromInvitation)
router.post  ('/:token/decline', param('token').isString().isLength({ min: 1, max: 128 }), validate, farmController.declineInvitation)

export default router
