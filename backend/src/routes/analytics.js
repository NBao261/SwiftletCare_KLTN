'use strict';
/** Analytics Routes – SRS §9.1, ANALYTICS-FR-001..006 */
const router = require('express').Router();
const { authenticate } = require('../middlewares/auth');
const analyticsController = require('../controllers/analytics');

router.use(authenticate);

router.get('/bird-count/daily',  analyticsController.birdCountDaily);
router.get('/bird-count/trends', analyticsController.birdCountTrends);
router.get('/correlation',       analyticsController.envBirdCorrelation);

module.exports = router;
