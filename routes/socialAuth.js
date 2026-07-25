const express = require('express');
const router = express.Router();
const socialAuthController = require('../controllers/socialAuthController');
const { authMiddleware } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Social Auth
 *   description: SNS 로그인 (Kakao/Naver/Google)
 */

/**
 * @swagger
 * /api/auth/social/kakao:
 *   post:
 *     tags: [Social Auth]
 *     summary: Kakao OAuth 로그인
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [accessToken]
 *             properties:
 *               accessToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: 로그인 완료
 */
router.post('/kakao', socialAuthController.kakao);

/**
 * @swagger
 * /api/auth/social/naver:
 *   post:
 *     tags: [Social Auth]
 *     summary: Naver OAuth 로그인
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [accessToken]
 *             properties:
 *               accessToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: 로그인 완료
 */
router.post('/naver', socialAuthController.naver);

/**
 * @swagger
 * /api/auth/social/google:
 *   post:
 *     tags: [Social Auth]
 *     summary: Google OAuth 로그인
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [accessToken]
 *             properties:
 *               accessToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: 로그인 완료
 */
router.post('/google', socialAuthController.google);

/**
 * @swagger
 * /api/auth/social/accounts:
 *   get:
 *     tags: [Social Auth]
 *     summary: 연결된 SNS 계정 목록
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: SNS 계정 목록
 */
router.get('/accounts', authMiddleware, socialAuthController.getAccounts);

/**
 * @swagger
 * /api/auth/social/link:
 *   post:
 *     tags: [Social Auth]
 *     summary: 현재 사용자에 SNS 계정 연결
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [provider, accessToken]
 *             properties:
 *               provider:
 *                 type: string
 *               accessToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: 연결 완료
 */
router.post('/link', authMiddleware, socialAuthController.link);

/**
 * @swagger
 * /api/auth/social/unlink/{provider}:
 *   delete:
 *     tags: [Social Auth]
 *     summary: SNS 계정 연결 해제
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 연결 해제 완료
 */
router.delete('/unlink/:provider', authMiddleware, socialAuthController.unlink);

module.exports = router;
