const express = require('express');
const router = express.Router();
const admin2faController = require('../controllers/admin2faController');
const { authMiddleware, adminOnly } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Admin Auth
 *   description: 관리자 2FA 인증 API
 */

/**
 * @swagger
 * /api/admin/auth/send-2fa-otp:
 *   post:
 *     tags: [Admin Auth]
 *     summary: 2차 로그인 OTP 발송 (temp_token 필요)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: OTP 발송 완료
 *       401:
 *         description: 임시 토큰 없음/만료
 */
router.post('/send-2fa-otp', admin2faController.sendLoginOtp);

/**
 * @swagger
 * /api/admin/auth/verify-2fa-otp:
 *   post:
 *     tags: [Admin Auth]
 *     summary: 2차 로그인 OTP 검증 (temp_token + otp) → 최종 JWT 발급
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [otp]
 *             properties:
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: 2FA 인증 완료 (JWT 발급)
 *       401:
 *         description: 임시 토큰 없음/만료
 *       400:
 *         description: OTP 불일치/만료
 */
router.post('/verify-2fa-otp', admin2faController.verifyLoginOtp);

/**
 * @swagger
 * /api/admin/auth/2fa/status:
 *   get:
 *     tags: [Admin Auth]
 *     summary: 2FA 활성화 상태 확인
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 2FA 상태
 */
router.get('/2fa/status', authMiddleware, adminOnly, admin2faController.getStatus);

/**
 * @swagger
 * /api/admin/auth/2fa/send-otp:
 *   post:
 *     tags: [Admin Auth]
 *     summary: 2FA 설정 변경 OTP 발송 (ENABLE / DISABLE)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [purpose]
 *             properties:
 *               purpose:
 *                 type: string
 *                 enum: [ENABLE, DISABLE]
 *     responses:
 *       200:
 *         description: OTP 발송 완료
 */
router.post('/2fa/send-otp', authMiddleware, adminOnly, admin2faController.sendSettingsOtp);

/**
 * @swagger
 * /api/admin/auth/2fa/verify:
 *   post:
 *     tags: [Admin Auth]
 *     summary: 2FA 설정 OTP 검증 및 적용
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [purpose, otp]
 *             properties:
 *               purpose:
 *                 type: string
 *                 enum: [ENABLE, DISABLE]
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: 2FA 설정 적용됨
 */
router.post('/2fa/verify', authMiddleware, adminOnly, admin2faController.verifySettingsOtp);

module.exports = router;
