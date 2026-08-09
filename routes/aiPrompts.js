const express = require('express');
const router = express.Router();
const aiPromptService = require('../services/AIPromptService');
const { authMiddleware, adminOnly } = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: AIPrompts
 *   description: AI 프롬프트 템플릿 관리 API
 */

/**
 * @swagger
 * /api/ai-prompts:
 *   get:
 *     tags: [AIPrompts]
 *     summary: 프롬프트 템플릿 목록 조회
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 프롬프트 템플릿 목록
 */
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const prompts = await aiPromptService.listPrompts(includeInactive);
    res.json({ success: true, prompts });
  } catch (_err) {
    res.status(500).json({ error: '프롬프트 조회 실패' });
  }
});

/**
 * @swagger
 * /api/ai-prompts:
 *   post:
 *     tags: [AIPrompts]
 *     summary: 새 프롬프트 템플릿 생성
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, prompt]
 *             properties:
 *               name: { type: string }
 *               prompt: { type: string }
 *               description: { type: string }
 *     responses:
 *       201:
 *         description: 생성된 프롬프트 템플릿
 */
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, prompt, description } = req.body;
    if (!name || !prompt) {
      return res.status(400).json({ error: 'name과 prompt는 필수입니다.' });
    }
    const template = await aiPromptService.createPrompt(name, prompt, description);
    res.created(template);
  } catch (_err) {
    res.status(500).json({ error: '프롬프트 생성 실패' });
  }
});

/**
 * @swagger
 * /api/ai-prompts/{name}:
 *   put:
 *     tags: [AIPrompts]
 *     summary: 프롬프트 템플릿 새 버전 생성
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [prompt]
 *             properties:
 *               prompt: { type: string }
 *               description: { type: string }
 *     responses:
 *       200:
 *         description: 업데이트된 프롬프트 템플릿
 */
router.put('/:name', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { prompt, description } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'prompt는 필수입니다.' });
    }
    const template = await aiPromptService.updatePrompt(req.params.name, prompt, description);
    res.json({ success: true, template });
  } catch (_err) {
    res.status(500).json({ error: '프롬프트 업데이트 실패' });
  }
});

/**
 * @swagger
 * /api/ai-prompts/{name}:
 *   delete:
 *     tags: [AIPrompts]
 *     summary: 프롬프트 템플릿 비활성화
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: name
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: 비활성화 완료
 */
router.delete('/:name', authMiddleware, adminOnly, async (req, res) => {
  try {
    await aiPromptService.deactivatePrompt(req.params.name);
    res.json({ success: true, message: '프롬프트가 비활성화되었습니다.' });
  } catch (_err) {
    res.status(500).json({ error: '프롬프트 비활성화 실패' });
  }
});

module.exports = router;
