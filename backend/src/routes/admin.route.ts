import { Router } from 'express'
import { body, param } from 'express-validator'
import * as adminController from '@/controllers/admin.controller'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'

const router = Router()
router.use(authenticate, requireRole('ADMIN'))

/** Quản lý tài khoản – AUTH-FR-011, AUTH-FR-012, Flow 19 */
router.get('/users',                          adminController.listUsers)
router.put('/users/:id/status',
  param('id').isMongoId(), body('is_active').isBoolean(), validate,
  adminController.setUserStatus,
)
router.get('/delete-requests',                adminController.listDeletionRequests)
router.put('/delete-requests/:id/complete',
  param('id').isMongoId(), validate,
  adminController.completeDeletionRequest,
)

/** Admin tự tạo tài khoản Technician/Sales Staff – AUTH-FR-005c, Flow 16 */
router.post('/technicians',
  body('email').isEmail(), body('password').isLength({ min: 8 }), body('full_name').trim().notEmpty(),
  body('assigned_regions').isArray({ min: 1 }), validate,
  adminController.createTechnician,
)
router.post('/sales-staff',
  body('email').isEmail(), body('password').isLength({ min: 8 }), body('full_name').trim().notEmpty(),
  body('farm_ids').isArray({ min: 1 }), body('farm_ids.*').isMongoId(), validate,
  adminController.createSalesStaff,
)

export default router
