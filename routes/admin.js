const express = require('express');
const router = express.Router();
const settlementController = require('../controllers/settlementController');
const storeSettingsController = require('../controllers/storeSettingsController');
const bulkSmsController = require('../controllers/bulkSmsController');
const platformController = require('../controllers/platformController');
const storeEnrichmentController = require('../controllers/storeEnrichmentController');
const storeLinkController = require('../controllers/storeLinkController');
const dynamicPricingController = require('../controllers/dynamicPricingController');
const customerSegmentationController = require('../controllers/customerSegmentationController');
const grantTemplateController = require('../controllers/grantTemplateController');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: 관리자 전용 API (정산, 설정, Bulk SMS)
 */

/**
 * @swagger
 * /api/admin/stores/{storeId}/settlements:
 *   get:
 *     tags: [Admin]
 *     summary: 정산 목록 조회
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 정산 목록 반환
 */
router.get(
  '/stores/:storeId/settlements',
  authMiddleware,
  checkStorePermission('stats:read'),
  settlementController.getStoreSettlements
);

/**
 * @swagger
 * /api/admin/stores/{storeId}/settlements/generate:
 *   post:
 *     tags: [Admin]
 *     summary: 정산 생성
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               period:
 *                 type: string
 *     responses:
 *       200:
 *         description: 정산 생성 완료
 */
router.post(
  '/stores/:storeId/settlements/generate',
  authMiddleware,
  checkStorePermission('admin'),
  settlementController.generateSettlement
);

/**
 * @swagger
 * /api/admin/stores/{storeId}/settlements/{id}/status:
 *   patch:
 *     tags: [Admin]
 *     summary: 정산 상태 변경
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: 상태 변경 완료
 */
router.patch(
  '/stores/:storeId/settlements/:id/status',
  authMiddleware,
  checkStorePermission('admin'),
  settlementController.updateStatus
);

/**
 * @swagger
 * /api/admin/stores/{storeId}/settlements/{id}/tax-invoice:
 *   post:
 *     tags: [Admin]
 *     summary: 세금계산서 발행
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 세금계산서 발행 완료
 */
router.post(
  '/stores/:storeId/settlements/:id/tax-invoice',
  authMiddleware,
  checkStorePermission('settings:write'),
  settlementController.issueTaxInvoice
);

/**
 * @swagger
 * /api/admin/stores/{storeId}/settlements/{id}:
 *   get:
 *     tags: [Admin]
 *     summary: 정산 상세 조회
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 정산 상세 반환
 */
router.get(
  '/stores/:storeId/settlements/:id',
  authMiddleware,
  checkStorePermission('stats:read'),
  settlementController.getSettlementDetails
);

/**
 * @swagger
 * /api/admin/stores/{storeId}/receipt-settings:
 *   get:
 *     tags: [Admin]
 *     summary: 영수증 설정 조회
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 영수증 설정 반환
 */
router.get(
  '/stores/:storeId/receipt-settings',
  authMiddleware,
  checkStorePermission('settings:read'),
  storeSettingsController.getReceiptSettings
);

/**
 * @swagger
 * /api/admin/stores/{storeId}/receipt-settings:
 *   put:
 *     tags: [Admin]
 *     summary: 영수증 설정 수정
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               template:
 *                 type: string
 *     responses:
 *       200:
 *         description: 영수증 설정 수정 완료
 */
router.put(
  '/stores/:storeId/receipt-settings',
  authMiddleware,
  checkStorePermission('settings:write'),
  storeSettingsController.updateReceiptSettings
);

/**
 * @swagger
 * /api/admin/stores/{storeId}/tier-settings:
 *   get:
 *     tags: [Admin]
 *     summary: 등급 설정 조회
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 등급 설정 반환
 */
router.get(
  '/stores/:storeId/tier-settings',
  authMiddleware,
  checkStorePermission('settings:read'),
  storeSettingsController.getTierSettings
);

/**
 * @swagger
 * /api/admin/stores/{storeId}/tier-settings:
 *   post:
 *     tags: [Admin]
 *     summary: 등급 설정 저장
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               threshold:
 *                 type: number
 *     responses:
 *       200:
 *         description: 등급 설정 저장 완료
 */
router.post(
  '/stores/:storeId/tier-settings',
  authMiddleware,
  checkStorePermission('settings:write'),
  storeSettingsController.upsertTierSetting
);

/**
 * @swagger
 * /api/admin/stores/{storeId}/tier-settings/{tierName}:
 *   delete:
 *     tags: [Admin]
 *     summary: 등급 설정 삭제
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: tierName
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 등급 설정 삭제 완료
 */
router.delete(
  '/stores/:storeId/tier-settings/:tierName',
  authMiddleware,
  checkStorePermission('settings:write'),
  storeSettingsController.deleteTierSetting
);

/**
 * @swagger
 * /api/admin/stores/{storeId}/commission:
 *   put:
 *     tags: [Admin]
 *     summary: 수수료율 설정 (최고관리자)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               commissionRate:
 *                 type: number
 *     responses:
 *       200:
 *         description: 수수료율 설정 완료
 */
router.put(
  '/stores/:storeId/commission',
  authMiddleware,
  checkStorePermission('admin'),
  storeSettingsController.updateCommission
);

/**
 * @swagger
 * /api/admin/bulk-sms/filter-options:
 *   get:
 *     tags: [Admin]
 *     summary: Bulk SMS 필터 옵션 조회
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 필터 옵션 반환
 */
router.get('/bulk-sms/filter-options', authMiddleware, bulkSmsController.getFilterOptions);

/**
 * @swagger
 * /api/admin/bulk-sms/customers:
 *   get:
 *     tags: [Admin]
 *     summary: Bulk SMS 대상 고객 조회
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: store_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: tier
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 대상 고객 목록 반환
 */
router.get('/bulk-sms/customers', authMiddleware, bulkSmsController.getFilteredCustomers);

/**
 * @swagger
 * /api/admin/bulk-sms/send:
 *   post:
 *     tags: [Admin]
 *     summary: Bulk SMS 발송
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message, recipients]
 *             properties:
 *               message:
 *                 type: string
 *               recipients:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: SMS 발송 완료
 */
router.post('/bulk-sms/send', authMiddleware, bulkSmsController.sendBulkSms);

// ── 플랫폼 대시보드 (super_admin) ──────────────────────────────────────────
router.get('/platform/overview', authMiddleware, adminOnly, platformController.getOverview);
router.get('/platform/stores', authMiddleware, adminOnly, platformController.getStores);
router.get('/platform/trend', authMiddleware, adminOnly, platformController.getTrend);
router.get(
  '/platform/stores/:id/detail',
  authMiddleware,
  adminOnly,
  platformController.getStoreDetail
);
router.patch(
  '/platform/stores/:id/active',
  authMiddleware,
  adminOnly,
  platformController.toggleActive
);
router.post(
  '/platform/stores/:id/points',
  authMiddleware,
  adminOnly,
  platformController.grantPoints
);
router.get(
  '/platform/enrichment/coverage',
  authMiddleware,
  adminOnly,
  platformController.getEnrichmentCoverage
);
router.get(
  '/platform/stores/:id/completion',
  authMiddleware,
  adminOnly,
  platformController.getStoreCompletion
);
router.post(
  '/platform/stores/:id/enhance',
  authMiddleware,
  adminOnly,
  platformController.runStoreEnhance
);
router.post(
  '/platform/stores/:id/enhance/apply',
  authMiddleware,
  adminOnly,
  platformController.applyStoreEnhance
);

// ── 매장 정보 보강 (super_admin) ──────────────────────────────────────────
router.get(
  '/enrichment-status',
  authMiddleware,
  adminOnly,
  storeEnrichmentController.enrichmentStatus
);
router.post('/enrich-stores', authMiddleware, adminOnly, storeEnrichmentController.enrichNaver);
router.post('/enrich-seoul', authMiddleware, adminOnly, storeEnrichmentController.enrichSeoul);
router.post('/geocode-stores', authMiddleware, adminOnly, storeEnrichmentController.geocodeStores);

// ── 매장 연동 승인 요청 (super_admin) ──────────────────────────────────────
router.get('/store-link-requests', authMiddleware, adminOnly, storeLinkController.listRequests);
router.post(
  '/store-link-requests/:id/approve',
  authMiddleware,
  adminOnly,
  storeLinkController.approveRequest
);
router.post(
  '/store-link-requests/:id/reject',
  authMiddleware,
  adminOnly,
  storeLinkController.rejectRequest
);

// ── AI 동적 가격 책정 ───────────────────────────────────────────────────────
/**
 * @swagger
 * /api/admin/stores/{storeId}/pricing/rules:
 *   get:
 *     tags: [Admin]
 *     summary: 동적 가격 책정 규칙 목록 조회
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 가격 규칙 목록 반환
 */
router.get(
  '/stores/:storeId/pricing/rules',
  authMiddleware,
  checkStorePermission('settings:read'),
  dynamicPricingController.getPricingRules
);

/**
 * @swagger
 * /api/admin/stores/{storeId}/pricing/rules:
 *   post:
 *     tags: [Admin]
 *     summary: 동적 가격 책정 규칙 생성
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, ruleName, ruleType, minPrice, maxPrice, basePrice]
 *             properties:
 *               productId: { type: integer }
 *               ruleName: { type: string }
 *               ruleType: { type: string, enum: [TIME_BASED, DEMAND_BASED, COMPETITOR_BASED, INVENTORY_BASED, WEATHER_BASED] }
 *               priority: { type: integer, default: 0 }
 *               config: { type: object }
 *               minPrice: { type: integer }
 *               maxPrice: { type: integer }
 *               basePrice: { type: integer }
 *     responses:
 *       201:
 *         description: 가격 규칙 생성됨
 */
router.post(
  '/stores/:storeId/pricing/rules',
  authMiddleware,
  checkStorePermission('settings:write'),
  dynamicPricingController.createPricingRule
);

/**
 * @swagger
 * /api/admin/stores/{storeId}/pricing/rules/{ruleId}:
 *   patch:
 *     tags: [Admin]
 *     summary: 동적 가격 책정 규칙 수정
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: ruleId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 가격 규칙 수정됨
 */
router.patch(
  '/stores/:storeId/pricing/rules/:ruleId',
  authMiddleware,
  checkStorePermission('settings:write'),
  dynamicPricingController.updatePricingRule
);

/**
 * @swagger
 * /api/admin/stores/{storeId}/pricing/rules/{ruleId}:
 *   delete:
 *     tags: [Admin]
 *     summary: 동적 가격 책정 규칙 삭제
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: ruleId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       204:
 *         description: 가격 규칙 삭제됨
 */
router.delete(
  '/stores/:storeId/pricing/rules/:ruleId',
  authMiddleware,
  checkStorePermission('settings:write'),
  dynamicPricingController.deletePricingRule
);

// 가격 변경 이력
router.get(
  '/stores/:storeId/pricing/logs',
  authMiddleware,
  checkStorePermission('stats:read'),
  dynamicPricingController.getPriceLogs
);

// 수동 가격 변경
router.post(
  '/stores/:storeId/pricing/manual',
  authMiddleware,
  checkStorePermission('settings:write'),
  dynamicPricingController.applyManualPriceChange
);

// 최적화 작업
router.post(
  '/stores/:storeId/pricing/optimize',
  authMiddleware,
  checkStorePermission('settings:write'),
  dynamicPricingController.runPricingOptimization
);
router.get(
  '/stores/:storeId/pricing/jobs',
  authMiddleware,
  checkStorePermission('stats:read'),
  dynamicPricingController.getOptimizationJobs
);

// 경쟁사 가격 관리
router.post(
  '/stores/:storeId/pricing/competitors',
  authMiddleware,
  checkStorePermission('settings:write'),
  dynamicPricingController.upsertCompetitorPrice
);
router.get(
  '/stores/:storeId/pricing/competitors',
  authMiddleware,
  checkStorePermission('stats:read'),
  dynamicPricingController.getCompetitorPrices
);

// 수요 예측
router.get(
  '/stores/:storeId/pricing/forecasts',
  authMiddleware,
  checkStorePermission('stats:read'),
  dynamicPricingController.getDemandForecasts
);

// ── 포인트/쿠폰 발급 템플릿 ─────────────────────────────────────
router.get(
  '/stores/:storeId/grant-templates',
  authMiddleware,
  checkStorePermission('settings:read'),
  grantTemplateController.list
);
router.post(
  '/stores/:storeId/grant-templates',
  authMiddleware,
  checkStorePermission('settings:write'),
  grantTemplateController.create
);
router.patch('/grant-templates/:id', authMiddleware, adminOnly, grantTemplateController.update);
router.delete('/grant-templates/:id', authMiddleware, adminOnly, grantTemplateController.delete);

// ── 고객 세그멘테이션 및 개인화 ──────────────────────────────────
router.get(
  '/stores/:storeId/segments',
  authMiddleware,
  checkStorePermission('stats:read'),
  customerSegmentationController.getSegments
);
router.post(
  '/stores/:storeId/segments',
  authMiddleware,
  checkStorePermission('settings:write'),
  customerSegmentationController.upsertSegment
);
router.delete(
  '/stores/:storeId/segments/:segmentId',
  authMiddleware,
  checkStorePermission('settings:write'),
  customerSegmentationController.deleteSegment
);
router.get(
  '/stores/:storeId/personalization',
  authMiddleware,
  checkStorePermission('stats:read'),
  customerSegmentationController.getPersonalization
);
router.put(
  '/stores/:storeId/personalization',
  authMiddleware,
  checkStorePermission('settings:write'),
  customerSegmentationController.upsertPersonalization
);
router.get(
  '/stores/:storeId/recommendations',
  authMiddleware,
  checkStorePermission('stats:read'),
  customerSegmentationController.getRecommendations
);
router.post(
  '/stores/:storeId/recommendations',
  authMiddleware,
  checkStorePermission('settings:write'),
  customerSegmentationController.createRecommendation
);
router.get(
  '/stores/:storeId/segments/:segmentId/recommendations',
  authMiddleware,
  checkStorePermission('stats:read'),
  customerSegmentationController.getRecommendationsBySegment
);
router.get(
  '/stores/:storeId/segments/:segmentId/customers',
  authMiddleware,
  checkStorePermission('stats:read'),
  customerSegmentationController.getSegmentCustomers
);
router.get(
  '/stores/:storeId/personalization-analytics',
  authMiddleware,
  checkStorePermission('stats:read'),
  customerSegmentationController.getAnalytics
);

module.exports = router;
