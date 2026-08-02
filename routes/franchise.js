const express = require('express');
const router = express.Router();
const franchiseController = require('../controllers/franchiseController');
const authMiddleware = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Franchise
 *   description: 프랜차이즈 본사 통합 관리 및 공지 전파 API
 */

/**
 * @swagger
 * /api/franchise/overview:
 *   get:
 *     tags: [Franchise]
 *     summary: 프랜차이즈 본사 통합 매출 및 매장 현황 조회
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 통합 현황 조회 성공
 */
router.get('/overview', authMiddleware, franchiseController.getOverview);

/**
 * @swagger
 * /api/franchise/notice:
 *   post:
 *     tags: [Franchise]
 *     summary: 본사 공지사항 일괄 전파
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               message:
 *                 type: string
 *               target_store_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *       description: 공지 전파 성공
 */
router.post('/notice', authMiddleware, franchiseController.broadcastNotice);

module.exports = router;
