const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma'); // 공통 Prisma 인스턴스 사용
const catchAsync = require('../utils/catchAsync'); // 공통 에러 핸들러 사용

// [GET] 특정 테이블의 공유 장바구니 조회
router.get('/:tableId', catchAsync(async (req, res) => {
    const { tableId } = req.params;
    
    const items = await prisma.shared_cart_items.findMany({
        where: { table_id: parseInt(tableId) },
        include: { products: true },
        orderBy: { created_at: 'asc' }
    });
    
    res.json({ success: true, data: items });
}));

// [POST] 장바구니 아이템 추가/수정
router.post('/:tableId', catchAsync(async (req, res) => {
    const { tableId } = req.params;
    const { product_id, quantity, user_phone } = req.body;

    // 기존 아이템 확인
    const existing = await prisma.shared_cart_items.findFirst({
        where: {
            table_id: parseInt(tableId),
            product_id: parseInt(product_id)
        }
    });

    let item;
    if (existing) {
        if (quantity <= 0) {
            await prisma.shared_cart_items.delete({ where: { id: existing.id } });
            item = { ...existing, quantity: 0, deleted: true };
        } else {
            item = await prisma.shared_cart_items.update({
                where: { id: existing.id },
                data: { quantity: parseInt(quantity), user_phone }
            });
        }
    } else if (quantity > 0) {
        item = await prisma.shared_cart_items.create({
            data: {
                table_id: parseInt(tableId),
                product_id: parseInt(product_id),
                quantity: parseInt(quantity),
                user_phone
            },
            include: { products: true }
        });
    }

    res.json({ success: true, data: item });
}));

// [DELETE] 특정 테이블의 장바구니 전체 초기화
router.delete('/:tableId', catchAsync(async (req, res) => {
    const { tableId } = req.params;
    
    await prisma.shared_cart_items.deleteMany({
        where: { table_id: parseInt(tableId) }
    });
    
    res.json({ success: true, message: '장바구니가 초기화되었습니다.' });
}));

module.exports = router;
