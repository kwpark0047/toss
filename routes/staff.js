const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const authMiddleware = require('../middleware/auth');
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

module.exports = router;
