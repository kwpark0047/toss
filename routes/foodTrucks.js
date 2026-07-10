const express = require('express');
const router = express.Router();
const foodTruckController = require('../controllers/foodTruckController');
const authMiddleware = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');

// ── 공개 API (Public Client Endpoints) ──────────────────────────────────────

// 현재 영업 중인 모든 활성 푸드트럭 지도 조회 (메인 지도 뷰용)
router.get('/active', foodTruckController.getActiveFoodTrucks);


// ── 관리자 전용 API (Store Owner / Manager Endpoints) ──────────────────────────

// 푸드트럭 개별 실시간 상태 조회
router.get('/stores/:storeId', authMiddleware, checkStorePermission('settings:read'), foodTruckController.getFoodTruckStatus);

// 실시간 GPS 좌표 갱신 (단말기 백그라운드 GPS 연동)
router.post('/stores/:storeId/gps', authMiddleware, checkStorePermission('settings:update'), foodTruckController.updateLocation);

// 이동식 현장 영업 활성화/종료 세션 전환
router.post('/stores/:storeId/session', authMiddleware, checkStorePermission('settings:update'), foodTruckController.toggleSession);

// 긴급 재료소진 비상 마감 일시품절 차단막 제어
router.post('/stores/:storeId/emergency-soldout', authMiddleware, checkStorePermission('settings:update'), foodTruckController.toggleEmergencySoldOut);

router.post('/stores/:storeId/ingredient-sold-out', authMiddleware, checkStorePermission('settings:update'), foodTruckController.ingredientSoldOut);

// 위치 기반 타임세일 전송 (Scenario D)
router.post('/stores/:storeId/flash-sale', authMiddleware, checkStorePermission('settings:update'), foodTruckController.triggerFlashSale);

// 오프라인IndexedDB 동기화 일괄 트랜잭션 수신 (Scenario E)
router.post('/stores/:storeId/offline-sync', authMiddleware, checkStorePermission('settings:update'), foodTruckController.processOfflineSync);

// 지능형 피크타임 및 거점별 판매 통계 감정/동향 분석 보고서 조회 (Step 2)
router.get('/stores/:storeId/analytics', authMiddleware, checkStorePermission('settings:read'), foodTruckController.getAnalytics);

module.exports = router;
