import { Router } from 'express'
import { body, param, query } from 'express-validator'
import * as adminController from '@/controllers/admin.controller'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'
import type { Role } from '@/types'

const router = Router()
router.use(authenticate, requireRole('ADMIN'))

// Đủ mọi role của users.role — thiếu 1 role thì Admin không lọc được loại tài khoản đó (422)
const ROLES: Role[] = ['ADMIN', 'FARM_OWNER', 'DOMAIN_EXPERT', 'TECHNICIAN']
const PHONE_RE = /^(0|\+84)\d{9}$/
// Không chặn cứng limit > 100 — paginate() tự kẹp về mức tối đa như mọi list khác
const paginationQuery = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1 }),
]

/** Quản lý tài khoản – AUTH-FR-011, AUTH-FR-012, Flow 19 */
router.get('/users',
  query('role').optional().isIn(ROLES), query('status').optional().isIn(['active', 'inactive', 'deleted']),
  // Tìm theo tên/email/SĐT; region chỉ có nghĩa với Technician (assigned_regions)
  query('q').optional().isString().trim().isLength({ max: 100 }),
  query('region').optional().isString().trim().notEmpty(),
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
// Từ chối phải có lý do — người yêu cầu được báo lại lý do đó (AUTH-FR-012)
router.put('/delete-requests/:id/reject',
  param('id').isMongoId(), body('reason').isString().trim().notEmpty(), validate,
  adminController.rejectDeletionRequest,
)

/** Admin tự tạo tài khoản Technician – AUTH-FR-005c */
router.post('/technicians',
  body('email').isEmail(), body('password').isLength({ min: 8 }), body('full_name').trim().notEmpty(),
  // Cùng quy tắc với form tạo user ở frontend (validations/admin/user.validation.ts) — gọi API thẳng cũng không lưu được SĐT sai
  body('phone').optional({ values: 'falsy' }).isString().customSanitizer((v: string) => v.replace(/[\s.-]/g, ''))
    .matches(PHONE_RE).withMessage('SĐT phải là 10 số bắt đầu bằng 0 hoặc +84 rồi 9 số'),
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
/** Sửa tên/SĐT Technician – AUTH-FR-005c. phone rỗng = xoá SĐT */
router.put('/technicians/:id/profile',
  param('id').isMongoId(),
  body('full_name').optional().isString().trim().notEmpty(),
  body('phone').optional().isString().customSanitizer((v: string) => v.replace(/[\s.-]/g, ''))
    .custom((v: string) => v === '' || PHONE_RE.test(v)).withMessage('SĐT phải là 10 số bắt đầu bằng 0 hoặc +84 rồi 9 số'),
  validate,
  adminController.updateTechnicianProfile,
)
/** Cấp mật khẩu tạm cho Technician (trả 1 lần, bắt đổi ở lần đăng nhập sau) – AUTH-FR-005c */
router.put('/technicians/:id/password', param('id').isMongoId(), validate, adminController.resetTechnicianPassword)
/** Kho thiết bị xuất xưởng: cấp cặp {device_id, secretKey} để in nhãn – FARM-FR-003, Flow 1 bước 3 */
router.post('/provisioned-devices',
  body('device_id').isString().trim().notEmpty(), body('kind').isIn(['SENSOR', 'CAMERA']), validate,
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

export default router
