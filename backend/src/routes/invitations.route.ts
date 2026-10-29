import { Router } from 'express'
import { body, param } from 'express-validator'
import * as farmController from '@/controllers/farms.controller'
import { authenticate } from '@/middlewares/auth.middleware'
import { loginLimiter } from '@/middlewares/rateLimiter.middleware'
import { validate } from '@/middlewares/validate.middleware'

/**
 * AUTH-FR-010, Flow 12 — router riêng (không mount dưới /farms) vì xem trước
 * và từ chối lời mời là link công khai qua token, không cần đăng nhập.
 * Chỉ /accept mới yêu cầu authenticate (phải đăng nhập đúng email được mời).
 * /create-account thay cho đăng ký công khai (đã bỏ): loginLimiter chỉ đếm lần sai, chống dò token.
 */
const router = Router()

router.get   ('/:token',         param('token').notEmpty(), validate, farmController.getInvitation)
router.post  ('/:token/accept',  param('token').notEmpty(), validate, authenticate, farmController.acceptInvitation)
router.post  ('/:token/create-account', loginLimiter, param('token').notEmpty(),
  body('full_name').isString().trim().notEmpty(),
  body('password').isString().isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  validate, farmController.createAccountFromInvitation)
router.post  ('/:token/decline', param('token').notEmpty(), validate, farmController.declineInvitation)

export default router
