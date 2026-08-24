const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const { 
  loginSchema, 
  registerSchema, 
  updateProfileSchema, 
  changePasswordSchema,
  refreshTokenSchema,
  sendVerificationSchema,
  verifyCodeSchema,
} = require('../src/validation/schemas');

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: 인증 및 사용자 관리 API
 */

/**
 * @swagger
 * /api/auth/send-verification:
 *   post:
 *     tags: [Auth]
 *     summary: 이메일/전화 인증 코드 발송
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               type:
 *                 type: string
 *                 enum: [register, reset_password, change_email]
 *     responses:
 *       200:
 *         description: 인증 코드 발송 완료
 */
router.post('/send-verification', validateBody(sendVerificationSchema), authController.sendVerification);

/**
 * @swagger
 * /api/auth/verify-code:
 *   post:
 *     tags: [Auth]
 *     summary: 인증 코드 확인
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               code:
 *                 type: string
 *                 pattern: '^[0-9]{6}$'
 *               type:
 *                 type: string
 *                 enum: [register, reset_password, change_email]
 *     responses:
 *       200:
 *         description: 인증 코드 확인 완료
 */
router.post('/verify-code', validateBody(verifyCodeSchema), authController.verifyCode);

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: 회원가입 (이메일 기반)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, passwordConfirm, name, agreeTerms, agreePrivacy]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               passwordConfirm:
 *                 type: string
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               businessNumber:
 *                 type: string
 *               storeName:
 *                 type: string
 *               agreeTerms:
 *                 type: boolean
 *               agreePrivacy:
 *                 type: boolean
 *               agreeMarketing:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: 회원가입 완료 (JWT 토큰 발급)
 */
router.post('/register', validateBody(registerSchema), authController.register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: 로그인
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               rememberMe:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: 로그인 완료 (JWT 토큰 발급)
 */
router.post('/login', validateBody(loginSchema), authController.login);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: 현재 사용자 정보 조회
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 사용자 정보
 */
router.get('/me', authMiddleware, authController.getMe);

/**
 * @swagger
 * /api/auth/profile:
 *   put:
 *     tags: [Auth]
 *     summary: 프로필 수정
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               profileImage:
 *                 type: string
 *                 format: uri
 *     responses:
 *       200:
 *         description: 프로필 수정 완료
 */
router.put(
  '/profile',
  authMiddleware,
  validateBody(updateProfileSchema),
  authController.updateProfile
);

/**
 * @swagger
 * /api/auth/password:
 *   put:
 *     tags: [Auth]
 *     summary: 비밀번호 변경
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword, newPasswordConfirm]
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *               newPasswordConfirm:
 *                 type: string
 *     responses:
 *       200:
 *         description: 비밀번호 변경 완료
 */
router.put(
  '/password',
  authMiddleware,
  validateBody(changePasswordSchema),
  authController.changePassword
);

/**
 * @swagger
 * /api/auth/refresh-token:
 *   post:
 *     tags: [Auth]
 *     summary: 리프레시 토큰으로 새 토큰 발급
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: 새 토큰 발급
 */
router.post('/refresh-token', validateBody(refreshTokenSchema), authController.refreshToken);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: 로그아웃
 *     description: |
 *       HttpOnly 쿠키 모드에서는 서버가 인증 쿠키(token, refreshToken)를 제거한다.
 *       헤더 모드에서는 쿠키가 없으므로 no-op 이며, 클라이언트가 로컬 토큰을 폐기하면 된다.
 *     responses:
 *       200:
 *         description: 로그아웃 완료
 */
router.post('/logout', authController.logout);

// ===== 2FA (일반 사용자 공용) =====
const twoFactorController = require('../controllers/admin2faController');

router.post('/2fa/send-login-otp', twoFactorController.sendLoginOtp);
router.post('/2fa/verify-login-otp', twoFactorController.verifyLoginOtp);
router.get('/2fa/status', authMiddleware, twoFactorController.getStatus);
router.post('/2fa/send-otp', authMiddleware, twoFactorController.sendSettingsOtp);
router.post('/2fa/verify', authMiddleware, twoFactorController.verifySettingsOtp);

module.exports = router;