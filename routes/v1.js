/**
 * v1.js — WeMarket Open API v1 (외부 개발자용)
 *
 * 인증: X-API-Key (또는 Bearer wm_live_...). 모든 응답은 API 키에 묶인 매장으로
 * 자동 스코프된다(멀티테넌트 격리). 읽기는 read, 주문 생성은 write 스코프 필요.
 *
 * 표준 응답: { data, meta } / 오류: { error, message }
 */
const router = require('express').Router();
const v1Controller = require('../controllers/v1Controller');
const { apiKeyAuth, requireScope } = require('../middleware/apiKeyAuth');

// 모든 v1 라우트 API 키 필수 (멀티테넌트 키 격리)
router.use(apiKeyAuth); 

// ── 매장 정보 조회 (read) ──────────────────────────
router.get('/store', v1Controller.getStore);

// ── 메뉴 목록 조회 (read) ──────────────────────────
router.get('/menus', v1Controller.getMenus);

// ── 주문 내역 검색 (read) ──────────────────────────
router.get('/orders', v1Controller.getOrders);

// ── 단일 주문 상세 조회 (read) ─────────────────────
router.get('/orders/:id', v1Controller.getOrderById);

// ── 외부 신규 주문 생성 (write 스코프 필수) ──────────
router.post('/orders', requireScope('write'), v1Controller.createOrder);

// ── 기간 매출 분석 통계 조회 (read) ─────────────────
router.get('/analytics/summary', v1Controller.getAnalyticsSummary);

// ── 주방 프린트 잡 점유 조회 (write 스코프 필수) ──────
router.post('/print/jobs/claim', requireScope('write'), v1Controller.claimPrintJobs);

// ── 인쇄 피드백 수신 및 상태 갱신 (write 스코프 필수) ──
router.post('/print/jobs/:id/ack', requireScope('write'), v1Controller.ackPrintJob);

module.exports = router;
