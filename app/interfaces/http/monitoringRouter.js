/**
 * Monitoring Router (Clean Architecture 버전) - 인터페이스 계층
 *
 * DI 컨테이너에서 컨트롤러를 해석하여 라우트를 등록합니다.
 * 기존 routes/monitoring.js의 Swagger 문서와 엔드포인트를 보존합니다.
 *
 * [보안] 이 라우터는 플랫폼 전체 매장 수·가입자 수·당일 총매출·서버 리소스를
 * 노출한다. 과거 무인증으로 공개되어 있었으므로(H-1) 반드시
 * 인증 + super_admin 권한을 요구한다.
 */

const express = require('express');
const router = express.Router();
const createMonitoringController = require('../http/MonitoringController');
const authMiddleware = require('../../../middleware/auth');
const { adminOnly } = require('../../../middleware/auth');

// 전 라우트 공통: 로그인 + 플랫폼 관리자 권한
router.use(authMiddleware, adminOnly);

/**
 * @swagger
 * tags:
 *   name: Monitoring
 *   description: 시스템 모니터링 및 성능 메트릭 (Clean Architecture, super_admin 전용)
 */

/**
 * @swagger
 * /api/monitoring/stats:
 *   get:
 *     tags: [Monitoring]
 *     summary: 시스템 통합 메트릭 (플랫폼 집계 + 성능 + 서버 리소스)
 *     description: Clean Architecture DI 컨테이너 기반. super_admin 권한 필요.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 통합 메트릭
 *       401:
 *         description: 인증 필요
 *       403:
 *         description: 관리자 권한 필요
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
 *     description: super_admin 권한 필요.
 *     security:
 *       - bearerAuth: []
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
 *       401:
 *         description: 인증 필요
 *       403:
 *         description: 관리자 권한 필요
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
