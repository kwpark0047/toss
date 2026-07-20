const express = require('express');
const router = express.Router();
const aiAssistantController = require('../controllers/aiAssistantController');
const { authMiddleware } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: AI Assistant
 *   description: AI 어시스턴트 채팅 및 번역 API
 */

/**
 * @swagger
 * /api/ai-assistant/chat:
 *   post:
 *     tags: [AI Assistant]
 *     summary: AI 채팅 (메뉴 추천 요청)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: AI 응답
 */
router.post('/chat', authMiddleware, aiAssistantController.chatWithAI);

/**
 * @swagger
 * /api/ai-assistant/translate:
 *   post:
 *     tags: [AI Assistant]
 *     summary: 메시지 실시간 번역
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text, targetLang]
 *             properties:
 *               text:
 *                 type: string
 *               targetLang:
 *                 type: string
 *     responses:
 *       200:
 *         description: 번역 결과
 */
router.post('/translate', authMiddleware, aiAssistantController.translateMessage);

module.exports = router;
