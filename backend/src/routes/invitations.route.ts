import { Router } from 'express'
import { body, param } from 'express-validator'
import * as farmController from '@/controllers/farms.controller'
import { authenticate } from '@/middlewares/auth.middleware'
import { loginLimiter } from '@/middlewares/rateLimiter.middleware'
import { validate } from '@/middlewares/validate.middleware'

// Không mount dưới /farms: xem và từ chối là link công khai; chỉ /accept cần đăng nhập
const router = Router()

router.get   ('/:token',         param('token').notEmpty(), validate, farmController.getInvitation)
router.post  ('/:token/accept',  param('token').notEmpty(), validate, authenticate, farmController.acceptInvitation)
router.post  ('/:token/create-account', loginLimiter, param('token').notEmpty(),
  body('full_name').isString().trim().notEmpty(),
  body('password').isString().isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  validate, farmController.createAccountFromInvitation)
router.post  ('/:token/decline', param('token').notEmpty(), validate, farmController.declineInvitation)

export default router
