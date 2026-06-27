const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const logger = require('../utils/logger');
const catchAsync = require('../utils/catchAsync');

// 1. 매장별 카테고리 조회 (상세 경로 우선)
router.get('/store/:storeId', catchAsync(async (req, res) => {
    const storeId = parseInt(req.params.storeId);
    if (isNaN(storeId)) {
        logger.warn(`Invalid storeId: ${req.params.storeId}`);
        return res.status(400).json({ error: '유효하지 않은 매장 ID입니다' });
    }

    const categories = await prisma.categories.findMany({
        where: { store_id: storeId },
        orderBy: { sort_order: 'asc' }
    });
    logger.info(`카테고리 조회 완료: store=${storeId}, count=${categories.length}`);
    res.json(categories);
}));

// 2. 전체 카테고리 목록 조회
router.get('/', catchAsync(async (req, res) => {
    const categories = await prisma.categories.findMany({
        orderBy: { sort_order: 'asc' }
    });
    res.json(categories);
}));

// 3. 카테고리 단일 조회 (최하단)
router.get('/:id', catchAsync(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: '유효하지 않은 ID입니다' });

    const category = await prisma.categories.findUnique({
        where: { id }
    });
    if (!category) return res.status(404).json({ error: '카테고리를 찾을 수 없습니다' });
    res.json(category);
}));

module.exports = router;
