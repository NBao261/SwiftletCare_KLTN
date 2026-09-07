import { Router } from 'express'
import { body, param } from 'express-validator'
import * as deviceController from '@/controllers/devices'
import { authenticate, requireRole } from '@/middlewares/auth'
import { validate } from '@/middlewares/validate'

const router = Router()
router.use(authenticate)

// Sensor Nodes (ESP32)
router.post('/sensor-nodes/register',        requireRole('FARM_OWNER','ADMIN'), [body('device_id').notEmpty(), body('zone_id').isMongoId()], validate, deviceController.registerSensorNode)
router.get ('/sensor-nodes',                 deviceController.listSensorNodes)
router.get ('/sensor-nodes/:id',             [param('id').isMongoId()], validate, deviceController.getSensorNode)
router.put ('/sensor-nodes/:id/thresholds',  requireRole('FARM_OWNER','ADMIN'), [param('id').isMongoId()], validate, deviceController.updateThresholds)
router.post('/sensor-nodes/:id/relay',       requireRole('FARM_OWNER','OPERATOR','ADMIN'), [param('id').isMongoId(), body('relayName').notEmpty(), body('state').isBoolean()], validate, deviceController.controlRelay)

// Camera Nodes (RPi)
router.post('/camera-nodes/register',        requireRole('FARM_OWNER','ADMIN'), [body('device_id').notEmpty(), body('zone_id').isMongoId()], validate, deviceController.registerCameraNode)
router.get ('/camera-nodes',                 deviceController.listCameraNodes)

export default router
