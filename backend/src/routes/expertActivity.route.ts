import { Router } from 'express'
import { body, param, query } from 'express-validator'
import * as expertActivityController from '@/controllers/expertActivity.controller'
import { EXPERT_DECISION_ACTIONS } from '@/services/expertActivity.service'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'

const router = Router()
// EXPERT-FR-009/010/011 — chỉ Farm Owner và Domain Expert của farm (service kiểm thành viên);
// Technician, Administrator → 403
router.use(authenticate, requireRole('FARM_OWNER', 'DOMAIN_EXPERT'))

const pageQuery = [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1 })]
const farmScope = [query('farmId').isString().isMongoId(), query('zoneId').optional().isString().isMongoId()]

router.get('/',
  ...farmScope,
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  query('type').optional().isString().isIn([...EXPERT_DECISION_ACTIONS]),
  query('houseId').optional().isString().isMongoId(),
  ...pageQuery,
  validate,
  expertActivityController.list,
)

// EXPERT-FR-010, Report 3 §6.10 — mục duyệt thay đổi của Farm Owner; chỉ Domain Expert chấp nhận / hoàn lại
router.get('/reviews',
  ...farmScope, query('status').optional().isString().isIn(['PENDING_REVIEW', 'ACCEPTED', 'REVERTED', 'ADJUSTED']),
  ...pageQuery, validate, expertActivityController.listReviews)
router.put('/reviews/:id/accept', requireRole('DOMAIN_EXPERT'), param('id').isMongoId(), validate, expertActivityController.acceptReview)
router.put('/reviews/:id/revert', requireRole('DOMAIN_EXPERT'), param('id').isMongoId(), validate, expertActivityController.revertReview)

// EXPERT-FR-011, Report 3 §6.11 — Farm Owner gửi gợi ý hệ số; chỉ Domain Expert duyệt / từ chối (từ chối phải có lý do)
router.get('/proposals',
  ...farmScope, query('status').optional().isString().isIn(['PROPOSED', 'APPROVED', 'REJECTED', 'SUPERSEDED']),
  ...pageQuery, validate, expertActivityController.listProposals)
router.post('/proposals', requireRole('FARM_OWNER'), body('zoneId').isString().isMongoId(), validate, expertActivityController.submitProposal)
router.put('/proposals/:id/approve', requireRole('DOMAIN_EXPERT'), param('id').isMongoId(), validate, expertActivityController.approveProposal)
router.put('/proposals/:id/reject', requireRole('DOMAIN_EXPERT'), param('id').isMongoId(),
  body('note').isString().trim().notEmpty().withMessage('Từ chối đề xuất phải ghi lý do').isLength({ max: 1000 }),
  validate, expertActivityController.rejectProposal)

export default router
