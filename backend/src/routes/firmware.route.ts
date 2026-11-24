import { Router } from 'express'
import { param } from 'express-validator'
import { downloadOtaFirmware } from '@/controllers/firmware.controller'
import { validate } from '@/middlewares/validate.middleware'

// Bộ điều khiển tải firmware khi cập nhật từ xa: không có tài khoản, link chứa token dùng riêng cho máy và hết hạn
const router = Router()

router.get('/ota/:token', param('token').isString().isHexadecimal().isLength({ min: 64, max: 64 }), validate, downloadOtaFirmware)

export default router
