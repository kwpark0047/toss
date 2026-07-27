const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');
const catchAsync = require('../utils/catchAsync');
const storeInfoEnhancementController = require('../controllers/storeInfoEnhancementController');

/**
 * @swagger
 * tags:
 *   name: StoreInfoEnhancement
 *   description: 매장 정보 보강 및 자동 완성 API
 */

/**
 * @swagger
 * /api/store-info-enhancement/{storeId}/enhance:
 *   post:
 *     tags: [StoreInfoEnhancement]
 *     summary: 매장 정보 AI 보강 및 자동 완성
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: autoSave
 *         schema:
 *           type: boolean
 *           default: false
 *         description: 자동 저장 여부
 *     responses:
 *       200:
 *         description: 보강 결과
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 originalCompletion:
 *                   type: integer
 *                 newCompletion:
 *                   type: integer
 *                 enhancements:
 *                   type: object
 *                 suggestions:
 *                   type: array
 *                   items:
 *                     type: string
 *                 missingFields:
 *                   type: object
 *                 isLegalComplete:
 *                   type: boolean
 *                 canOperate:
 *                   type: boolean
 */
router.post('/:storeId/enhance',
  authMiddleware,
  checkStorePermission('store:update'),
  catchAsync(storeInfoEnhancementController.enhanceStoreInfo)
);

/**
 * @swagger
 * /api/store-info-enhancement/{storeId}/report:
 *   get:
 *     tags: [StoreInfoEnhancement]
 *     summary: 매장 정보 완성도 리포트 조회
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
 *         description: 완성도 리포트
 */
router.get('/:storeId/report',
  authMiddleware,
  checkStorePermission('store:read'),
  catchAsync(storeInfoEnhancementController.getCompletionReport)
);

/**
 * @swagger
 * /api/store-info-enhancement/{storeId}/legal-fields:
 *   post:
 *     tags: [StoreInfoEnhancement]
 *     summary: 법적 필수 필드 AI 자동 생성
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
 *         description: 생성된 필드
 */
router.post('/:storeId/legal-fields',
  authMiddleware,
  checkStorePermission('store:update'),
  catchAsync(storeInfoEnhancementController.generateLegalFields)
);

/**
 * @swagger
 * /api/store-info-enhancement/{storeId}/business-hours:
 *   post:
 *     tags: [StoreInfoEnhancement]
 *     summary: 영업시간 자동 생성 (업종 기반)
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
 *         description: 생성된 영업시간
 */
router.post('/:storeId/business-hours',
  authMiddleware,
  checkStorePermission('store:update'),
  catchAsync(storeInfoEnhancementController.generateBusinessHours)
);

/**
 * @swagger
 * /api/store-info-enhancement/{storeId}/classify:
 *   post:
 *     tags: [StoreInfoEnhancement]
 *     summary: 업종 자동 분류
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
 *         description: 분류된 업종
 */
router.post('/:storeId/classify',
  authMiddleware,
  checkStorePermission('store:update'),
  catchAsync(storeInfoEnhancementController.classifyBusinessType)
);

/**
 * @swagger
 * /api/store-info-enhancement/{storeId}/description:
 *   post:
 *     tags: [StoreInfoEnhancement]
 *     summary: 매장 설명 자동 생성
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
 *         description: 생성된 설명
 */
router.post('/:storeId/description',
  authMiddleware,
  checkStorePermission('store:update'),
  catchAsync(storeInfoEnhancementController.generateDescription)
);

/**
 * @swagger
 * /api/store-info-enhancement/{storeId}/service-suggestions:
 *   get:
 *     tags: [StoreInfoEnhancement]
 *     summary: 업종 기반 서비스/메뉴 제안
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
 *         description: 제안된 서비스/메뉴 목록
 */
router.get('/:storeId/service-suggestions',
  authMiddleware,
  checkStorePermission('store:read'),
  catchAsync(storeInfoEnhancementController.getServiceSuggestions)
);

module.exports = router;
