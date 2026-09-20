import { Router } from 'express'
import { body, param, query } from 'express-validator'
import * as adminController from '@/controllers/admin.controller'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'
import type { Role } from '@/types'

const router = Router()
router.use(authenticate, requireRole('ADMIN'))

const ROLES: Role[] = ['ADMIN', 'FARM_OWNER', 'TECHNICIAN', 'SALES_STAFF']
// Không chặn cứng limit > 100 — paginate() tự kẹp về mức tối đa như mọi list khác
const paginationQuery = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1 }),
]

/** Quản lý tài khoản – AUTH-FR-011, AUTH-FR-012, Flow 19 */
router.get('/users',
  query('role').optional().isIn(ROLES), query('status').optional().isIn(['active', 'inactive']),
  ...paginationQuery, validate,
  adminController.listUsers,
)
// toBoolean(): isBoolean() chỉ kiểm tra, không đổi kiểu — chuỗi "false"/"0" lọt xuống service là truthy
router.put('/users/:id/status',
  param('id').isMongoId(), body('is_active').isBoolean().toBoolean(), validate,
  adminController.setUserStatus,
)
router.get('/delete-requests',
  ...paginationQuery, validate,
  adminController.listDeletionRequests,
)
// force: bỏ qua cảnh báo ticket đang mở (Flow 19 bước 7c)
router.put('/delete-requests/:id/complete',
  param('id').isMongoId(), body('force').optional().isBoolean().toBoolean(), validate,
  adminController.completeDeletionRequest,
)

/** Admin tự tạo tài khoản Technician/Sales Staff – AUTH-FR-005c, Flow 16 */
router.post('/technicians',
  body('email').isEmail(), body('password').isLength({ min: 8 }), body('full_name').trim().notEmpty(),
  body('assigned_regions').isArray({ min: 1 }), body('assigned_regions.*').isString().trim().notEmpty(), validate,
  adminController.createTechnician,
)
router.post('/sales-staff',
  body('email').isEmail(), body('password').isLength({ min: 8 }), body('full_name').trim().notEmpty(),
  body('farm_ids').isArray({ min: 1 }), body('farm_ids.*').isMongoId(), validate,
  adminController.createSalesStaff,
)

/** Điều chỉnh khu vực Technician / gỡ Sales Staff khỏi farm – AUTH-FR-005c, Flow 21 4a-x, Flow 16 1e */
router.put('/technicians/:id/regions',
  param('id').isMongoId(),
  body('assigned_regions').isArray({ min: 1 }), body('assigned_regions.*').isString().trim().notEmpty(),
  validate,
  adminController.updateTechnicianRegions,
)
router.delete('/farms/:farmId/sales-staff/:salesStaffId',
  param('farmId').isMongoId(), param('salesStaffId').isMongoId(), validate,
  adminController.unassignSalesStaff,
)

/** Duyệt đề xuất Sales Staff của Farm Owner – AUTH-FR-005d, Flow 16 bước 1b */
router.get('/sales-staff-requests',
  query('status').optional().isIn(['PENDING', 'APPROVED', 'REJECTED']), ...paginationQuery, validate,
  adminController.listSalesStaffRequests,
)
router.put('/sales-staff-requests/:id/decision',
  param('id').isMongoId(), body('decision').isIn(['APPROVED', 'REJECTED']), validate,
  adminController.decideSalesStaffRequest,
)

export default router
