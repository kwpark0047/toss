const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const prisma = require('../config/prisma');
const catchAsync = require('../utils/catchAsync');

// 옵션 템플릿 목록 조회
router.get('/store/:storeId', authMiddleware, catchAsync(async (req, res) => {
    const storeId = parseInt(req.params.storeId);
    const templates = await prisma.option_templates.findMany({
        where: { store_id: storeId },
        orderBy: { created_at: 'desc' }
    });
    res.json(templates);
}));

// 옵션 템플릿 생성
router.post('/', authMiddleware, catchAsync(async (req, res) => {
    const { store_id, name, options } = req.body;
    const template = await prisma.option_templates.create({
        data: {
            store_id: parseInt(store_id),
            name,
            options: typeof options === 'string' ? options : JSON.stringify(options)
        }
    });
    res.status(201).json(template);
}));

// 옵션 템플릿 수정
router.put('/:id', authMiddleware, catchAsync(async (req, res) => {
    const { name, options } = req.body;
    const template = await prisma.option_templates.update({
        where: { id: parseInt(req.params.id) },
        data: {
            name,
            options: typeof options === 'string' ? options : JSON.stringify(options)
        }
    });
    res.json(template);
}));

// 옵션 템플릿 삭제
router.delete('/:id', authMiddleware, catchAsync(async (req, res) => {
    await prisma.option_templates.delete({
        where: { id: parseInt(req.params.id) }
    });
    res.json({ message: '템플릿이 삭제되었습니다.' });
}));

module.exports = router;
