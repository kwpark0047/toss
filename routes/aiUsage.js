const express = require('express');
const router = express.Router();
const aiUsageTracker = require('../utils/aiUsageTracker');
const catchAsync = require('../utils/catchAsync');
const authMiddleware = require('../middleware/auth');
const { getStoreRole } = require('../middleware/storeAuth');

/**
 * @swagger
 * tags:
 *   name: AIUsage
 *   description: AI 호출량/비용 통계 (인증 필요)
 */

/**
 * @swagger
 * /api/ai-usage/stats:
 *   get:
 *     tags: [AIUsage]
 *     summary: AI 사용량·비용 통계
 *     description: |
 *       storeId 를 지정하면 해당 매장 통계를 반환하며 매장 권한이 필요하다.
 *       storeId 를 생략하면 플랫폼 전체 통계이므로 super_admin 권한이 필요하다.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: storeId
 *         schema: { type: integer }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: provider
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50, maximum: 200 }
 *     responses:
 *       200: { description: 사용량 통계 }
 *       401: { description: 인증 필요 }
 *       403: { description: 권한 부족 }
 */
router.get(
  '/stats',
  authMiddleware,
  catchAsync(async (req, res) => {
    const storeId = req.query.storeId ? parseInt(req.query.storeId) : null;
    const isPlatformAdmin = req.user?.role === 'super_admin';

    // [보안] 매장 미지정 = 플랫폼 전체 집계 → super_admin 만 허용
    if (storeId === null) {
      if (!isPlatformAdmin) {
        return res.status(403).json({ error: '플랫폼 전체 통계는 관리자만 조회할 수 있습니다.' });
      }
    } else {
      if (Number.isNaN(storeId)) {
        return res.status(400).json({ error: '올바르지 않은 매장 ID입니다.' });
      }
      if (!isPlatformAdmin) {
        const role = await getStoreRole(req.user.id, storeId);
        if (!role) {
          return res.status(403).json({ error: '해당 매장에 대한 권한이 없습니다.' });
        }
      }
    }

    const { startDate, endDate, provider, limit } = req.query;
    const params = {
      startDate,
      endDate,
      provider,
      limit: Math.min(parseInt(limit) || 50, 200),
    };

    const { records, stats } = await aiUsageTracker.getUsageStats(storeId, params);

    const totalCost = stats._sum?.costUsd ? parseFloat(stats._sum.costUsd) : 0;
    const totalTokens = stats._sum?.totalTokens || 0;
    const totalCalls = stats._count?.id || 0;
    const avgDuration = stats._avg?.durationMs || 0;

    res.json({
      summary: {
        totalCalls,
        totalCostUSD: Math.round(totalCost * 10000) / 10000,
        totalTokens,
        avgDurationMs: Math.round(avgDuration * 100) / 100,
        period: { startDate, endDate },
      },
      records,
    });
  })
);

module.exports = router;
