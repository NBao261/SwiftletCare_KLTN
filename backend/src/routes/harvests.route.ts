import { Router } from 'express'
import { body, param } from 'express-validator'
import * as harvestController from '@/controllers/harvests.controller'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'
import type { NestType } from '@/types'

const NEST_TYPES = ['RAW', 'CLEANED', 'PREMIUM'] satisfies NestType[]

const router = Router()
router.use(authenticate)

/**
 * HARVEST-FR-001..006 — Farm Owner ghi nhận và xác nhận; Farm Technician nhập lô ở nhà được giao (DRAFT, chỉ
 * sửa/xoá lô DRAFT của mình — service kiểm); Domain Expert chỉ xem (mục 4.4)
 */
const canRead  = requireRole('FARM_OWNER', 'DOMAIN_EXPERT', 'FARM_TECHNICIAN')
const canWrite = requireRole('FARM_OWNER', 'FARM_TECHNICIAN')

/**
 * HARVEST-FR-001 — lô thiếu hoặc sai ngày, số tổ, cân nặng → 422. Lúc tạo các trường đều bắt buộc; lúc sửa
 * chỉ kiểm trường gửi lên. Ngày sau hôm nay (giờ VN) do service chặn.
 */
const harvestFields = (optional: boolean) => {
  const field = (name: string) => (optional ? body(name).optional() : body(name).exists({ values: 'null' }))
  return [
    field('nest_count').isInt({ min: 1 }).toInt(),
    field('weight_grams').isFloat({ gt: 0 }).toFloat(),
    field('nest_type').isString().bail().isIn(NEST_TYPES),
    body('product_images').optional().isArray(),
    body('product_images.*').isString(),
  ]
}

router.post  ('/',    canWrite,
  body('zone_id').isString().bail().isMongoId(), body('harvest_date').isString().bail().isISO8601({ strict: true }),
  ...harvestFields(false), validate, harvestController.create)
router.get   ('/',    canRead,  harvestController.list)
router.get   ('/:id', canRead,  param('id').isMongoId(), validate, harvestController.getOne)
router.put   ('/:id', canWrite, param('id').isMongoId(), ...harvestFields(true), validate, harvestController.update)
router.delete('/:id', canWrite, param('id').isMongoId(), validate, harvestController.remove)
router.post  ('/:id/confirm', requireRole('FARM_OWNER'), param('id').isMongoId(), validate, harvestController.confirm)

export default router
