const express = require('express');
const router = express.Router();
const Store = require('../models/Store');
const authMiddleware = require('../middleware/auth');
const catchAsync = require('../utils/catchAsync');

// 전체 매장 목록 조회
router.get('/', catchAsync(async (req, res) => {
    const stores = await Store.findAll();
    res.success(stores);
}));

// 내 매장 목록 조회 (인증 필요)
router.get('/my', authMiddleware, catchAsync(async (req, res) => {
    const stores = await Store.findByUserId(req.user.id);
    res.success(stores);
}));

// 매장 상세 조회
router.get('/:id', catchAsync(async (req, res) => {
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ error: '매장을 찾을 수 없습니다' });
    res.success(store);
}));

// 매장 생성
router.post('/', authMiddleware, catchAsync(async (req, res) => {
    const storeData = { ...req.body, user_id: req.user.id };
    const store = await Store.create(storeData);
    res.success(store, '매장이 생성되었습니다', 201);
}));

module.exports = router;
