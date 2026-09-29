import { Router } from 'express'
import { body, param, query } from 'express-validator'
import * as adminController from '@/controllers/admin.controller'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'
import type { Role } from '@/types'

const router = Router()
router.use(authenticate, requireRole('ADMIN'))

const ROLES: Role[] = ['ADMIN', 'FARM_OWNER', 'TECHNICIAN']
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

/** Admin tự tạo tài khoản Technician – AUTH-FR-005c */
router.post('/technicians',
  body('email').isEmail(), body('password').isLength({ min: 8 }), body('full_name').trim().notEmpty(),
  body('assigned_regions').isArray({ min: 1 }), body('assigned_regions.*').isString().trim().notEmpty(), validate,
  adminController.createTechnician,
)
/** Điều chỉnh khu vực Technician – AUTH-FR-005c, Flow 21 4a-x */
router.put('/technicians/:id/regions',
  param('id').isMongoId(),
  body('assigned_regions').isArray({ min: 1 }), body('assigned_regions.*').isString().trim().notEmpty(),
  validate,
  adminController.updateTechnicianRegions,
)
/** Kho thiết bị xuất xưởng: cấp cặp {device_id, secretKey} để in nhãn – FARM-FR-003, Flow 1 bước 3 */
router.post('/provisioned-devices',
  body('device_id').isString().trim().notEmpty(), body('kind').isIn(['SENSOR', 'CAMERA']), validate,
  adminController.createProvisionedDevice,
)
router.get('/provisioned-devices',
  query('kind').optional().isIn(['SENSOR', 'CAMERA']), query('claimed').optional().isIn(['true', 'false']),
  ...paginationQuery, validate,
  adminController.listProvisionedDevices,
)

export default router
