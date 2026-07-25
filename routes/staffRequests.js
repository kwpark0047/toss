const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const staffRequestsController = require('../controllers/staffRequestsController');

/**
 * @swagger
 * tags:
 *   name: StaffRequests
 *   description: 직원 역할 신청 관리 API
 */

/**
 * @swagger
 * /api/staff-requests:
 *   post:
 *     tags: [StaffRequests]
 *     summary: 역할 계정 신청
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
router.post('/', authMiddleware, staffRequestsController.createRequest);

/**
 * @swagger
 * /api/staff-requests/store/{storeId}:
 *   get:
 *     tags: [StaffRequests]
 *     summary: 매장별 신청 내역 조회
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
router.get('/store/:storeId', authMiddleware, staffRequestsController.getStoreRequests);

/**
 * @swagger
 * /api/staff-requests:
 *   get:
 *     tags: [StaffRequests]
 *     summary: 전체 신청 목록 조회 (super_admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 전체 신청 목록
 */
router.get('/', authMiddleware, staffRequestsController.getAllRequests);

/**
 * @swagger
 * /api/staff-requests/pending-count:
 *   get:
 *     tags: [StaffRequests]
 *     summary: 대기 중인 신청 수 조회 (super_admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 대기 건수
 */
router.get('/pending-count', authMiddleware, staffRequestsController.getPendingCount);

/**
 * @swagger
 * /api/staff-requests/{id}/approve:
 *   post:
 *     tags: [StaffRequests]
 *     summary: 신청 승인
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
router.post('/:id/approve', authMiddleware, staffRequestsController.approveRequest);

/**
 * @swagger
 * /api/staff-requests/{id}/reject:
 *   post:
 *     tags: [StaffRequests]
 *     summary: 신청 거절
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
router.post('/:id/reject', authMiddleware, staffRequestsController.rejectRequest);

module.exports = router;
