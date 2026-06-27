const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { auth: schema } = require('../utils/validationSchemas');

router.post('/send-otp', validate(schema.sendOtp), authController.sendOtp);
router.post('/verify-otp', validate(schema.verifyOtp), authController.verifyOtp);
router.post('/register', validate(schema.register), authController.register);
router.post('/login', validate(schema.login), authController.login);
router.get('/me', authMiddleware, authController.getMe);
router.put('/profile', authMiddleware, validate(schema.updateProfile), authController.updateProfile);
router.put('/password', authMiddleware, validate(schema.changePassword), authController.changePassword);
router.post('/refresh-token', authController.refreshToken);

module.exports = router;
