const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');
const {
    exportSalesExcel,
    exportOrdersExcel,
    exportCustomersExcel,
    exportMenuExcel,
    exportReportPdf,
} = require('../controllers/exportController');

/**
 * @swagger
 * tags:
 *   name: Export
 *   description: 데이터 내보내기 API (Excel/PDF)
 */

/**
 * @swagger
 * /api/export/store/{storeId}/excel/sales:
 *   get:
 *     tags: [Export]
 *     summary: 매출 통계 Excel 내보내기 (일별/시간대별/요일별/결제수단별 4개 시트)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *         description: "YYYY-MM-DD (기본 최근 30일)"
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Excel 파일 다운로드
 */
router.get('/store/:storeId/excel/sales',
    authMiddleware,
    checkStorePermission('stats:read'),
    exportSalesExcel
);

/**
 * @swagger
 * /api/export/store/{storeId}/excel/orders:
 *   get:
 *     tags: [Export]
 *     summary: 주문 내역 Excel 내보내기
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Excel 파일 다운로드
 */
router.get('/store/:storeId/excel/orders',
    authMiddleware,
    checkStorePermission('stats:read'),
    exportOrdersExcel
);

/**
 * @swagger
 * /api/export/store/{storeId}/excel/customers:
 *   get:
 *     tags: [Export]
 *     summary: 단골 고객 리스트 Excel 내보내기
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Excel 파일 다운로드
 */
router.get('/store/:storeId/excel/customers',
    authMiddleware,
    checkStorePermission('stats:read'),
    exportCustomersExcel
);

/**
 * @swagger
 * /api/export/store/{storeId}/excel/menu:
 *   get:
 *     tags: [Export]
 *     summary: 메뉴 판매 분석 Excel 내보내기 (ABC 등급)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Excel 파일 다운로드
 */
router.get('/store/:storeId/excel/menu',
    authMiddleware,
    checkStorePermission('stats:read'),
    exportMenuExcel
);

/**
 * @swagger
 * /api/export/store/{storeId}/pdf/report:
 *   get:
 *     tags: [Export]
 *     summary: 종합 보고서 PDF 내보내기
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: PDF 파일 다운로드
 */
router.get('/store/:storeId/pdf/report',
    authMiddleware,
    checkStorePermission('stats:read'),
    exportReportPdf
);

module.exports = router;
