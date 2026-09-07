'use strict';
/** Farm Routes – SRS §9.1 Farms, FARM-FR-001..008 */
const router = require('express').Router();
const { authenticate, requireRole } = require('../middlewares/auth');
const farmController = require('../controllers/farms');

router.use(authenticate);

router.get  ('/',             farmController.list);
router.post ('/',             requireRole('FARM_OWNER','ADMIN'), farmController.create);
router.get  ('/:id',          farmController.getOne);
router.put  ('/:id',          requireRole('FARM_OWNER','ADMIN'), farmController.update);
router.delete('/:id',         requireRole('FARM_OWNER','ADMIN'), farmController.remove);
router.post ('/:id/members',  requireRole('FARM_OWNER','ADMIN'), farmController.inviteMember);

// Houses
router.post ('/:id/houses',   requireRole('FARM_OWNER','ADMIN'), farmController.createHouse);
router.get  ('/:id/houses',   farmController.listHouses);

// Zones (under house)
router.post ('/houses/:houseId/zones', requireRole('FARM_OWNER','ADMIN'), farmController.createZone);
router.get  ('/houses/:houseId/zones', farmController.listZones);

module.exports = router;
