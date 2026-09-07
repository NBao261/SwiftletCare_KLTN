'use strict';
/** Telemetry Routes – SRS §9.1, ENV-FR-004, ANALYTICS-FR-001 */
const router = require('express').Router();
const { authenticate } = require('../middlewares/auth');
const telemetryController = require('../controllers/telemetry');

router.use(authenticate);

router.get('/zones/:id/latest',  telemetryController.getLatest);
router.get('/zones/:id/history', telemetryController.getHistory);  // ?from=&to=&interval=

module.exports = router;
