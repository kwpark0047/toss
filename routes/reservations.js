const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { checkStorePermissionForObject } = require('../middleware/storeAuth');
const { requireReservationCustomerCapability } = require('../middleware/orderCapability');
const reservationsController = require('../controllers/reservationsController');

/**
 * @swagger
 * tags:
 *   name: Reservations
 *   description: 예약 관리 API
 */

/**
 * @swagger
 * /api/reservations/register:
 *   post:
 *     tags: [Reservations]
 *     summary: 예약 등록 (고객)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [storeId, name, phone, date, time, partySize]
 *             properties:
 *               storeId:
 *                 type: integer
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date
 *               time:
 *                 type: string
 *               partySize:
 *                 type: integer
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: 예약 등록 완료
 */
router.post('/register', reservationsController.register);

/**
 * @swagger
 * /api/reservations/store/{storeId}:
 *   get:
 *     tags: [Reservations]
 *     summary: 매장 예약 목록 조회 (관리자)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, cancelled, completed]
 *     responses:
 *       200:
 *         description: 예약 목록
 */
router.get('/store/:storeId', authMiddleware, reservationsController.getStoreReservations);

/**
 * @swagger
 * /api/reservations/{id}/status:
 *   patch:
 *     tags: [Reservations]
 *     summary: 예약 상태 변경 (관리자)
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [confirmed, cancelled, completed]
 *     responses:
 *       200:
 *         description: 상태 변경 완료
 */
router.patch(
  '/:id/status',
  authMiddleware,
  checkStorePermissionForObject('reservations'),
  reservationsController.updateStatus
);

/**
 * @swagger
 * /api/reservations/my/{phone}:
 *   get:
 *     tags: [Reservations]
 *     summary: 내 예약 상태 조회 (전화번호 기반)
 *     parameters:
 *       - in: path
 *         name: phone
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 예약 목록
 */
router.get('/my', requireReservationCustomerCapability, reservationsController.getMyReservations);

/**
 * @swagger
 * /api/reservations/my/{phone}:
 *   get:
 *     tags: [Reservations]
 *     summary: 내 예약 상태 조회 (전화번호 기반)
 *     parameters:
 *       - in: path
 *         name: phone
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 예약 목록
 */
router.get(
  '/my/:phone',
  requireReservationCustomerCapability,
  reservationsController.getMyReservations
);

/**
 * @swagger
 * /api/reservations/{id}/cancel:
 *   patch:
 *     tags: [Reservations]
 *     summary: 고객 본인 예약 취소
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 예약 취소 완료
 */
router.patch(
  '/:id/cancel',
  requireReservationCustomerCapability,
  reservationsController.cancelReservation
);

module.exports = router;
