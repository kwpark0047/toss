const express = require('express');
const router = express.Router();
const reportPdfController = require('../controllers/reportPdfController');
const authMiddleware = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');

/**
 * @swagger
 * /api/reports/store/{storeId}:
 *   get:
 *     tags: [Reports]
 *     summary: 매장 매출 리포트 PDF 생성 및 다운로드
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: PDF 파일 다운로드
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get(
  '/store/:storeId',
  authMiddleware,
  checkStorePermission('stats:read'),
  reportPdfController.generateStoreReport
);

/**
 * @swagger
 * /api/reports/all:
 *   get:
 *     tags: [Reports]
 *     summary: 전체 매장 리포트 일괄 생성 (슈퍼어드민)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: 생성 결과
 */
router.get('/all', authMiddleware, reportPdfController.generateAllStoreReports);

/**
 * @swagger
 * /api/reports/templates:
 *   get:
 *     tags: [Reports]
 *     summary: 리포트 템플릿 목록
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 템플릿 목록
 */
router.get('/templates', authMiddleware, reportPdfController.getTemplates);

module.exports = router;
