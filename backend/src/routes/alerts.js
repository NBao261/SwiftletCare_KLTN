'use strict';
/** Alert Routes – SRS §9.1 Alerts, ALERT-FR-007..009 */
const router = require('express').Router();
const { authenticate } = require('../middlewares/auth');
const alertController = require('../controllers/alerts');

router.use(authenticate);

router.get ('/',          alertController.list);          // ?farmId=&severity=&status=&page=&limit=
router.get ('/:id',       alertController.getOne);
router.put ('/:id/acknowledge', alertController.acknowledge);

module.exports = router;
