const express = require('express');
const router = express.Router();
const printJobsController = require('../controllers/printJobsController');

/**
 * @swagger
 * tags:
 *   name: PrintJobs
 *   description: 주방 프린트 작업 관리 API
 */

/**
 * @swagger
 * /api/print-jobs/pending:
 *   get:
 *     tags: [PrintJobs]
 *     summary: 미처리 프린트 작업 목록 조회
 *     responses:
 *       200:
 *         description: 미처리 작업 목록
 */
router.get('/pending', printJobsController.getPending);

/**
 * @swagger
 * /api/print-jobs/store/{storeId}:
 *   get:
 *     tags: [PrintJobs]
 *     summary: 매장별 미처리 프린트 작업 조회
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 매장별 미처리 작업 목록
 */
router.get('/store/:storeId', printJobsController.getPending);

/**
 * @swagger
 * /api/print-jobs/{jobId}/claim:
 *   patch:
 *     tags: [PrintJobs]
 *     summary: 프린트 작업 점유 (인쇄기 클라이언트)
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 작업 점유 완료
 */
router.patch('/:jobId/claim', printJobsController.claim);

/**
 * @swagger
 * /api/print-jobs/{jobId}/complete:
 *   patch:
 *     tags: [PrintJobs]
 *     summary: 프린트 작업 완료 처리
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 작업 완료
 */
router.patch('/:jobId/complete', printJobsController.complete);

/**
 * @swagger
 * /api/print-jobs/{jobId}/fail:
 *   patch:
 *     tags: [PrintJobs]
 *     summary: 프린트 작업 실패 처리
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
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: 작업 실패 처리
 */
router.patch('/:jobId/fail', printJobsController.fail);

module.exports = router;
