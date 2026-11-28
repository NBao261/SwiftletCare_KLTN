import { Router } from 'express'
import { body, param, query } from 'express-validator'
import multer from 'multer'
import { MAX_PHOTO_BYTES } from '@/services/workOrder.service'
import * as harvestController from '@/controllers/harvests.controller'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'
import type { NestType } from '@/types'
import { LIMITS } from '@/utils/inputRules.util'

const NEST_TYPES = ['RAW', 'CLEANED', 'PREMIUM'] satisfies NestType[]

const router = Router()
router.use(authenticate)

// Farm Technician chỉ sửa/xoá lô DRAFT của mình (service kiểm)
const canRead  = requireRole('FARM_OWNER', 'DOMAIN_EXPERT', 'FARM_TECHNICIAN')
const canWrite = requireRole('FARM_OWNER', 'FARM_TECHNICIAN')
const photoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_PHOTO_BYTES, files: 1 } })

// Lúc sửa chỉ kiểm trường gửi lên; ngày tương lai do service chặn
const harvestFields = (optional: boolean) => {
  const field = (name: string) => (optional ? body(name).optional() : body(name).exists({ values: 'null' }))
  return [
    field('nest_count').isInt({ min: 1, max: LIMITS.maxHarvestNests }).toInt(),
    field('weight_grams').isFloat({ gt: 0, max: LIMITS.maxHarvestGrams }).toFloat(),
    field('nest_type').isString().bail().isIn(NEST_TYPES),
    body('product_images').optional().isArray({ max: LIMITS.maxHarvestImages }),
    // Ảnh chỉ là link: http(s), không nhận javascript: hay data:
    body('product_images.*').isString().bail().isURL({ protocols: ['http', 'https'], require_protocol: true, require_tld: false }).isLength({ max: LIMITS.url }),
  ]
}

// Trước '/:id'. Kết luận chỉ của Domain Expert, kể cả farm chưa có chuyên gia
router.get('/cycles', canRead,
  ...['zoneId', 'houseId', 'farmId'].map(name => query(name).optional().isString().bail().isMongoId()),
  query('status').optional().isString().bail().isIn(['OPEN', 'CLOSED', 'CONCLUDED']),
  query('page').optional().isString().isInt({ min: 1 }).toInt(), query('limit').optional().isString().isInt({ min: 1, max: 100 }).toInt(),
  validate, harvestController.listCycles)
router.get('/cycles/:id', canRead, param('id').isMongoId(), validate, harvestController.getCycle)
router.put('/cycles/:id/conclusion', requireRole('DOMAIN_EXPERT'), param('id').isMongoId(),
  body('text').isString().bail().trim().notEmpty().isLength({ max: 2000 }),
  body('recommendations').optional().isString().bail().trim().isLength({ max: 2000 }),
  validate, harvestController.concludeCycle)
router.post  ('/',    canWrite,
  body('zone_id').isString().bail().isMongoId(), body('harvest_date').isString().bail().isISO8601({ strict: true }),
  ...harvestFields(false), validate, harvestController.create)
router.get   ('/',    canRead,  query('farmId').optional().isString().bail().isMongoId(),
  query('page').optional().isInt({ min: 1 }).toInt(), query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  validate, harvestController.list)
router.get   ('/:id', canRead,  param('id').isMongoId(), validate, harvestController.getOne)
router.put   ('/:id', canWrite, param('id').isMongoId(), ...harvestFields(true), validate, harvestController.update)
router.put   ('/:id/photo', canWrite, photoUpload.single('photo'), param('id').isMongoId(), validate, harvestController.setPhoto)
router.delete('/:id', canWrite, param('id').isMongoId(), validate, harvestController.remove)
router.post  ('/:id/confirm', requireRole('FARM_OWNER'), param('id').isMongoId(), validate, harvestController.confirm)

export default router
