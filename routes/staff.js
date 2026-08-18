const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');
const catchAsync = require('../utils/catchAsync');
const staffController = require('../controllers/staffController');
const prisma = require('../config/prisma');
const { checkResourcePermission } = require('../middleware/storeAuth');

const checkStaffPermission = checkResourcePermission(
  prisma.staff,
  'id',
  'store_id',
  'staff:manage'
);

/**
 * @swagger
 * tags:
 *   name: Staff
 *   description: 직원 관리/근태/근무표 API
 */

/**
 * @swagger
 * /api/staff/store/{storeId}/role:
 *   get:
 *     tags: [Staff]
 *     summary: 내 권한 조회
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
 *         description: 내 역할 정보
 */
router.get('/store/:storeId/role', authMiddleware, catchAsync(staffController.getMyRole));

/**
 * @swagger
 * /api/staff/store/{storeId}:
 *   get:
 *     tags: [Staff]
 *     summary: 매장 직원 목록 조회
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
 *         description: 직원 목록
 */
router.get(
  '/store/:storeId',
  authMiddleware,
  checkStorePermission('staff:manage'),
  catchAsync(staffController.getStaffList)
);

/**
 * @swagger
 * /api/staff/self-register:
 *   post:
 *     tags: [Staff]
 *     summary: 오너 셀프 근태 등록
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 근태 등록 완료
 */
router.post('/self-register', authMiddleware, catchAsync(staffController.selfRegister));

/**
 * @swagger
 * /api/staff:
 *   post:
 *     tags: [Staff]
 *     summary: 직원 직접 생성
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
 *         description: 직원 생성 완료
 */
router.post('/', authMiddleware, catchAsync(staffController.createStaff));

/**
 * @swagger
 * /api/staff/store/{storeId}/attendance:
 *   get:
 *     tags: [Staff]
 *     summary: 매장 근태 조회
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
 *         description: 근태 기록 목록
 */
router.get(
  '/store/:storeId/attendance',
  authMiddleware,
  checkStorePermission('order:read'),
  catchAsync(staffController.getAttendance)
);

/**
 * @swagger
 * /api/staff/{id}/clock-in:
 *   post:
 *     tags: [Staff]
 *     summary: 출근 처리
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
 *         description: 출근 완료
 */
router.post('/:id/clock-in', authMiddleware, catchAsync(staffController.clockIn));

/**
 * @swagger
 * /api/staff/{id}/clock-out:
 *   post:
 *     tags: [Staff]
 *     summary: 퇴근 처리
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
 *         description: 퇴근 완료
 */
router.post('/:id/clock-out', authMiddleware, catchAsync(staffController.clockOut));

/**
 * @swagger
 * /api/staff/{id}:
 *   put:
 *     tags: [Staff]
 *     summary: 직원 역할 수정
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
 *     responses:
 *       200:
 *         description: 수정 완료
 */
router.put(
  '/:id',
  authMiddleware,
  checkStaffPermission,
  catchAsync(staffController.updateStaffRole)
);

/**
 * @swagger
 * /api/staff/{id}:
 *   delete:
 *     tags: [Staff]
 *     summary: 직원 삭제
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
 *         description: 삭제 완료
 */
router.delete(
  '/:id',
  authMiddleware,
  checkStaffPermission,
  catchAsync(staffController.deleteStaff)
);

/**
 * @swagger
 * /api/staff/lookup-user:
 *   get:
 *     tags: [Staff]
 *     summary: 휴대폰 번호로 기존 사용자 조회
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: phone
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 사용자 정보
 */
router.get('/lookup-user', authMiddleware, catchAsync(staffController.lookupUser));

/**
 * @swagger
 * /api/staff/add-existing:
 *   post:
 *     tags: [Staff]
 *     summary: 기존 사용자를 직원으로 추가
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: 직원 추가 완료
 */
router.post('/add-existing', authMiddleware, catchAsync(staffController.addExistingUser));

/**
 * @swagger
 * /api/staff/{storeId}/schedules:
 *   get:
 *     tags: [Staff]
 *     summary: 주간 스케줄 조회
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
 *         description: 스케줄 목록
 */
router.get(
  '/:storeId/schedules',
  authMiddleware,
  checkStorePermission('order:read'),
  catchAsync(staffController.getSchedules)
);

/**
 * @swagger
 * /api/staff/{storeId}/schedules:
 *   post:
 *     tags: [Staff]
 *     summary: 시프트 등록 (단일/일괄)
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
 *     responses:
 *       201:
 *         description: 시프트 등록 완료
 */
router.post(
  '/:storeId/schedules',
  authMiddleware,
  checkStorePermission('staff:manage'),
  catchAsync(staffController.createSchedules)
);

/**
 * @swagger
 * /api/staff/{storeId}/schedules/{id}:
 *   put:
 *     tags: [Staff]
 *     summary: 시프트 수정
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
 *     responses:
 *       200:
 *         description: 수정 완료
 */
router.put(
  '/:storeId/schedules/:id',
  authMiddleware,
  checkStorePermission('staff:manage'),
  catchAsync(staffController.updateSchedule)
);

/**
 * @swagger
 * /api/staff/{storeId}/schedules/{id}:
 *   delete:
 *     tags: [Staff]
 *     summary: 시프트 삭제
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
 *         description: 삭제 완료
 */
router.delete(
  '/:storeId/schedules/:id',
  authMiddleware,
  checkStorePermission('staff:manage'),
  catchAsync(staffController.deleteSchedule)
);

module.exports = router;
