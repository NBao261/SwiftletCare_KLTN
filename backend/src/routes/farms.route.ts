import { Router } from 'express'
import { body, param, query } from 'express-validator'
import * as farmController from '@/controllers/farms.controller'
import { HOUSE_STAGES } from '@/utils/houseStage.util'
import { HHMM_PATTERN, ROSTER_ROLES } from '@/utils/roster.util'
import { MAX_HOUSE_FLOORS, MAX_NAME_LENGTH } from '@/services/farm.service'
import { COMPARISON_SORT_KEYS } from '@/services/houseComparison.service'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'
import { isPeriodParam } from '@/utils/period.util'
import * as weatherCompensationController from '@/controllers/weatherCompensation.controller'
import { MAX_WEATHER_RULES, WEATHER_METRICS } from '@/utils/weatherCompensation.util'

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

// FARM-FR-001 — farm mình sở hữu hoặc là thành viên (cả Farm Technician), Admin không thấy farm nào (service lọc)
router.get   ('/',             farmController.list)
// Report 3 §4.5 — tên farm, nhà, zone tối đa MAX_NAME_LENGTH ký tự
const nameRule = () => body('name').trim().notEmpty().withMessage('Cần tên')
  .isLength({ max: MAX_NAME_LENGTH }).withMessage(`Tên tối đa ${MAX_NAME_LENGTH} ký tự`)

router.post  ('/',             requireRole('FARM_OWNER'), nameRule(), body('address').trim().notEmpty(), ...coordinates(true), validate, farmController.create)
router.get   ('/:id',          param('id').isMongoId(), validate, farmController.getOne)
// Report 3 §2.4 — Administrator không quản lý farm (FARM-FR-001); xoá farm và thành viên: service chỉ cho Primary Owner
router.put   ('/:id',          requireRole('FARM_OWNER'), param('id').isMongoId(), nameRule().optional(), ...coordinates(false), validate, farmController.update)
router.delete('/:id',          requireRole('FARM_OWNER'), param('id').isMongoId(), validate, farmController.remove)
// AUTH-FR-005 — mời đồng sở hữu, Domain Expert (cả farm) hoặc Farm Technician (nhà được gán, AUTH-FR-013)
router.post  ('/:id/members',  requireRole('FARM_OWNER'), param('id').isMongoId(), body('email').isEmail(),
  body('role').optional().isIn(['FARM_OWNER', 'DOMAIN_EXPERT', 'FARM_TECHNICIAN']), validate, farmController.inviteMember)
router.delete('/:id/members/:userId', requireRole('FARM_OWNER'), param('id').isMongoId(), param('userId').isMongoId(), validate, farmController.removeMember)
// AUTH-FR-005, 010 — lời mời của farm cho màn Thành viên (mặc định đang chờ); service chỉ cho Primary Owner
router.get   ('/:id/invitations', requireRole('FARM_OWNER'), param('id').isMongoId(),
  query('status').optional().isString().isIn(['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED']),
  query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1 }), validate, farmController.listInvitations)

// Houses — cấu trúc farm chỉ Farm Owner tạo (FARM-FR-002, Report 3 §2.4)
router.post('/:id/houses',   requireRole('FARM_OWNER'), param('id').isMongoId(), nameRule(),
  body('floors').optional().isInt({ min: 1, max: MAX_HOUSE_FLOORS }).withMessage(`Số tầng là số nguyên 1–${MAX_HOUSE_FLOORS}`).toInt(),
  validate, farmController.createHouse)
router.get ('/:id/houses',   param('id').isMongoId(), validate, farmController.listHouses)
// FARM-FR-002 — sửa, xoá mềm nhà (chỉ Farm Owner); còn thiết bị đang dùng thì 409, service kiểm số tầng (400)
router.put   ('/houses/:houseId', requireRole('FARM_OWNER'), param('houseId').isMongoId(), nameRule().optional(),
  body('floors').optional().isInt({ min: 1, max: MAX_HOUSE_FLOORS }).withMessage(`Số tầng là số nguyên 1–${MAX_HOUSE_FLOORS}`).toInt(),
  // Mô tả không giới hạn độ dài, như lúc tạo nhà (Report 3 §4.5 không có giới hạn cho mô tả)
  body('description').optional().isString(), validate, farmController.updateHouse)
router.delete('/houses/:houseId', requireRole('FARM_OWNER'), param('houseId').isMongoId(), validate, farmController.deleteHouse)

// ANALYTICS-FR-015, 016 — tổng quan trại và so sánh nhà: Farm Owner, Domain Expert đọc (Report 3 §2.4); thợ và Admin không
// YYYY-MM-DD (đầu ngày giờ VN) hoặc ngày giờ ISO có múi giờ; dạng khác (2026-11, giờ không múi giờ) → 422
const periodRule = ['from', 'to'].map(name =>
  query(name).optional().isString().bail().custom(isPeriodParam).withMessage(`${name} phải là YYYY-MM-DD hoặc ngày giờ ISO có múi giờ`))
router.get ('/:id/overview',   requireRole('FARM_OWNER', 'DOMAIN_EXPERT'), param('id').isMongoId(), validate, farmController.overview)
router.get ('/:id/comparison', requireRole('FARM_OWNER', 'DOMAIN_EXPERT'), param('id').isMongoId(), ...periodRule,
  query('sort').optional().isString().isIn(COMPARISON_SORT_KEYS), query('order').optional().isString().isIn(['asc', 'desc']),
  validate, farmController.comparison)

// AUTH-FR-013 — Farm Owner gán/bỏ gán Farm Technician vào nhà; mỗi nhà tối đa 1 thợ chính
router.put   ('/houses/:houseId/technicians/:userId', requireRole('FARM_OWNER'), param('houseId').isMongoId(), param('userId').isMongoId(),
  body('primary').optional().isBoolean({ strict: true }), validate, farmController.assignTechnician)
router.delete('/houses/:houseId/technicians/:userId', requireRole('FARM_OWNER'), param('houseId').isMongoId(), param('userId').isMongoId(),
  validate, farmController.unassignTechnician)
// AUTH-FR-014 — lịch trực theo tuần: Farm Owner đặt, thợ được giao chỉ xem ca của mình (service lọc); Domain Expert
// không có quyền với lịch trực (Report 3 §2.4)
router.get   ('/houses/:houseId/roster', requireRole('FARM_OWNER', 'FARM_TECHNICIAN'), param('houseId').isMongoId(),
  validate, farmController.getRoster)
router.put   ('/houses/:houseId/roster', requireRole('FARM_OWNER'), param('houseId').isMongoId(),
  body('shifts').isArray(),
  body('shifts.*.technician_id').isString().isMongoId(),
  body('shifts.*.role').isString().isIn([...ROSTER_ROLES]),
  body('shifts.*.weekdays').isArray({ min: 1, max: 7 }),
  body('shifts.*.weekdays.*').isInt({ min: 0, max: 6 }).toInt(),
  body('shifts.*.start').isString().matches(HHMM_PATTERN).withMessage('start dạng HH:mm'),
  body('shifts.*.end').isString().matches(HHMM_PATTERN).withMessage('end dạng HH:mm'),
  validate, farmController.setRoster)

// ENV-FR-030 — luật bù phun sương theo thời tiết của nhà: Domain Expert đặt; Farm Owner đặt trực tiếp khi farm chưa có
// chuyên gia, có chuyên gia thì gửi đề xuất để duyệt (BR-22, BR-38; service kiểm); thợ của nhà chỉ xem (Report 3 §2.4).
// Khoảng giá trị: service kiểm (400)
const weatherRulesBody = [
  body('rules').isArray({ max: MAX_WEATHER_RULES }),
  body('rules.*._id').optional().isString().isMongoId(),
  body('rules.*.metric').isString().isIn([...WEATHER_METRICS]),
  body('rules.*.min').isFloat().toFloat(),
  body('rules.*.offset_pct').isFloat().toFloat(),
  body('rules.*.duration_min').isInt().toInt(),
  body('rules.*.active').optional().isBoolean().toBoolean(),
]
router.get('/houses/:houseId/weather-rules', requireRole('FARM_OWNER', 'DOMAIN_EXPERT', 'FARM_TECHNICIAN'),
  param('houseId').isMongoId(), validate, weatherCompensationController.getRules)
router.put('/houses/:houseId/weather-rules', requireRole('FARM_OWNER', 'DOMAIN_EXPERT'), param('houseId').isMongoId(),
  ...weatherRulesBody,
  validate, weatherCompensationController.setRules)
router.post('/houses/:houseId/weather-rules/proposal', requireRole('FARM_OWNER'), param('houseId').isMongoId(),
  ...weatherRulesBody,
  validate, weatherCompensationController.proposeRules)
// Gửi kèm `proposed_at` của bản đã xem: đề xuất đổi trong lúc đó thì 409
router.post('/houses/:houseId/weather-rules/proposal/approve', requireRole('DOMAIN_EXPERT'), param('houseId').isMongoId(),
  body('proposed_at').isISO8601(), validate, weatherCompensationController.approveProposal)
router.post('/houses/:houseId/weather-rules/proposal/reject', requireRole('DOMAIN_EXPERT'), param('houseId').isMongoId(),
  body('note').isString().trim().notEmpty().withMessage('Từ chối đề xuất phải ghi lý do').isLength({ max: 1000 }),
  body('proposed_at').isISO8601(), validate, weatherCompensationController.rejectProposal)

// Zones (under house)
router.post('/houses/:houseId/zones',    requireRole('FARM_OWNER'), param('houseId').isMongoId(), nameRule(),
  // Không vượt số tầng của nhà: service kiểm (400)
  body('floor').optional().isInt({ min: 1 }).withMessage('Tầng là số nguyên từ 1').toInt(),
  validate, farmController.createZone)
router.get ('/houses/:houseId/zones',    param('houseId').isMongoId(), validate, farmController.listZones)
router.get ('/zones/:zoneId',            param('zoneId').isMongoId(), validate, farmController.getZone)
// FARM-FR-002 — sửa, xoá mềm Zone (chỉ Farm Owner); tầng không vượt số tầng của nhà (service, 400)
router.put   ('/zones/:zoneId', requireRole('FARM_OWNER'), param('zoneId').isMongoId(), nameRule().optional(),
  body('floor').optional().isInt({ min: 1 }).withMessage('Tầng là số nguyên từ 1').toInt(), validate, farmController.updateZone)
router.delete('/zones/:zoneId', requireRole('FARM_OWNER'), param('zoneId').isMongoId(), validate, farmController.deleteZone)
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
// EXPERT-FR-008 "reset to defaults" — cùng quyền với sửa; BR-22 kiểm ở service
router.put ('/zones/:zoneId/detection-tuning/reset', requireRole('FARM_OWNER','DOMAIN_EXPERT'), param('zoneId').isMongoId(), validate, farmController.resetDetectionTuning)
// EXPERT-FR-008 (v2.1.8) — mức giảm tỷ lệ chim về theo nhà yến (camera ở cửa ra vào của cả nhà): Domain Expert
// sửa; Farm Owner chỉ khi farm chưa có chuyên gia (BR-22)
router.put ('/houses/:houseId/bird-count-tuning', requireRole('FARM_OWNER','DOMAIN_EXPERT'), param('houseId').isMongoId(), validate, farmController.updateBirdCountTuning)
router.put ('/houses/:houseId/bird-count-tuning/reset', requireRole('FARM_OWNER','DOMAIN_EXPERT'), param('houseId').isMongoId(), validate, farmController.resetBirdCountTuning)
// VISION-FR-019 — lịch đếm của nhà: Farm Owner, Domain Expert và thợ của nhà xem; Domain Expert sửa, Farm Owner chỉ khi
// farm chưa có chuyên gia (BR-22, service kiểm). Hình dạng ở đây (422), luật giờ và chồng ngày ở service (400)
router.get ('/houses/:houseId/counting-schedule', requireRole('FARM_OWNER','DOMAIN_EXPERT','FARM_TECHNICIAN'), param('houseId').isMongoId(), validate, farmController.getCountingSchedule)
router.put ('/houses/:houseId/counting-schedule', requireRole('FARM_OWNER','DOMAIN_EXPERT'), param('houseId').isMongoId(),
  body('profiles').optional().isArray(), body('temporary').optional().isArray(), validate, farmController.updateCountingSchedule)
// ANALYTICS-FR-012, BR-28 — mức chỉ số sức khỏe của nhà yến: Farm Owner và Domain Expert xem; Domain Expert
// sửa, Farm Owner chỉ khi farm chưa có chuyên gia (BR-22, service kiểm)
router.get ('/houses/:houseId/health-levels', requireRole('FARM_OWNER','DOMAIN_EXPERT'), param('houseId').isMongoId(), validate, farmController.getHealthLevels)
router.put ('/houses/:houseId/health-levels', requireRole('FARM_OWNER','DOMAIN_EXPERT'), param('houseId').isMongoId(), validate, farmController.updateHealthLevels)
// FARM-FR-014, BR-46 — giai đoạn nhà: Farm Owner, Domain Expert của farm (Farm Technician, Admin → 403)
router.put ('/houses/:houseId/stage', requireRole('FARM_OWNER','DOMAIN_EXPERT'), param('houseId').isMongoId(),
  body('stage').isString().isIn([...HOUSE_STAGES]), validate, farmController.setHouseStage)

export default router
