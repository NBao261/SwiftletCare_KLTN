'use strict';
/** Auth Routes – SRS §9.1 Authentication, AUTH-FR-001..007 */
const router = require('express').Router();
const { body } = require('express-validator');
const authController = require('../controllers/auth');
const { authenticate } = require('../middlewares/auth');

router.post('/register',
  [body('email').isEmail(), body('password').isLength({ min: 8 }), body('full_name').notEmpty()],
  authController.register);

router.post('/login',
  [body('email').isEmail(), body('password').notEmpty()],
  authController.login);

router.post('/refresh',     authController.refresh);
router.post('/logout',      authenticate, authController.logout);
router.post('/otp/send',    authController.sendOtp);
router.post('/otp/verify',  authController.verifyOtp);

module.exports = router;
