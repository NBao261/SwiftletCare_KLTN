import { Router } from 'express'
import { body, param, query } from 'express-validator'
import * as adminController from '@/controllers/admin.controller'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'
import type { Role } from '@/types'
import { DEVICE_ID_PATTERN } from '@/utils/deviceCommand.util'

const router = Router()
router.use(authenticate, requireRole('ADMIN'))

// Thiếu 1 role thì Admin không lọc được loại tài khoản đó
const ROLES: Role[] = ['ADMIN', 'FARM_OWNER', 'DOMAIN_EXPERT', 'FARM_TECHNICIAN']
// paginate() tự kẹp về mức tối đa
const paginationQuery = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1 }),
]

router.get('/users',
  query('role').optional().isIn(ROLES), query('status').optional().isIn(['active', 'inactive', 'deleted']),
  query('q').optional().isString().trim().isLength({ max: 100 }),
  ...paginationQuery, validate,
  adminController.listUsers,
)
router.post('/farm-owners',
  body('email').isString().bail().trim().isEmail(), body('full_name').isString().bail().trim().notEmpty(),
  body('phone').optional().isString().bail().trim(), validate,
  adminController.createFarmOwner,
)
// toBoolean(): isBoolean() không đổi kiểu, "false" lọt xuống service là truthy
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
// Người yêu cầu được báo lại lý do (AUTH-FR-012)
router.put('/delete-requests/:id/reject',
  param('id').isMongoId(), body('reason').isString().trim().notEmpty(), validate,
  adminController.rejectDeletionRequest,
)

router.post('/provisioned-devices',
  body('device_id').isString().trim().matches(DEVICE_ID_PATTERN), body('kind').isIn(['SENSOR', 'CAMERA']),
  body('simulated').optional().isBoolean({ strict: true }), validate,
  adminController.createProvisionedDevice,
)
router.get('/provisioned-devices',
  query('kind').optional().isIn(['SENSOR', 'CAMERA']), query('claimed').optional().isIn(['true', 'false']),
  query('revoked').optional().isIn(['true', 'false']),
  ...paginationQuery, validate,
  adminController.listProvisionedDevices,
)
router.put('/provisioned-devices/:id/revoke',
  param('id').isMongoId(), body('reason').isString().trim().notEmpty(), validate,
  adminController.revokeProvisionedDevice,
)
router.post('/provisioned-devices/:id/rotate-key', param('id').isMongoId(), validate, adminController.rotateProvisionedKey)

router.post('/provisioned-devices/:id/rotate-broker-secret', param('id').isMongoId(), validate, adminController.rotateBrokerSecret)

export default router
