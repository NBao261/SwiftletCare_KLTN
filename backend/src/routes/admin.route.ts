import { Router } from 'express'
import { body, param, query } from 'express-validator'
import * as adminController from '@/controllers/admin.controller'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'
import type { Role } from '@/types'
import { DEVICE_ID_PATTERN } from '@/utils/deviceCommand.util'

const router = Router()
router.use(authenticate, requireRole('ADMIN'))

// Đủ mọi role của users.role — thiếu 1 role thì Admin không lọc được loại tài khoản đó (422)
const ROLES: Role[] = ['ADMIN', 'FARM_OWNER', 'DOMAIN_EXPERT', 'FARM_TECHNICIAN']
// Không chặn cứng limit > 100 — paginate() tự kẹp về mức tối đa như mọi list khác
const paginationQuery = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1 }),
]

/** Quản lý tài khoản – AUTH-FR-011, AUTH-FR-012, Flow 19 */
router.get('/users',
  query('role').optional().isIn(ROLES), query('status').optional().isIn(['active', 'inactive', 'deleted']),
  // Tìm theo tên/email/SĐT
  query('q').optional().isString().trim().isLength({ max: 100 }),
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
router.put('/delete-requests/:id/complete',
  param('id').isMongoId(), validate,
  adminController.completeDeletionRequest,
)
// Từ chối phải có lý do — người yêu cầu được báo lại lý do đó (AUTH-FR-012)
router.put('/delete-requests/:id/reject',
  param('id').isMongoId(), body('reason').isString().trim().notEmpty(), validate,
  adminController.rejectDeletionRequest,
)

/** Kho thiết bị xuất xưởng: cấp cặp {device_id, secretKey} để in nhãn – FARM-FR-003, Flow 1 bước 3 */
router.post('/provisioned-devices',
  body('device_id').isString().trim().matches(DEVICE_ID_PATTERN), body('kind').isIn(['SENSOR', 'CAMERA']), validate,
  adminController.createProvisionedDevice,
)
router.get('/provisioned-devices',
  query('kind').optional().isIn(['SENSOR', 'CAMERA']), query('claimed').optional().isIn(['true', 'false']),
  query('revoked').optional().isIn(['true', 'false']),
  ...paginationQuery, validate,
  adminController.listProvisionedDevices,
)
/** Thu hồi thiết bị trong kho (mất/lộ nhãn, hàng lỗi) — không kích hoạt được nữa */
router.put('/provisioned-devices/:id/revoke',
  param('id').isMongoId(), body('reason').isString().trim().notEmpty(), validate,
  adminController.revokeProvisionedDevice,
)
/** Cấp secretKey mới để in lại nhãn — chỉ thiết bị chưa kích hoạt (key mới trả 1 lần) */
router.post('/provisioned-devices/:id/rotate-key', param('id').isMongoId(), validate, adminController.rotateProvisionedKey)

/** FARM-FR-010 — cấp mật khẩu broker mới (trả 1 lần, phải flash lại vào thiết bị) */
router.post('/provisioned-devices/:id/rotate-broker-secret', param('id').isMongoId(), validate, adminController.rotateBrokerSecret)

export default router
