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
 * [내보내기 API]
 * 모든 엔드포인트는 stats:read 권한 필요
 * query: start_date, end_date (YYYY-MM-DD, 기본 최근 30일)
 */

// ── Excel ─────────────────────────────────────────────────────────────────────
// 매출 통계 (일별/시간대별/요일별/결제수단별 4개 시트)
router.get('/store/:storeId/excel/sales',
    authMiddleware,
    checkStorePermission('stats:read'),
    exportSalesExcel
);

// 주문 내역 전체
router.get('/store/:storeId/excel/orders',
    authMiddleware,
    checkStorePermission('stats:read'),
    exportOrdersExcel
);

// 단골 고객 리스트
router.get('/store/:storeId/excel/customers',
    authMiddleware,
    checkStorePermission('stats:read'),
    exportCustomersExcel
);

// 메뉴 판매 분석 (ABC 등급)
router.get('/store/:storeId/excel/menu',
    authMiddleware,
    checkStorePermission('stats:read'),
    exportMenuExcel
);

// ── PDF ───────────────────────────────────────────────────────────────────────
// 종합 보고서
router.get('/store/:storeId/pdf/report',
    authMiddleware,
    checkStorePermission('stats:read'),
    exportReportPdf
);

module.exports = router;
