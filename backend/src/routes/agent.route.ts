import { Router } from 'express'
import { body } from 'express-validator'
import { cameraSource, enroll } from '@/controllers/agent.controller'
import { loginLimiter } from '@/middlewares/rateLimiter.middleware'
import { validate } from '@/middlewares/validate.middleware'

// Nút AI gọi, không có tài khoản người dùng: mã cài đặt dùng một lần, hoặc Basic bằng mã thiết bị và mật khẩu broker
const router = Router()

// Đếm lần sai theo IP như đăng nhập: mã 8 ký tự không dò được trong 30 phút
router.post('/enroll', loginLimiter, body('setup_code').isString().trim().isLength({ min: 8, max: 20 }), validate, enroll)
router.get('/camera-source', cameraSource)

export default router
