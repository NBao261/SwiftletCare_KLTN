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

// A-5: bắt buộc khi tạo; sửa thì gửi mới kiểm
const coordinates = (required: boolean) => {
  const field = (path: string) => (required ? body(path) : body(path).if(body('coordinates').exists()))
  return [
    field('coordinates.lat').isFloat({ min: -90, max: 90 }).withMessage('Vĩ độ phải là số trong khoảng -90…90').toFloat(),
    field('coordinates.lng').isFloat({ min: -180, max: 180 }).withMessage('Kinh độ phải là số trong khoảng -180…180').toFloat(),
  ]
}

// Service lọc; Admin không thấy farm nào
router.get   ('/',             farmController.list)
const nameRule = () => body('name').trim().notEmpty().withMessage('Cần tên')
  .isLength({ max: MAX_NAME_LENGTH }).withMessage(`Tên tối đa ${MAX_NAME_LENGTH} ký tự`)

router.post  ('/',             requireRole('FARM_OWNER'), nameRule(), body('address').trim().notEmpty(), ...coordinates(true), validate, farmController.create)
router.get   ('/:id',          param('id').isMongoId(), validate, farmController.getOne)
// Xoá farm và thành viên: service chỉ cho Primary Owner
router.put   ('/:id',          requireRole('FARM_OWNER'), param('id').isMongoId(), nameRule().optional(), ...coordinates(false), validate, farmController.update)
router.delete('/:id',          requireRole('FARM_OWNER'), param('id').isMongoId(), validate, farmController.remove)
router.post  ('/:id/members',  requireRole('FARM_OWNER'), param('id').isMongoId(), body('email').isEmail(),
  body('role').optional().isIn(['FARM_OWNER', 'DOMAIN_EXPERT', 'FARM_TECHNICIAN']), validate, farmController.inviteMember)
router.delete('/:id/members/:userId', requireRole('FARM_OWNER'), param('id').isMongoId(), param('userId').isMongoId(), validate, farmController.removeMember)
router.get   ('/:id/invitations', requireRole('FARM_OWNER'), param('id').isMongoId(),
  query('status').optional().isString().isIn(['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED']),
  query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1 }), validate, farmController.listInvitations)

router.post('/:id/houses',   requireRole('FARM_OWNER'), param('id').isMongoId(), nameRule(),
  body('floors').optional().isInt({ min: 1, max: MAX_HOUSE_FLOORS }).withMessage(`Số tầng là số nguyên 1–${MAX_HOUSE_FLOORS}`).toInt(),
  validate, farmController.createHouse)
router.get ('/:id/houses',   param('id').isMongoId(), validate, farmController.listHouses)
// Còn thiết bị đang dùng thì 409
router.put   ('/houses/:houseId', requireRole('FARM_OWNER'), param('houseId').isMongoId(), nameRule().optional(),
  body('floors').optional().isInt({ min: 1, max: MAX_HOUSE_FLOORS }).withMessage(`Số tầng là số nguyên 1–${MAX_HOUSE_FLOORS}`).toInt(),
  // Report 3 §4.5 không giới hạn mô tả
  body('description').optional().isString(), validate, farmController.updateHouse)
router.delete('/houses/:houseId', requireRole('FARM_OWNER'), param('houseId').isMongoId(), validate, farmController.deleteHouse)

// Dạng khác (2026-11, giờ không múi giờ) → 422
const periodRule = ['from', 'to'].map(name =>
  query(name).optional().isString().bail().custom(isPeriodParam).withMessage(`${name} phải là YYYY-MM-DD hoặc ngày giờ ISO có múi giờ`))
router.get ('/:id/overview',   requireRole('FARM_OWNER', 'DOMAIN_EXPERT'), param('id').isMongoId(), validate, farmController.overview)
router.get ('/:id/comparison', requireRole('FARM_OWNER', 'DOMAIN_EXPERT'), param('id').isMongoId(), ...periodRule,
  query('sort').optional().isString().isIn(COMPARISON_SORT_KEYS), query('order').optional().isString().isIn(['asc', 'desc']),
  validate, farmController.comparison)

router.put   ('/houses/:houseId/technicians/:userId', requireRole('FARM_OWNER'), param('houseId').isMongoId(), param('userId').isMongoId(),
  body('primary').optional().isBoolean({ strict: true }), validate, farmController.assignTechnician)
router.delete('/houses/:houseId/technicians/:userId', requireRole('FARM_OWNER'), param('houseId').isMongoId(), param('userId').isMongoId(),
  validate, farmController.unassignTechnician)
// Thợ chỉ xem ca của mình (service lọc)
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

// Farm có chuyên gia thì Farm Owner gửi đề xuất để duyệt (BR-22, service kiểm)
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
// proposed_at của bản đã xem: đề xuất đổi trong lúc đó thì 409
router.post('/houses/:houseId/weather-rules/proposal/approve', requireRole('DOMAIN_EXPERT'), param('houseId').isMongoId(),
  body('proposed_at').isISO8601(), validate, weatherCompensationController.approveProposal)
router.post('/houses/:houseId/weather-rules/proposal/reject', requireRole('DOMAIN_EXPERT'), param('houseId').isMongoId(),
  body('note').isString().trim().notEmpty().withMessage('Từ chối đề xuất phải ghi lý do').isLength({ max: 1000 }),
  body('proposed_at').isISO8601(), validate, weatherCompensationController.rejectProposal)

router.post('/houses/:houseId/zones',    requireRole('FARM_OWNER'), param('houseId').isMongoId(), nameRule(),
  // Không vượt số tầng của nhà: service kiểm (400)
  body('floor').optional().isInt({ min: 1 }).withMessage('Tầng là số nguyên từ 1').toInt(),
  validate, farmController.createZone)
router.get ('/houses/:houseId/zones',    param('houseId').isMongoId(), validate, farmController.listZones)
router.get ('/zones/:zoneId',            param('zoneId').isMongoId(), validate, farmController.getZone)
router.put   ('/zones/:zoneId', requireRole('FARM_OWNER'), param('zoneId').isMongoId(), nameRule().optional(),
  body('floor').optional().isInt({ min: 1 }).withMessage('Tầng là số nguyên từ 1').toInt(), validate, farmController.updateZone)
router.delete('/zones/:zoneId', requireRole('FARM_OWNER'), param('zoneId').isMongoId(), validate, farmController.deleteZone)
router.put ('/zones/:zoneId/thresholds', requireRole('FARM_OWNER','DOMAIN_EXPERT'), param('zoneId').isMongoId(), validate, farmController.updateThresholds)
router.put ('/zones/:zoneId/thresholds/reset', requireRole('FARM_OWNER','DOMAIN_EXPERT'), param('zoneId').isMongoId(), validate, farmController.resetThresholds)
router.put ('/zones/:zoneId/fuzzy-tuning', requireRole('FARM_OWNER','DOMAIN_EXPERT'), param('zoneId').isMongoId(), validate, farmController.updateFuzzyTuning)
// Farm Owner chỉ khi farm chưa có chuyên gia (BR-22), còn lại gửi qua /expert-activity/proposals
router.post('/zones/:zoneId/fuzzy-tuning/apply-suggestion', requireRole('FARM_OWNER','DOMAIN_EXPERT'), param('zoneId').isMongoId(), validate, farmController.applySuggestion)
// Farm Owner chỉ khi farm chưa có chuyên gia (BR-22, service kiểm)
router.put ('/zones/:zoneId/detection-tuning', requireRole('FARM_OWNER','DOMAIN_EXPERT'), param('zoneId').isMongoId(), validate, farmController.updateDetectionTuning)
router.put ('/zones/:zoneId/detection-tuning/reset', requireRole('FARM_OWNER','DOMAIN_EXPERT'), param('zoneId').isMongoId(), validate, farmController.resetDetectionTuning)
router.put ('/houses/:houseId/bird-count-tuning', requireRole('FARM_OWNER','DOMAIN_EXPERT'), param('houseId').isMongoId(), validate, farmController.updateBirdCountTuning)
router.put ('/houses/:houseId/bird-count-tuning/reset', requireRole('FARM_OWNER','DOMAIN_EXPERT'), param('houseId').isMongoId(), validate, farmController.resetBirdCountTuning)
// Hình dạng ở đây (422), luật giờ và chồng ngày ở service (400)
router.get ('/houses/:houseId/counting-schedule', requireRole('FARM_OWNER','DOMAIN_EXPERT','FARM_TECHNICIAN'), param('houseId').isMongoId(), validate, farmController.getCountingSchedule)
router.put ('/houses/:houseId/counting-schedule', requireRole('FARM_OWNER','DOMAIN_EXPERT'), param('houseId').isMongoId(),
  body('profiles').optional().isArray(), body('temporary').optional().isArray(), validate, farmController.updateCountingSchedule)
router.get ('/houses/:houseId/health-levels', requireRole('FARM_OWNER','DOMAIN_EXPERT'), param('houseId').isMongoId(), validate, farmController.getHealthLevels)
router.put ('/houses/:houseId/health-levels', requireRole('FARM_OWNER','DOMAIN_EXPERT'), param('houseId').isMongoId(), validate, farmController.updateHealthLevels)
router.put ('/houses/:houseId/stage', requireRole('FARM_OWNER','DOMAIN_EXPERT'), param('houseId').isMongoId(),
  body('stage').isString().isIn([...HOUSE_STAGES]), validate, farmController.setHouseStage)

export default router
