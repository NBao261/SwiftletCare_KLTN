'use strict';
/** Device Routes – SRS §9.1 Devices, FARM-FR-003..008 */
const router = require('express').Router();
const { authenticate, requireRole } = require('../middlewares/auth');
const deviceController = require('../controllers/devices');

router.use(authenticate);

// Sensor Nodes (ESP32)
router.post ('/sensor-nodes/register',         requireRole('FARM_OWNER','ADMIN'), deviceController.registerSensorNode);
router.get  ('/sensor-nodes',                  deviceController.listSensorNodes);
router.get  ('/sensor-nodes/:id',              deviceController.getSensorNode);
router.put  ('/sensor-nodes/:id/thresholds',   requireRole('FARM_OWNER','ADMIN'), deviceController.updateThresholds);
router.post ('/sensor-nodes/:id/relay',        requireRole('FARM_OWNER','OPERATOR','ADMIN'), deviceController.controlRelay);

// Camera Nodes (RPi)
router.post ('/camera-nodes/register',         requireRole('FARM_OWNER','ADMIN'), deviceController.registerCameraNode);
router.get  ('/camera-nodes',                  deviceController.listCameraNodes);

module.exports = router;
