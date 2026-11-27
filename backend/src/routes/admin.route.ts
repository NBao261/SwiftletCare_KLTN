import { Router } from 'express'
import multer from 'multer'
import { body, param, query } from 'express-validator'
import * as adminController from '@/controllers/admin.controller'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'
import type { Role } from '@/types'
import { CHIP_MAC_PATTERN, DEVICE_ID_PATTERN } from '@/utils/deviceCommand.util'
import { FIRMWARE_VERSION_PATTERN, MAX_FACTORY_IMAGE_BYTES } from '@/utils/firmwareImage.util'
import { LIMITS, PHONE_PATTERN, emailField, reasonField } from '@/utils/inputRules.util'

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
  emailField(), body('full_name').isString().bail().trim().notEmpty().isLength({ max: LIMITS.fullName }),
  // Chuỗi rỗng = không nhập số điện thoại
  body('phone').optional({ values: 'falsy' }).isString().bail().trim().matches(PHONE_PATTERN), validate,
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
router.put('/delete-requests/:id/reject',
  param('id').isMongoId(), reasonField(), validate,
  adminController.rejectDeletionRequest,
)

// Tối đa 40 ký tự như firmware nhận khi nạp qua USB
router.post('/provisioned-devices',
  body('device_id').isString().trim().isLength({ max: 40 }).matches(DEVICE_ID_PATTERN), body('kind').isIn(['SENSOR', 'CAMERA']),
  body('simulated').optional().isBoolean({ strict: true }),
  body('chip_mac').optional().isString().trim().toUpperCase().matches(CHIP_MAC_PATTERN), validate,
  adminController.createProvisionedDevice,
)
router.get('/provisioned-devices',
  query('kind').optional().isIn(['SENSOR', 'CAMERA']), query('claimed').optional().isIn(['true', 'false']),
  query('revoked').optional().isIn(['true', 'false']),
  query('deviceId').optional().isString().matches(DEVICE_ID_PATTERN),
  query('chipMac').optional().isString().toUpperCase().matches(CHIP_MAC_PATTERN),
  ...paginationQuery, validate,
  adminController.listProvisionedDevices,
)
router.put('/provisioned-devices/:id/revoke',
  param('id').isMongoId(), reasonField(), validate,
  adminController.revokeProvisionedDevice,
)
router.post('/provisioned-devices/:id/rotate-key', param('id').isMongoId(), validate, adminController.rotateProvisionedKey)

router.post('/provisioned-devices/:id/rotate-broker-secret', param('id').isMongoId(), validate, adminController.rotateBrokerSecret)
// Mã dùng một lần để nút AI tự lấy danh tính (tools/setup_node.py), thay việc chép mật khẩu broker
router.post('/provisioned-devices/:id/setup-code', param('id').isMongoId(), validate, adminController.issueSetupCode)

// Kho firmware cho trạm nạp: ảnh cài đặt gộp, kiểm ở service (factoryImageProblem)
const firmwareUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FACTORY_IMAGE_BYTES, files: 1 } })
router.post('/firmware-images', firmwareUpload.single('file'),
  body('version').isString().trim().matches(FIRMWARE_VERSION_PATTERN),
  body('note').optional().isString().trim().isLength({ max: 200 }), validate,
  adminController.uploadFirmwareImage,
)
router.get('/firmware-images', ...paginationQuery, validate, adminController.listFirmwareImages)
router.get('/firmware-images/:id/file', param('id').isMongoId(), validate, adminController.downloadFirmwareImage)
router.delete('/firmware-images/:id', param('id').isMongoId(), validate, adminController.deleteFirmwareImage)

// Đợt cập nhật firmware từ xa: máy offline chờ trong đợt, nhận khi online lại
router.get('/firmware-rollouts', ...paginationQuery, validate, adminController.listFirmwareRollouts)
router.post('/firmware-rollouts',
  body('image_id').isString().isMongoId(),
  body('node_ids').isArray({ min: 1, max: 500 }), body('node_ids.*').isString().isMongoId(),
  body('canary_node_ids').optional().isArray({ max: 500 }), body('canary_node_ids.*').isString().isMongoId(),
  body('note').optional().isString().trim().isLength({ max: 200 }), validate,
  adminController.createFirmwareRollout,
)
for (const action of ['pause', 'resume', 'promote', 'cancel'] as const) {
  router.post(`/firmware-rollouts/:id/${action}`, param('id').isMongoId(), validate, adminController.changeFirmwareRollout(action))
}
router.post('/firmware-rollouts/:id/targets/:nodeId/retry', param('id').isMongoId(), param('nodeId').isMongoId(), validate,
  adminController.retryFirmwareRolloutTarget)

export default router
