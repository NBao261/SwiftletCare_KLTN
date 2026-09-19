import { Router } from 'express'
import { body, param } from 'express-validator'
import * as farmController from '@/controllers/farms.controller'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'

const router = Router()
router.use(authenticate)

router.get   ('/',             farmController.list)
// `region` (VD: 'HCMC') quyết định Technician nào phụ trách farm này — xem
// utils/farmAccess.util.ts + AUTH-FR-005c. Không bắt buộc để không chặn farm cũ.
router.post  ('/',             requireRole('FARM_OWNER','ADMIN'), body('name').trim().notEmpty(), body('address').trim().notEmpty(), body('region').optional().trim().notEmpty(), validate, farmController.create)
router.get   ('/:id',          param('id').isMongoId(), validate, farmController.getOne)
router.put   ('/:id',          requireRole('FARM_OWNER','ADMIN'), param('id').isMongoId(), validate, farmController.update)
router.delete('/:id',          requireRole('FARM_OWNER','ADMIN'), param('id').isMongoId(), validate, farmController.remove)
router.post  ('/:id/members',  requireRole('FARM_OWNER','ADMIN'), param('id').isMongoId(), body('email').isEmail(), validate, farmController.inviteMember)
router.delete('/:id/members/:userId', requireRole('FARM_OWNER','ADMIN'), param('id').isMongoId(), param('userId').isMongoId(), validate, farmController.removeMember)

// Houses — Technician được tạo hộ House/Zone khi xuống lắp đặt mà Farm Owner
// chưa kịp tạo trước (Flow 9b bước 5); quyền vẫn giới hạn theo assigned_regions.
router.post('/:id/houses',   requireRole('FARM_OWNER','TECHNICIAN','ADMIN'), param('id').isMongoId(), body('name').trim().notEmpty(), validate, farmController.createHouse)
router.get ('/:id/houses',   param('id').isMongoId(), validate, farmController.listHouses)

// Zones (under house)
router.post('/houses/:houseId/zones',    requireRole('FARM_OWNER','TECHNICIAN','ADMIN'), param('houseId').isMongoId(), body('name').trim().notEmpty(), validate, farmController.createZone)
router.get ('/houses/:houseId/zones',    param('houseId').isMongoId(), validate, farmController.listZones)
router.get ('/zones/:zoneId',            param('zoneId').isMongoId(), validate, farmController.getZone)
router.put ('/zones/:zoneId/thresholds', requireRole('FARM_OWNER','TECHNICIAN','ADMIN'), param('zoneId').isMongoId(), validate, farmController.updateThresholds)
// ENV-FR-020 — reset về ngưỡng mặc định hệ thống do Admin cấu hình (system_settings, SYSTEM-FR-002)
router.put ('/zones/:zoneId/thresholds/reset', requireRole('FARM_OWNER','TECHNICIAN','ADMIN'), param('zoneId').isMongoId(), validate, farmController.resetThresholds)

// Sales Staff assignment (AUTH-FR-005b, Module SALES §5.10)
router.post('/:id/sales-staff', requireRole('FARM_OWNER','ADMIN'), param('id').isMongoId(), body('email').isEmail(), validate, farmController.inviteSalesStaff)
router.get ('/:id/sales-staff', param('id').isMongoId(), validate, farmController.listSalesStaff)

export default router
