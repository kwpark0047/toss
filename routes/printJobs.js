const express = require('express');
const router = express.Router();
const printJobsController = require('../controllers/printJobsController');
const { apiKeyAuth, requireScope } = require('../middleware/apiKeyAuth');

/**
 * @swagger
 * tags:
 *   name: PrintJobs
 *   description: |
 *     주방 프린트 작업 관리 API (프린트 에이전트 전용).
 *     모든 엔드포인트는 매장 API 키 인증(`Authorization: Bearer wm_live_...`
 *     또는 `X-API-Key`)이 필수이며, 대상 매장은 **API 키에 바인딩된 store_id로만**
 *     결정된다. 클라이언트가 보낸 store_id 파라미터는 신뢰하지 않는다.
 */

// ── 전 라우트 공통: API 키 인증 (req.apiClient.storeId 주입) ────────────────
router.use(apiKeyAuth);

/**
 * @swagger
 * /api/print-jobs/pending:
 *   get:
 *     tags: [PrintJobs]
 *     summary: 미처리 프린트 작업 목록 조회 (API 키 매장 기준)
 *     security:
 *       - apiKey: []
 *     responses:
 *       200:
 *         description: 미처리 작업 목록
 *       401:
 *         description: API 키 누락/무효
 */
router.get('/pending', printJobsController.getPending);

/**
 * @swagger
 * /api/print-jobs/store/{storeId}:
 *   get:
 *     tags: [PrintJobs]
 *     deprecated: true
 *     summary: (하위호환) 매장별 미처리 작업 조회 — storeId는 무시되고 API 키 매장이 사용된다
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 미처리 작업 목록
 *       403:
 *         description: API 키 매장과 요청 매장 불일치
 */
router.get('/store/:storeId', printJobsController.getPending);

/**
 * @swagger
 * /api/print-jobs/{jobId}/claim:
 *   patch:
 *     tags: [PrintJobs]
 *     summary: 프린트 작업 점유 (인쇄기 클라이언트)
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 작업 점유 완료
 *       403:
 *         description: write 스코프 필요
 *       409:
 *         description: 이미 처리 중이거나 완료된 작업
 */
router.patch('/:jobId/claim', requireScope('write'), printJobsController.claim);

/**
 * @swagger
 * /api/print-jobs/{jobId}/complete:
 *   patch:
 *     tags: [PrintJobs]
 *     summary: 프린트 작업 완료 처리
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 작업 완료
 *       403:
 *         description: write 스코프 필요
 */
router.patch('/:jobId/complete', requireScope('write'), printJobsController.complete);

/**
 * @swagger
 * /api/print-jobs/{jobId}/fail:
 *   patch:
 *     tags: [PrintJobs]
 *     summary: 프린트 작업 실패 처리 (3회 초과 시 failed 확정)
 *     security:
 *       - apiKey: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               error:
 *                 type: string
 *     responses:
 *       200:
 *         description: 작업 실패 처리
 *       403:
 *         description: write 스코프 필요
 */
router.patch('/:jobId/fail', requireScope('write'), printJobsController.fail);

module.exports = router;
