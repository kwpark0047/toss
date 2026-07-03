const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const authMiddleware = require('../middleware/auth');
const { checkStorePermission, getStoreRole } = require('../middleware/storeAuth');
const { AppError } = require('../utils/errorHandler');
const bcrypt = require('bcryptjs');
const catchAsync = require('../utils/catchAsync');

// 1. 내 권한 조회 (상세 경로 우선 배치)
router.get('/store/:storeId/role', authMiddleware, catchAsync(async (req, res, next) => {
    const storeId = parseInt(req.params.storeId);
    if (isNaN(storeId)) return next(new AppError('유효하지 않은 매장 ID입니다.', 400));

    const userId = req.user.id;

    const store = await prisma.stores.findUnique({
        where: { id: storeId }
    });

    if (store && store.user_id === userId) {
        const ownerStaff = await prisma.staff.findFirst({
            where: { store_id: storeId, user_id: userId }
        });
        return res.success({ role: 'owner', staff_id: ownerStaff?.id });
    }

    const staff = await prisma.staff.findUnique({
        where: {
            store_id_user_id: {
                store_id: storeId,
                user_id: userId
            }
        }
    });

    res.success({
        role: staff ? staff.role : 'user',
        staff_id: staff ? staff.id : null
    });
}));

// 2. 매장 직원 목록 조회
router.get('/store/:storeId', authMiddleware, catchAsync(async (req, res, next) => {
    const storeId = parseInt(req.params.storeId);
    if (isNaN(storeId)) return next(new AppError('유효하지 않은 매장 ID입니다.', 400));

    const staffList = await prisma.staff.findMany({
        where: { store_id: storeId },
        include: {
            users: {
                select: {
                    id: true,
                    name: true,
                    email: true
                }
            }
        }
    });

    const formattedList = staffList.map(s => ({
        id: s.id,
        user_id: s.user_id,
        name: s.users.name,
        email: s.users.email,
        role: s.role,
        created_at: s.created_at
    }));

    res.success(formattedList);
}));

// 2.5. 오너 셀프 근태 등록 (1인 매장)
router.post('/self-register', authMiddleware, catchAsync(async (req, res) => {
    const { storeId } = req.body;
    const sid = parseInt(storeId);
    if (isNaN(sid)) throw new AppError('유효하지 않은 매장 ID입니다.', 400);
    const store = await prisma.stores.findFirst({ where: { id: sid, user_id: req.user.id } });
    if (!store) throw new AppError('매장 소유자만 사용 가능합니다.', 403);
    const existing = await prisma.staff.findFirst({ where: { store_id: sid, user_id: req.user.id } });
    if (existing) throw new AppError('이미 근태 추적이 활성화되어 있습니다.', 409);
    const newStaff = await prisma.staff.create({
        data: { store_id: sid, user_id: req.user.id, role: 'owner' },
        include: { users: { select: { name: true, email: true } } }
    });
    res.success({ id: newStaff.id, name: newStaff.users.name, role: 'owner' }, '셀프 근태 추적이 활성화되었습니다.', 201);
}));

// 3. 직원 직접 생성 (관리자 기능)
router.post('/', authMiddleware, catchAsync(async (req, res, _next) => {
    const { storeId, name, email, password, role } = req.body;

    if (!storeId || !email || !password || !name) {
        throw new AppError('필수 정보가 누락되었습니다.', 400);
    }

    const existingUser = await prisma.users.findUnique({
        where: { email }
    });

    if (existingUser) {
        throw new AppError('이미 존재하는 이메일입니다.', 409);
    }

    const result = await prisma.$transaction(async (tx) => {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await tx.users.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: 'staff'
            }
        });

        const newStaff = await tx.staff.create({
            data: {
                store_id: parseInt(storeId),
                user_id: newUser.id,
                role: role || 'staff'
            },
            include: {
                users: {
                    select: { name: true, email: true }
                }
            }
        });

        return newStaff;
    });

    res.success({
        id: result.id,
        user_id: result.user_id,
        name: result.users.name,
        email: result.users.email,
        role: result.role
    }, '직원이 생성되었습니다.', 201);
}));

// 4-A. 매장 근태 조회 (매장 권한 필요)
router.get('/store/:storeId/attendance', authMiddleware, checkStorePermission('order:read'), catchAsync(async (req, res) => {
    const storeId = parseInt(req.params.storeId);
    const { date, month } = req.query;

    let clockFilter = {};
    if (date) {
        const start = new Date(date);
        const end = new Date(date);
        end.setDate(end.getDate() + 1);
        clockFilter = { clock_in: { gte: start, lt: end } };
    } else if (month) {
        const [y, m] = month.split('-').map(Number);
        clockFilter = { clock_in: { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) } };
    }

    const records = await prisma.staff_attendance.findMany({
        where: { store_id: storeId, ...clockFilter },
        include: {
            staff: {
                include: { users: { select: { name: true, email: true } } }
            }
        },
        orderBy: { clock_in: 'desc' }
    });
    res.success(records);
}));

// 4-B. 출근 처리 (본인 or 매장 오너/매니저만 허용)
router.post('/:id/clock-in', authMiddleware, catchAsync(async (req, res) => {
    const staffId = parseInt(req.params.id);
    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) throw new AppError('직원을 찾을 수 없습니다.', 404);

    const isSelf = staff.user_id === req.user.id;
    if (!isSelf && req.user.role !== 'super_admin') {
        const role = await getStoreRole(req.user.id, staff.store_id);
        if (!role || (role !== 'owner' && role !== 'manager')) {
            throw new AppError('출근 처리 권한이 없습니다.', 403);
        }
    }

    const active = await prisma.staff_attendance.findFirst({
        where: { staff_id: staffId, clock_out: null }
    });
    if (active) throw new AppError('이미 출근 중입니다.', 400);

    const record = await prisma.staff_attendance.create({
        data: { staff_id: staffId, store_id: staff.store_id, clock_in: new Date(), note: req.body.note || null }
    });
    res.success(record, '출근 처리되었습니다.', 201);
}));

// 4-C. 퇴근 처리 (본인 or 매장 오너/매니저만 허용)
router.post('/:id/clock-out', authMiddleware, catchAsync(async (req, res) => {
    const staffId = parseInt(req.params.id);
    const staff = await prisma.staff.findUnique({ where: { id: staffId } });
    if (!staff) throw new AppError('직원을 찾을 수 없습니다.', 404);

    const isSelf = staff.user_id === req.user.id;
    if (!isSelf && req.user.role !== 'super_admin') {
        const role = await getStoreRole(req.user.id, staff.store_id);
        if (!role || (role !== 'owner' && role !== 'manager')) {
            throw new AppError('퇴근 처리 권한이 없습니다.', 403);
        }
    }

    const active = await prisma.staff_attendance.findFirst({
        where: { staff_id: staffId, clock_out: null },
        orderBy: { clock_in: 'desc' }
    });
    if (!active) throw new AppError('출근 기록이 없습니다.', 400);

    const clockOut = new Date();
    const workHours = (clockOut - new Date(active.clock_in)) / (1000 * 60 * 60);
    const record = await prisma.staff_attendance.update({
        where: { id: active.id },
        data: { clock_out: clockOut, work_hours: Math.round(workHours * 100) / 100 }
    });
    res.success(record, '퇴근 처리되었습니다.');
}));

// 4. 직원 역할 수정
router.put('/:id', authMiddleware, catchAsync(async (req, res, next) => {
    const staffId = parseInt(req.params.id);
    if (isNaN(staffId)) return next(new AppError('유효하지 않은 직원 ID입니다.', 400));

    const { role } = req.body;

    const updated = await prisma.staff.update({
        where: { id: staffId },
        data: { role }
    });

    res.success(updated);
}));

// 5. 직원 삭제
router.delete('/:id', authMiddleware, catchAsync(async (req, res, next) => {
    const staffId = parseInt(req.params.id);
    if (isNaN(staffId)) return next(new AppError('유효하지 않은 직원 ID입니다.', 400));

    await prisma.staff.delete({
        where: { id: staffId }
    });

    res.success({ success: true }, '직원이 삭제되었습니다.');
}));

// 역할 허용 목록 — owner는 이 엔드포인트로 부여 불가
const ASSIGNABLE_ROLES = ['staff', 'kitchen', 'manager'];

// 6. 휴대폰 번호로 기존 사용자 조회 (직원 초대용)
// GET /api/staff/lookup-user?phone=01012345678&storeId=10
router.get('/lookup-user', authMiddleware, catchAsync(async (req, res) => {
    const { phone, storeId } = req.query;

    // storeId 필수 + 호출자 권한 확인 (PII 열거 방지)
    if (!storeId) throw new AppError('storeId가 필요합니다.', 400);
    const myRole = await getStoreRole(req.user.id, storeId);
    if (!myRole || (myRole !== 'owner' && myRole !== 'manager')) {
        throw new AppError('팀원 조회 권한이 없습니다.', 403);
    }

    if (!phone) throw new AppError('휴대폰 번호가 필요합니다.', 400);
    const normalized = phone.replace(/\D/g, '');
    if (normalized.length < 10) throw new AppError('유효한 번호를 입력해주세요.', 400);

    const user = await prisma.users.findFirst({
        where: { phone: normalized },
        select: { id: true, name: true, phone: true }
    });

    if (!user) return res.success({ found: false });

    const existing = await prisma.staff.findFirst({
        where: { store_id: parseInt(storeId), user_id: user.id }
    });

    const digits = (user.phone || normalized).replace(/\D/g, '');
    const masked = digits.length === 11
        ? `${digits.slice(0,3)}-****-${digits.slice(7)}`
        : `${digits.slice(0,3)}-****-${digits.slice(-4)}`;

    res.success({
        found: true,
        alreadyStaff: !!existing,
        user: { id: user.id, name: user.name || '(이름 미등록)', phone: masked }
    });
}));

// 7. 기존 사용자를 직원으로 추가 (비밀번호 불필요)
// POST /api/staff/add-existing  { storeId, userId, role }
router.post('/add-existing', authMiddleware, catchAsync(async (req, res) => {
    const { storeId, userId, role } = req.body;
    if (!storeId || !userId) throw new AppError('storeId와 userId가 필요합니다.', 400);

    // 호출자 권한 확인
    const myRole = await getStoreRole(req.user.id, storeId);
    if (!myRole || (myRole !== 'owner' && myRole !== 'manager')) {
        throw new AppError('직원 추가 권한이 없습니다.', 403);
    }

    // 역할 서버사이드 검증 (권한 상승 방지)
    const assignedRole = role || 'staff';
    if (!ASSIGNABLE_ROLES.includes(assignedRole)) {
        throw new AppError('유효하지 않은 역할입니다.', 400);
    }
    // 매니저는 manager 역할을 부여할 수 없음 (owner만 가능)
    if (assignedRole === 'manager' && myRole !== 'owner') {
        throw new AppError('매니저 역할은 오너만 부여할 수 있습니다.', 403);
    }

    const existing = await prisma.staff.findFirst({
        where: { store_id: parseInt(storeId), user_id: parseInt(userId) }
    });
    if (existing) throw new AppError('이미 해당 매장의 팀원입니다.', 409);

    const newStaff = await prisma.staff.create({
        data: {
            store_id: parseInt(storeId),
            user_id: parseInt(userId),
            role: assignedRole
        },
        include: { users: { select: { name: true, email: true, phone: true } } }
    });

    res.success({
        id: newStaff.id,
        user_id: newStaff.user_id,
        name: newStaff.users.name,
        role: newStaff.role
    }, '팀원이 추가되었습니다.', 201);
}));

module.exports = router;
