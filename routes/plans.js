const express = require('express');
const router = express.Router();
const PlanService = require('../services/PlanService');

/**
 * @swagger
 * tags:
 *   name: Plans
 *   description: 플랜 조회 API (공개)
 */

/**
 * @swagger
 * /api/plans:
 *   get:
 *     tags: [Plans]
 *     summary: 활성 플랜 목록 조회 (로그인 사업자/비로그인 모두 접근 가능)
 *     responses:
 *       200:
 *         description: 활성 플랜 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Plan'
 */
router.get('/', async (req, res, next) => {
  try {
    const plans = await PlanService.getActivePlans();
    res.success(plans);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
