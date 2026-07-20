const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const planRequestsController = require('../controllers/planRequestsController');

/**
 * @swagger
 * tags:
 *   name: PlanRequests
 *   description: 플랜 업그레이드 신청 관리 API
 */

/**
 * @swagger
 * /api/plan-requests:
 *   post:
 *     tags: [PlanRequests]
 *     summary: 플랜 업그레이드 신청
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: 신청 완료
 */
router.post('/', authMiddleware, planRequestsController.createRequest);

/**
 * @swagger
 * /api/plan-requests/store/{storeId}:
 *   get:
 *     tags: [PlanRequests]
 *     summary: 내 매장의 신청 내역 조회
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
 *         description: 매장별 신청 목록
 */
router.get('/store/:storeId', authMiddleware, planRequestsController.getStoreRequests);

/**
 * @swagger
 * /api/plan-requests:
 *   get:
 *     tags: [PlanRequests]
 *     summary: 전체 신청 목록 조회 (super_admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 전체 신청 목록
 */
router.get('/', authMiddleware, planRequestsController.getAllRequests);

/**
 * @swagger
 * /api/plan-requests/pending-count:
 *   get:
 *     tags: [PlanRequests]
 *     summary: 대기 중인 신청 수 조회 (super_admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 대기 건수
 */
router.get('/pending-count', authMiddleware, planRequestsController.getPendingCount);

/**
 * @swagger
 * /api/plan-requests/{id}/approve:
 *   post:
 *     tags: [PlanRequests]
 *     summary: 신청 승인 (super_admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 승인 완료
 */
router.post('/:id/approve', authMiddleware, planRequestsController.approveRequest);

/**
 * @swagger
 * /api/plan-requests/{id}/reject:
 *   post:
 *     tags: [PlanRequests]
 *     summary: 신청 거절 (super_admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *         description: 거절 완료
 */
router.post('/:id/reject', authMiddleware, planRequestsController.rejectRequest);

module.exports = router;
