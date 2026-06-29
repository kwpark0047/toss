const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const logger = require('../utils/logger');
const catchAsync = require('../utils/catchAsync');
const authMiddleware = require('../middleware/auth');

// 1. 매장별 카테고리 조회 (상세 경로 우선)
router.get('/store/:storeId', catchAsync(async (req, res) => {
    const storeId = parseInt(req.params.storeId);
    if (isNaN(storeId)) {
        return res.status(400).json({ error: '유효하지 않은 매장 ID입니다' });
    }
    const categories = await prisma.categories.findMany({
        where: { store_id: storeId },
        orderBy: { sort_order: 'asc' }
    });
    res.json(categories);
}));

// 2. 카테고리 일괄 정렬 순서 업데이트 (/:id 보다 먼저 위치)
router.put('/sort', authMiddleware, catchAsync(async (req, res) => {
    const { orders } = req.body;
    if (!Array.isArray(orders)) {
        return res.status(400).json({ error: 'orders 배열이 필요합니다' });
    }
    await Promise.all(
        orders.map(({ id, sort_order }) =>
            prisma.categories.update({
                where: { id: parseInt(id) },
                data: { sort_order: parseInt(sort_order) }
            })
        )
    );
    logger.info(`카테고리 정렬 업데이트: ${orders.length}개`);
    res.json({ message: '정렬 순서가 업데이트되었습니다' });
}));

// 3. 카테고리 생성
router.post('/', authMiddleware, catchAsync(async (req, res) => {
    const { store_id, name, sort_order } = req.body;
    if (!store_id || !name?.trim()) {
        return res.status(400).json({ error: '매장 ID와 카테고리 이름이 필요합니다' });
    }

    const maxOrder = await prisma.categories.aggregate({
        where: { store_id: parseInt(store_id) },
        _max: { sort_order: true }
    });

    const category = await prisma.categories.create({
        data: {
            store_id: parseInt(store_id),
            name: name.trim(),
            sort_order: sort_order !== undefined ? parseInt(sort_order) : (maxOrder._max.sort_order ?? 0) + 1
        }
    });
    logger.info(`카테고리 생성: store=${store_id}, name=${name}`);
    res.status(201).json(category);
}));

// 4. 카테고리 수정
router.put('/:id', authMiddleware, catchAsync(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: '유효하지 않은 ID입니다' });

    const { name, sort_order } = req.body;
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (sort_order !== undefined) updateData.sort_order = parseInt(sort_order);

    const category = await prisma.categories.update({
        where: { id },
        data: updateData
    });
    logger.info(`카테고리 수정: id=${id}`);
    res.json(category);
}));

// 5. 카테고리 삭제
router.delete('/:id', authMiddleware, catchAsync(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: '유효하지 않은 ID입니다' });

    await prisma.categories.delete({ where: { id } });
    logger.info(`카테고리 삭제: id=${id}`);
    res.json({ message: '카테고리가 삭제되었습니다' });
}));

// 6. 전체 카테고리 목록 조회
router.get('/', catchAsync(async (req, res) => {
    const categories = await prisma.categories.findMany({
        orderBy: { sort_order: 'asc' }
    });
    res.json(categories);
}));

// 7. 카테고리 단일 조회
router.get('/:id', catchAsync(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: '유효하지 않은 ID입니다' });

    const category = await prisma.categories.findUnique({ where: { id } });
    if (!category) return res.status(404).json({ error: '카테고리를 찾을 수 없습니다' });
    res.json(category);
}));

module.exports = router;
