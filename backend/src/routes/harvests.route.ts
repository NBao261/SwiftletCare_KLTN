import { Router } from 'express'
import { body, param, query } from 'express-validator'
import * as harvestController from '@/controllers/harvests.controller'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'

const router = Router()
router.use(authenticate)

/**
 * HARVEST-FR-001..006 — Farm Owner ghi nhận và xác nhận; Farm Technician nhập lô ở nhà được giao (DRAFT, chỉ
 * sửa/xoá lô DRAFT của mình — service kiểm); Domain Expert chỉ xem (mục 4.4)
 */
const canRead  = requireRole('FARM_OWNER', 'DOMAIN_EXPERT', 'FARM_TECHNICIAN')
const canWrite = requireRole('FARM_OWNER', 'FARM_TECHNICIAN')
// HARVEST-FR-007, ANALYTICS-FR-004, EXPERT-FR-020 — chu kỳ thu hoạch (đặt trước `/:id`). Đọc như lô thu hoạch;
// kết luận mùa vụ của Domain Expert, Farm Owner chỉ khi farm chưa có chuyên gia (BR-22, service kiểm)
router.get('/cycles', canRead,
  ...['zoneId', 'houseId', 'farmId'].map(name => query(name).optional().isString().bail().isMongoId()),
  query('status').optional().isString().bail().isIn(['OPEN', 'CLOSED', 'CONCLUDED']),
  query('page').optional().isInt({ min: 1 }).toInt(), query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  validate, harvestController.listCycles)
router.get('/cycles/:id', canRead, param('id').isMongoId(), validate, harvestController.getCycle)
router.put('/cycles/:id/conclusion', requireRole('DOMAIN_EXPERT', 'FARM_OWNER'), param('id').isMongoId(),
  body('text').isString().bail().trim().notEmpty().isLength({ max: 2000 }),
  body('recommendations').optional().isString().bail().trim().isLength({ max: 2000 }),
  validate, harvestController.concludeCycle)
router.post  ('/',    canWrite, body('zone_id').isMongoId(), body('harvest_date').isISO8601(), validate, harvestController.create)
router.get   ('/',    canRead,  harvestController.list)
router.get   ('/:id', canRead,  param('id').isMongoId(), validate, harvestController.getOne)
router.put   ('/:id', canWrite, param('id').isMongoId(), validate, harvestController.update)
router.delete('/:id', canWrite, param('id').isMongoId(), validate, harvestController.remove)
router.post  ('/:id/confirm', requireRole('FARM_OWNER'), param('id').isMongoId(), validate, harvestController.confirm)

export default router
