const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');
const catchAsync = require('../utils/catchAsync');
const staffController = require('../controllers/staffController');

// 1. 내 권한 조회
router.get('/store/:storeId/role', authMiddleware, catchAsync(staffController.getMyRole));

// 2. 매장 직원 목록 조회
router.get('/store/:storeId', authMiddleware, catchAsync(staffController.getStaffList));

// 2.5. 오너 셀프 근태 등록
router.post('/self-register', authMiddleware, catchAsync(staffController.selfRegister));

// 3. 직원 직접 생성
router.post('/', authMiddleware, catchAsync(staffController.createStaff));

// 4-A. 매장 근태 조회
router.get('/store/:storeId/attendance', authMiddleware, checkStorePermission('order:read'), catchAsync(staffController.getAttendance));

// 4-B. 출근 처리
router.post('/:id/clock-in', authMiddleware, catchAsync(staffController.clockIn));

// 4-C. 퇴근 처리
router.post('/:id/clock-out', authMiddleware, catchAsync(staffController.clockOut));

// 4. 직원 역할 수정
router.put('/:id', authMiddleware, catchAsync(staffController.updateStaffRole));

// 5. 직원 삭제
router.delete('/:id', authMiddleware, catchAsync(staffController.deleteStaff));

// 6. 휴대폰 번호로 기존 사용자 조회
router.get('/lookup-user', authMiddleware, catchAsync(staffController.lookupUser));

// 7. 기존 사용자를 직원으로 추가
router.post('/add-existing', authMiddleware, catchAsync(staffController.addExistingUser));

// ── 근무표 (Schedule) CRUD ──

// 주간 스케줄 조회
router.get('/:storeId/schedules', authMiddleware, catchAsync(staffController.getSchedules));

// 시프트 등록 (단일 / 일괄)
router.post('/:storeId/schedules', authMiddleware, catchAsync(staffController.createSchedules));

// 시프트 수정
router.put('/:storeId/schedules/:id', authMiddleware, catchAsync(staffController.updateSchedule));

// 시프트 삭제
router.delete('/:storeId/schedules/:id', authMiddleware, catchAsync(staffController.deleteSchedule));

module.exports = router;
