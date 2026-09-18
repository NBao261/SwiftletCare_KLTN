import { Router } from 'express'
import { body, param } from 'express-validator'
import * as deviceController from '@/controllers/devices.controller'
import { authenticate, requireRole } from '@/middlewares/auth.middleware'
import { validate } from '@/middlewares/validate.middleware'

const router = Router()
router.use(authenticate)

// Sensor Nodes (ESP32)
// Đăng ký/kích hoạt thiết bị là việc của Technician (nhân viên công ty) qua Web
// Console Onboarding — Farm Owner KHÔNG tự đăng ký (SRS §4.1, FARM-FR-003, RACI mục 4.4).
router.post('/sensor-nodes/register',        requireRole('TECHNICIAN','ADMIN'), body('device_id').notEmpty(), body('zone_id').isMongoId(), validate, deviceController.registerSensorNode)
router.get ('/sensor-nodes',                 deviceController.listSensorNodes)
router.get ('/sensor-nodes/:id',             param('id').isMongoId(), validate, deviceController.getSensorNode)
// Chỉnh thông số vận hành vẫn thuộc Farm Owner (ENV-FR-006); Technician chỉnh khi xử lý sự cố.
router.put ('/sensor-nodes/:id/thresholds',  requireRole('FARM_OWNER','TECHNICIAN','ADMIN'), param('id').isMongoId(), validate, deviceController.updateThresholds)
// Điều khiển relay: Farm Owner (vận hành hằng ngày) + Technician (khắc phục sự cố) — RACI mục 4.4.
router.post('/sensor-nodes/:id/relay',       requireRole('FARM_OWNER','TECHNICIAN','ADMIN'), param('id').isMongoId(), body('relayName').notEmpty(), body('state').isBoolean(), validate, deviceController.controlRelay)
// Dời thiết bị sang Zone/Farm khác — chỉ khi ONLINE (FARM-FR-007b, Flow 21 Nhánh A).
// KHÔNG cho FARM_OWNER tự làm (SRS RACI mục 4.4 — gán nhầm Zone làm sai lệch telemetry vĩnh viễn).
router.put ('/sensor-nodes/:id/reassign-zone', requireRole('TECHNICIAN','ADMIN'), param('id').isMongoId(), body('newZoneId').isMongoId(), validate, deviceController.reassignZone)

// Camera Nodes (RPi)
router.post('/camera-nodes/register',        requireRole('TECHNICIAN','ADMIN'), body('device_id').notEmpty(), body('zone_id').isMongoId(), validate, deviceController.registerCameraNode)
router.get ('/camera-nodes',                 deviceController.listCameraNodes)

// OPS-NFR-004 — Admin dashboard trạng thái node toàn hệ thống
router.get ('/fleet-status',                 requireRole('ADMIN'), deviceController.getFleetStatus)

export default router
