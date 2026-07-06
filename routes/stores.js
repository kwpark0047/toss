const express = require('express');
const router = express.Router();
const Store = require('../models/Store');
const authMiddleware = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');
const catchAsync = require('../utils/catchAsync');
const prisma = require('../config/prisma');
const cache = require('../utils/cache');

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

// 매장 상세 조회 — 고객 메뉴판 진입 시 매번 호출되는 핫 경로라 60초 캐시 적용
router.get('/:id', catchAsync(async (req, res) => {
    const cacheKey = `store:${req.params.id}:profile`;
    const cached = cache.get(cacheKey);
    if (cached) return res.success(cached);

    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ success: false, error: '매장을 찾을 수 없습니다' });
    cache.set(cacheKey, store, 60);
    res.success(store);
}));

// 매장 생성
router.post('/', authMiddleware, catchAsync(async (req, res) => {
    const storeData = { ...req.body, user_id: req.user.id };
    const store = await Store.create(storeData);
    res.success(store, '매장이 생성되었습니다', 201);
}));

// checkStorePermission은 req.params.storeId를 참조하므로 /:id → storeId 브리지
const bridgeStoreId = (req, _res, next) => { req.storeId = req.params.id; next(); };

// 매장 정보 수정
router.put('/:id', authMiddleware, bridgeStoreId, checkStorePermission('store:update'), catchAsync(async (req, res) => {
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ success: false, error: '매장을 찾을 수 없습니다' });
    const updated = await Store.update(req.params.id, req.body);
    cache.flushByStore(req.params.id);
    res.success(updated, '매장 정보가 수정되었습니다');
}));

// ── 사업자 정보 조회 ──────────────────────────────────────────────────────────
router.get('/:id/business', authMiddleware, bridgeStoreId, checkStorePermission('settings:read'), catchAsync(async (req, res) => {
    const sid = parseInt(req.params.id);
    const store = await Store.findBusinessInfo(sid);
    if (!store) return res.status(404).json({ success: false, error: '매장을 찾을 수 없습니다' });

    let enabledMethods = ['cash', 'store_card', 'transfer'];
    try { enabledMethods = JSON.parse(store.enabled_payment_methods || '[]'); } catch {}

    res.success({ ...store, enabled_payment_methods: enabledMethods });
}));

// ── 사업자 정보 저장 ──────────────────────────────────────────────────────────
router.put('/:id/business', authMiddleware, bridgeStoreId, checkStorePermission('settings:write'), catchAsync(async (req, res) => {
    const sid = parseInt(req.params.id);
    // 검증에 사용하는 필드만 추출 (나머지는 Store.updateBusinessInfo가 req.body로 저장)
    const { business_number, settlement_cycle } = req.body;

    // 사업자번호 형식 검증 (000-00-00000)
    if (business_number && !/^\d{3}-\d{2}-\d{5}$/.test(business_number)) {
        return res.status(400).json({ success: false, error: '사업자번호 형식이 올바르지 않습니다. (예: 123-45-67890)' });
    }

    const validCycles = ['DAILY', 'WEEKLY', 'MONTHLY', 'MANUAL'];
    if (settlement_cycle && !validCycles.includes(settlement_cycle)) {
        return res.status(400).json({ success: false, error: '정산 주기가 올바르지 않습니다.' });
    }

    const updated = await Store.updateBusinessInfo(sid, req.body);
    res.success(updated, '사업자 정보가 저장되었습니다.');
}));

// ── 계좌이체 계좌 조회 (관리자용 — 전체 정보) ────────────────────────────────
router.get('/:id/account', authMiddleware, bridgeStoreId, checkStorePermission('settings:read'), catchAsync(async (req, res) => {
    const sid = parseInt(req.params.id);
    const account = await prisma.store_accounts.findUnique({ where: { store_id: sid } });
    res.success(account || null);
}));

// ── 계좌이체 계좌 조회 (고객용 — 송금 표시 정보만, 민감정보 최소화) ────────────
router.get('/:id/account/public', catchAsync(async (req, res) => {
    const sid = parseInt(req.params.id);
    const account = await prisma.store_accounts.findUnique({
        where: { store_id: sid },
        select: { bank_name: true, account_number: true, account_holder: true }
    });
    res.success(account || null);
}));

// ── 계좌이체 계좌 등록·수정 ───────────────────────────────────────────────────
router.put('/:id/account', authMiddleware, bridgeStoreId, checkStorePermission('settings:write'), catchAsync(async (req, res) => {
    const sid = parseInt(req.params.id);
    const { bank_code, bank_name, account_number, account_holder } = req.body;

    if (!bank_name || !account_number || !account_holder) {
        return res.status(400).json({ success: false, error: '은행명, 계좌번호, 예금주명은 필수입니다.' });
    }

    const account = await prisma.store_accounts.upsert({
        where: { store_id: sid },
        create: { store_id: sid, bank_code: bank_code || '', bank_name, account_number, account_holder, is_active: true },
        update: { bank_code: bank_code || bank_name, bank_name, account_number, account_holder, is_active: true, updated_at: new Date() }
    });
    res.success(account, '계좌 정보가 저장되었습니다.');
}));

// 매장 삭제 (소프트 딜리트)
router.delete('/:id', authMiddleware, bridgeStoreId, checkStorePermission('store:delete'), catchAsync(async (req, res) => {
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ success: false, error: '매장을 찾을 수 없습니다' });
    await Store.delete(req.params.id);
    res.success(null, '매장이 삭제되었습니다');
}));

module.exports = router;
