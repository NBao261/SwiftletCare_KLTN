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
// Danh mục 34 tỉnh/thành cho dropdown — đặt trước '/:id' để "regions" không bị hiểu là id
router.get   ('/regions',      farmController.listRegions)
// region bắt buộc: nhận mã, tên hoặc tên tỉnh cũ, service quy về mã danh mục (regions.util)
router.post  ('/',             requireRole('FARM_OWNER','ADMIN'), body('name').trim().notEmpty(), body('address').trim().notEmpty(), body('region').isString().trim().notEmpty(), body('owner_email').optional().isEmail(), validate, farmController.create)
router.get   ('/:id',          param('id').isMongoId(), validate, farmController.getOne)
router.put   ('/:id',          requireRole('FARM_OWNER','ADMIN'), param('id').isMongoId(), validate, farmController.update)
router.delete('/:id',          requireRole('FARM_OWNER','ADMIN'), param('id').isMongoId(), validate, farmController.remove)
// AUTH-FR-005 (v2.0.0) — mời đồng sở hữu hoặc Domain Expert; cả hai đều theo cả farm (không còn zone_ids)
router.post  ('/:id/members',  requireRole('FARM_OWNER','ADMIN'), param('id').isMongoId(), body('email').isEmail(),
  body('role').optional().isIn(['FARM_OWNER', 'DOMAIN_EXPERT']), validate, farmController.inviteMember)
router.delete('/:id/members/:userId', requireRole('FARM_OWNER','ADMIN'), param('id').isMongoId(), param('userId').isMongoId(), validate, farmController.removeMember)

// Houses — Technician được tạo hộ House/Zone khi xuống lắp đặt mà Farm Owner
// chưa kịp tạo trước (Flow 9b bước 5); quyền vẫn giới hạn theo assigned_regions.
router.post('/:id/houses',   requireRole('FARM_OWNER','TECHNICIAN','ADMIN'), param('id').isMongoId(), body('name').trim().notEmpty(), validate, farmController.createHouse)
router.get ('/:id/houses',   param('id').isMongoId(), validate, farmController.listHouses)

// Zones (under house)
router.post('/houses/:houseId/zones',    requireRole('FARM_OWNER','TECHNICIAN','ADMIN'), param('houseId').isMongoId(), body('name').trim().notEmpty(), validate, farmController.createZone)
router.get ('/houses/:houseId/zones',    param('houseId').isMongoId(), validate, farmController.listZones)
router.get ('/zones/:zoneId',            param('zoneId').isMongoId(), validate, farmController.getZone)
// Domain Expert duyệt/điều chỉnh ngưỡng và hệ số mờ (EXPERT-FR-004, mục 4.4)
router.put ('/zones/:zoneId/thresholds', requireRole('FARM_OWNER','DOMAIN_EXPERT','TECHNICIAN','ADMIN'), param('zoneId').isMongoId(), validate, farmController.updateThresholds)
// ENV-FR-020 — reset về ngưỡng mặc định hệ thống do Admin cấu hình (system_settings, SYSTEM-FR-002)
router.put ('/zones/:zoneId/thresholds/reset', requireRole('FARM_OWNER','DOMAIN_EXPERT','TECHNICIAN','ADMIN'), param('zoneId').isMongoId(), validate, farmController.resetThresholds)
// ENV-FR-021 — hệ số bộ điều khiển mờ (gửi xuống ESP32 qua config/update), cùng quyền với ngưỡng
router.put ('/zones/:zoneId/fuzzy-tuning', requireRole('FARM_OWNER','DOMAIN_EXPERT','TECHNICIAN','ADMIN'), param('zoneId').isMongoId(), validate, farmController.updateFuzzyTuning)
// EXPERT-FR-008 — tham số phát hiện (ồn bất thường, bơm khô, hỏng loa, tỷ lệ chim về): chỉ Domain
// Expert sửa (mục 4.4); Farm Owner xem qua GET /farms/zones/:zoneId
router.put ('/zones/:zoneId/detection-tuning', requireRole('DOMAIN_EXPERT'), param('zoneId').isMongoId(), validate, farmController.updateDetectionTuning)

export default router
