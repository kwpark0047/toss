const express = require('express');
const router = express.Router();
const monitoringController = require('../controllers/monitoringController');

/**
 * @swagger
 * tags:
 *   name: Monitoring
 *   description: 시스템 모니터링 및 성능 메트릭
 */

/**
 * @swagger
 * /api/monitoring/stats:
 *   get:
 *     tags: [Monitoring]
 *     summary: 시스템 통합 메트릭 (플랫폼 집계 + 성능 + 서버 리소스)
 *     responses:
 *       200:
 *         description: 통합 메트릭
 */
router.get('/stats', monitoringController.getSystemStats);

/**
 * @swagger
 * /api/monitoring/errors:
 *   get:
 *     tags: [Monitoring]
 *     summary: 최근 에러 요약 (지정 시간 내 에러 집계)
 *     parameters:
 *       - in: query
 *         name: hours
 *         schema:
 *           type: integer
 *           default: 24
 *         description: 조회 기간 (시간)
 *     responses:
 *       200:
 *         description: 에러 요약
 */
router.get('/errors', monitoringController.getErrorSummary);

module.exports = router;
