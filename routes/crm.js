const express = require('express');
const router = express.Router();
const crmController = require('../controllers/crmController');
const { authMiddleware } = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');

/**
 * @swagger
 * tags:
 *   name: CRM
 *   description: 고객 관계 관리 및 AI 마케팅 API
 */

/**
 * @swagger
 * /api/crm/store/{storeId}/analysis:
 *   get:
 *     tags: [CRM]
 *     summary: 매장 전체 고객 RFM 분석
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
 *         description: RFM 세그먼트 분석 결과 (Champions, Loyal, At_Risk, Lost, New, General)
 */
router.get('/store/:storeId/analysis', 
  authMiddleware, 
  checkStorePermission('stats:read'), 
  crmController.getCustomerAnalysis
);

/**
 * @swagger
 * /api/crm/store/{storeId}/segment/{segmentName}:
 *   get:
 *     tags: [CRM]
 *     summary: 특정 세그먼트별 고객 목록 조회
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: segmentName
 *         required: true
 *         schema:
 *           type: string
 *           enum: [Champions, Loyal, At_Risk, Lost, New, General]
 *     responses:
 *       200:
 *         description: 세그먼트별 고객 목록
 */
router.get('/store/:storeId/segment/:segmentName', 
  authMiddleware, 
  checkStorePermission('stats:read'), 
  crmController.getSegmentCustomers
);

/**
 * @swagger
 * /api/crm/store/{storeId}/send-smart-sms:
 *   post:
 *     tags: [CRM]
 *     summary: AI 스마트 마케팅 SMS 발송
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
 *             required: [segmentName]
 *             properties:
 *               segmentName:
 *                 type: string
 *                 enum: [Champions, Loyal, At_Risk, Lost, New, General]
 *               customMessage:
 *                 type: string
 *     responses:
 *       200:
 *         description: SMS 발송 결과
 *       400:
 *         description: segmentName 필요
 *       404:
 *         description: 매장 없음
 */
router.post('/store/:storeId/send-smart-sms', 
  authMiddleware, 
  checkStorePermission('settings:write'), 
  crmController.sendSmartMarketingSms
);

module.exports = router;
