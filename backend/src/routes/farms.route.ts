import { Router } from 'express'
import { body, param, query } from 'express-validator'
import * as farmController from '@/controllers/farms.controller'
import { MAX_HOUSE_FLOORS, MAX_NAME_LENGTH } from '@/services/farm.service'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'

const router = Router()
router.use(authenticate)

// FARM-FR-001, A-5 — một farm là một địa điểm: tọa độ bắt buộc khi tạo; sửa thì không bắt buộc gửi
// nhưng gửi thì cùng kiểm tra. Farm cũ chưa có tọa độ vẫn đọc được (schema không đổi).
const coordinates = (required: boolean) => {
  const field = (path: string) => (required ? body(path) : body(path).if(body('coordinates').exists()))
  return [
    field('coordinates.lat').isFloat({ min: -90, max: 90 }).withMessage('Vĩ độ phải là số trong khoảng -90…90').toFloat(),
    field('coordinates.lng').isFloat({ min: -180, max: 180 }).withMessage('Kinh độ phải là số trong khoảng -180…180').toFloat(),
  ]
}

// FARM-FR-009 — Technician thấy mọi farm (chỉ cấu trúc), Admin không thấy farm nào (service lọc)
router.get   ('/',             farmController.list)
// Report 3 §4.5 — tên farm, nhà, zone tối đa MAX_NAME_LENGTH ký tự
const nameRule = () => body('name').trim().notEmpty().withMessage('Cần tên')
  .isLength({ max: MAX_NAME_LENGTH }).withMessage(`Tên tối đa ${MAX_NAME_LENGTH} ký tự`)

router.post  ('/',             requireRole('FARM_OWNER'), nameRule(), body('address').trim().notEmpty(), ...coordinates(true), validate, farmController.create)
router.get   ('/:id',          param('id').isMongoId(), validate, farmController.getOne)
// Report 3 §2.4 — Administrator không quản lý farm (FARM-FR-001); xoá farm và thành viên: service chỉ cho Primary Owner
router.put   ('/:id',          requireRole('FARM_OWNER'), param('id').isMongoId(), nameRule().optional(), ...coordinates(false), validate, farmController.update)
router.delete('/:id',          requireRole('FARM_OWNER'), param('id').isMongoId(), validate, farmController.remove)
// AUTH-FR-005 (v2.0.0) — mời đồng sở hữu hoặc Domain Expert; cả hai đều theo cả farm (không còn zone_ids)
router.post  ('/:id/members',  requireRole('FARM_OWNER'), param('id').isMongoId(), body('email').isEmail(),
  body('role').optional().isIn(['FARM_OWNER', 'DOMAIN_EXPERT']), validate, farmController.inviteMember)
router.delete('/:id/members/:userId', requireRole('FARM_OWNER'), param('id').isMongoId(), param('userId').isMongoId(), validate, farmController.removeMember)
// AUTH-FR-005, 010 — lời mời của farm cho màn Thành viên (mặc định đang chờ); service chỉ cho Primary Owner
router.get   ('/:id/invitations', requireRole('FARM_OWNER'), param('id').isMongoId(),
  query('status').optional().isString().isIn(['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED']), validate, farmController.listInvitations)

// Houses — cấu trúc farm chỉ Farm Owner tạo (FARM-FR-002, Report 3 §2.4)
router.post('/:id/houses',   requireRole('FARM_OWNER'), param('id').isMongoId(), nameRule(),
  body('floors').optional().isInt({ min: 1, max: MAX_HOUSE_FLOORS }).withMessage(`Số tầng là số nguyên 1–${MAX_HOUSE_FLOORS}`).toInt(),
  validate, farmController.createHouse)
router.get ('/:id/houses',   param('id').isMongoId(), validate, farmController.listHouses)

// Zones (under house)
router.post('/houses/:houseId/zones',    requireRole('FARM_OWNER'), param('houseId').isMongoId(), nameRule(),
  // Không vượt số tầng của nhà: service kiểm (400)
  body('floor').optional().isInt({ min: 1 }).withMessage('Tầng là số nguyên từ 1').toInt(),
  validate, farmController.createZone)
router.get ('/houses/:houseId/zones',    param('houseId').isMongoId(), validate, farmController.listZones)
router.get ('/zones/:zoneId',            param('zoneId').isMongoId(), validate, farmController.getZone)
// Ngưỡng và hệ số mờ: Farm Owner và Domain Expert của farm (ENV-FR-006, 020, 021); Technician, Admin không
router.put ('/zones/:zoneId/thresholds', requireRole('FARM_OWNER','DOMAIN_EXPERT'), param('zoneId').isMongoId(), validate, farmController.updateThresholds)
// ENV-FR-020 — reset về ngưỡng mặc định hệ thống do Admin cấu hình (system_settings, SYSTEM-FR-002)
router.put ('/zones/:zoneId/thresholds/reset', requireRole('FARM_OWNER','DOMAIN_EXPERT'), param('zoneId').isMongoId(), validate, farmController.resetThresholds)
// ENV-FR-021 — hệ số bộ điều khiển mờ (gửi xuống ESP32 qua config/update), cùng quyền với ngưỡng
router.put ('/zones/:zoneId/fuzzy-tuning', requireRole('FARM_OWNER','DOMAIN_EXPERT'), param('zoneId').isMongoId(), validate, farmController.updateFuzzyTuning)
// EXPERT-FR-011 — áp gợi ý hệ số của hệ thống (ANALYTICS-FR-010): Domain Expert; Farm Owner chỉ khi farm chưa
// có chuyên gia (BR-22, service kiểm), còn lại gửi đề xuất qua POST /expert-activity/proposals
router.post('/zones/:zoneId/fuzzy-tuning/apply-suggestion', requireRole('FARM_OWNER','DOMAIN_EXPERT'), param('zoneId').isMongoId(), validate, farmController.applySuggestion)
// EXPERT-FR-008 — tham số phát hiện theo Zone (ồn bất thường, bơm khô, hỏng loa): Domain Expert
// sửa; Farm Owner chỉ sửa thay khi farm chưa có chuyên gia (BR-22, service kiểm), còn lại xem qua GET /farms/zones/:zoneId
router.put ('/zones/:zoneId/detection-tuning', requireRole('FARM_OWNER','DOMAIN_EXPERT'), param('zoneId').isMongoId(), validate, farmController.updateDetectionTuning)
// EXPERT-FR-008 (v2.1.8) — mức giảm tỷ lệ chim về theo nhà yến (camera ở cửa ra vào của cả nhà): Domain Expert
// sửa; Farm Owner chỉ khi farm chưa có chuyên gia (BR-22)
router.put ('/houses/:houseId/bird-count-tuning', requireRole('FARM_OWNER','DOMAIN_EXPERT'), param('houseId').isMongoId(), validate, farmController.updateBirdCountTuning)

export default router
