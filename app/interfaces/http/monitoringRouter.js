/**
 * Monitoring Router (Clean Architecture 버전) - 인터페이스 계층
 *
 * DI 컨테이너에서 컨트롤러를 해석하여 라우트를 등록합니다.
 * 기존 routes/monitoring.js의 Swagger 문서와 엔드포인트를 보존합니다.
 */

const express = require('express');
const router = express.Router();
const createMonitoringController = require('../http/MonitoringController');

/**
 * @swagger
 * tags:
 *   name: Monitoring
 *   description: 시스템 모니터링 및 성능 메트릭 (Clean Architecture)
 */

/**
 * @swagger
 * /api/monitoring/stats:
 *   get:
 *     tags: [Monitoring]
 *     summary: 시스템 통합 메트릭 (플랫폼 집계 + 성능 + 서버 리소스)
 *     description: Clean Architecture DI 컨테이너 기반
 *     responses:
 *       200:
 *         description: 통합 메트릭
 */
router.get('/stats', (req, res, next) => {
  const controller = req.container
    ? req.container.build(createMonitoringController)
    : createMonitoringController({
        getSystemStats: req.app.get('diContainer')?.getSystemStats,
        getErrorSummary: req.app.get('diContainer')?.getErrorSummary,
      });
  controller.getSystemStats(req, res, next);
});

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
router.get('/errors', (req, res, next) => {
  const controller = req.container
    ? req.container.build(createMonitoringController)
    : createMonitoringController({
        getSystemStats: req.app.get('diContainer')?.getSystemStats,
        getErrorSummary: req.app.get('diContainer')?.getErrorSummary,
      });
  controller.getErrorSummary(req, res, next);
});

module.exports = router;
