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
router.post  ('/',             requireRole('FARM_OWNER'), body('name').trim().notEmpty(), body('address').trim().notEmpty(), body('region').isString().trim().notEmpty(), validate, farmController.create)
router.get   ('/:id',          param('id').isMongoId(), validate, farmController.getOne)
// Report 3 §2.4 — Administrator không quản lý farm (FARM-FR-001); xoá farm và thành viên: service chỉ cho Primary Owner
router.put   ('/:id',          requireRole('FARM_OWNER'), param('id').isMongoId(), validate, farmController.update)
router.delete('/:id',          requireRole('FARM_OWNER'), param('id').isMongoId(), validate, farmController.remove)
// AUTH-FR-005 (v2.0.0) — mời đồng sở hữu hoặc Domain Expert; cả hai đều theo cả farm (không còn zone_ids)
router.post  ('/:id/members',  requireRole('FARM_OWNER'), param('id').isMongoId(), body('email').isEmail(),
  body('role').optional().isIn(['FARM_OWNER', 'DOMAIN_EXPERT']), validate, farmController.inviteMember)
router.delete('/:id/members/:userId', requireRole('FARM_OWNER'), param('id').isMongoId(), param('userId').isMongoId(), validate, farmController.removeMember)

// Houses — cấu trúc farm chỉ Farm Owner tạo (FARM-FR-002, Report 3 §2.4)
router.post('/:id/houses',   requireRole('FARM_OWNER'), param('id').isMongoId(), body('name').trim().notEmpty(), validate, farmController.createHouse)
router.get ('/:id/houses',   param('id').isMongoId(), validate, farmController.listHouses)

// Zones (under house)
router.post('/houses/:houseId/zones',    requireRole('FARM_OWNER'), param('houseId').isMongoId(), body('name').trim().notEmpty(), validate, farmController.createZone)
router.get ('/houses/:houseId/zones',    param('houseId').isMongoId(), validate, farmController.listZones)
router.get ('/zones/:zoneId',            param('zoneId').isMongoId(), validate, farmController.getZone)
// Ngưỡng và hệ số mờ: Farm Owner và Domain Expert của farm (ENV-FR-006, 020, 021); Technician, Admin không
router.put ('/zones/:zoneId/thresholds', requireRole('FARM_OWNER','DOMAIN_EXPERT'), param('zoneId').isMongoId(), validate, farmController.updateThresholds)
// ENV-FR-020 — reset về ngưỡng mặc định hệ thống do Admin cấu hình (system_settings, SYSTEM-FR-002)
router.put ('/zones/:zoneId/thresholds/reset', requireRole('FARM_OWNER','DOMAIN_EXPERT'), param('zoneId').isMongoId(), validate, farmController.resetThresholds)
// ENV-FR-021 — hệ số bộ điều khiển mờ (gửi xuống ESP32 qua config/update), cùng quyền với ngưỡng
router.put ('/zones/:zoneId/fuzzy-tuning', requireRole('FARM_OWNER','DOMAIN_EXPERT'), param('zoneId').isMongoId(), validate, farmController.updateFuzzyTuning)
// EXPERT-FR-008 — tham số phát hiện theo Zone (ồn bất thường, bơm khô, hỏng loa): chỉ Domain
// Expert sửa (mục 4.4); Farm Owner xem qua GET /farms/zones/:zoneId
router.put ('/zones/:zoneId/detection-tuning', requireRole('DOMAIN_EXPERT'), param('zoneId').isMongoId(), validate, farmController.updateDetectionTuning)
// EXPERT-FR-008 (v2.1.8) — mức giảm tỷ lệ chim về theo nhà yến (camera ở cửa ra vào của cả nhà): chỉ Domain Expert sửa
router.put ('/houses/:houseId/bird-count-tuning', requireRole('DOMAIN_EXPERT'), param('houseId').isMongoId(), validate, farmController.updateBirdCountTuning)

export default router
