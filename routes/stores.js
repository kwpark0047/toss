const express = require('express');
const router = express.Router();
const Store = require('../models/Store');
const authMiddleware = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');
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
    if (!store) return res.status(404).json({ success: false, error: '매장을 찾을 수 없습니다' });
    res.success(store);
}));

// 매장 생성
router.post('/', authMiddleware, catchAsync(async (req, res) => {
    const storeData = { ...req.body, user_id: req.user.id };
    const store = await Store.create(storeData);
    res.success(store, '매장이 생성되었습니다', 201);
}));

// 매장 정보 수정
router.put('/:id', authMiddleware, checkStorePermission('store:update'), catchAsync(async (req, res) => {
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ success: false, error: '매장을 찾을 수 없습니다' });
    const updated = await Store.update(req.params.id, req.body);
    res.success(updated, '매장 정보가 수정되었습니다');
}));

// 매장 삭제 (소프트 딜리트)
router.delete('/:id', authMiddleware, checkStorePermission('store:delete'), catchAsync(async (req, res) => {
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ success: false, error: '매장을 찾을 수 없습니다' });
    await Store.delete(req.params.id);
    res.success(null, '매장이 삭제되었습니다');
}));

module.exports = router;
