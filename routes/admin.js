const express = require('express');
const router = express.Router();
const Settlement = require('../models/Settlement');
const Receipt = require('../models/Receipt');
const { authMiddleware } = require('../middleware/auth');
const { checkStorePermission } = require('../middleware/storeAuth');
const notificationService = require('../utils/notifications');
const { sendSms } = require('../utils/smsService');
const prisma = require('../config/prisma');
const Store = require('../models/Store');
const StoreTier = require('../models/StoreTier');
const catchAsync = require('../utils/catchAsync');

// === [정산 API] ===

// 매장별 정산 목록 조회
router.get('/stores/:storeId/settlements', authMiddleware, checkStorePermission('stats:read'), catchAsync(async (req, res) => {
    const list = await Settlement.findByStore(req.params.storeId);
    res.success(list);
}));

// 정산 생성 (관리자용)
router.post('/stores/:storeId/settlements/generate', authMiddleware, checkStorePermission('admin'), catchAsync(async (req, res) => {
    const { period_start, period_end } = req.body;
    const settlement = await Settlement.create({ store_id: req.params.storeId, period_start, period_end });

    const io = req.app.get('io');
    const store = await Store.findById(req.params.storeId);
    if (store) {
        const users = await prisma.users.findMany({ where: { id: store.user_id } });
        const managerTokens = users.map(u => u.fcm_token).filter(t => t);
        notificationService.sendSettlementNotification(io, store, {
            period_start,
            period_end,
            net_amount: settlement.net_amount
        }, managerTokens);
    }

    res.success({ settlement }, '정산이 생성되었습니다');
}));

// 정산 상태 업데이트 (정산 완료 처리)
router.patch('/stores/:storeId/settlements/:id/status', authMiddleware, checkStorePermission('admin'), catchAsync(async (req, res) => {
    const { status } = req.body;
    if (!['PENDING', 'COMPLETED', 'PAID', 'CANCELLED'].includes(status)) {
        return res.status(400).json({ error: '유효하지 않은 상태값입니다.' });
    }

    const updated = await Settlement.updateStatus(req.params.id, status);
    if (!updated) return res.status(404).json({ error: '정산 내역을 찾을 수 없습니다.' });

    res.success(updated, '정산 상태가 업데이트되었습니다.');
}));

// 세금계산서 발행 (COMPLETED/PAID 상태에서만)
router.post('/stores/:storeId/settlements/:id/tax-invoice', authMiddleware, checkStorePermission('settings:write'), catchAsync(async (req, res) => {
    const updated = await Settlement.issueTaxInvoice(req.params.id);
    res.success(updated, `세금계산서가 발행되었습니다. (${updated.tax_invoice_number})`);
}));

// 매장 수수료율 설정 (super_admin 전용)
router.put('/stores/:storeId/commission', authMiddleware, checkStorePermission('admin'), catchAsync(async (req, res) => {
    const { commission_rate, vat_rate } = req.body;
    if (commission_rate !== undefined && (commission_rate < 0 || commission_rate > 0.3)) {
        return res.status(400).json({ error: '수수료율은 0% ~ 30% 범위여야 합니다.' });
    }
    const updateData = {};
    if (commission_rate !== undefined) updateData.commission_rate = parseFloat(commission_rate);
    if (vat_rate !== undefined) updateData.vat_rate = parseFloat(vat_rate);

    await prisma.stores.update({ where: { id: parseInt(req.params.storeId) }, data: updateData });
    res.success(null, '수수료율이 업데이트되었습니다.');
}));

// 정산 상세 조회
router.get('/stores/:storeId/settlements/:id', authMiddleware, checkStorePermission('stats:read'), catchAsync(async (req, res) => {
    const settlement = await prisma.settlements.findUnique({
        where: { id: parseInt(req.params.id) },
        include: { stores: { select: { name: true, business_type: true, business_name: true, business_number: true, ceo_name: true } } }
    });
    if (!settlement) return res.status(404).json({ error: '정산 내역을 찾을 수 없습니다.' });

    let breakdown = {};
    try { breakdown = JSON.parse(settlement.payment_method_breakdown || '{}'); } catch {}

    res.success({ ...settlement, breakdown });
}));

// === [영수증 설정 API] ===

// 영수증 설정 조회
router.get('/stores/:storeId/receipt-settings', authMiddleware, checkStorePermission('settings:read'), catchAsync(async (req, res) => {
    const settings = await Receipt.findByStoreId(req.params.storeId);
    res.success(settings);
}));

// 영수증 설정 업데이트
router.put('/stores/:storeId/receipt-settings', authMiddleware, checkStorePermission('settings:write'), catchAsync(async (req, res) => {
    await Receipt.update(req.params.storeId, req.body);
    res.success(null, '영수증 설정이 업데이트되었습니다.');
}));

// === [등급 설정 API] ===

// 매장 등급 설정 조회
router.get('/stores/:storeId/tier-settings', authMiddleware, checkStorePermission('settings:read'), catchAsync(async (req, res) => {
    const tiers = await StoreTier.getTiers(req.params.storeId);
    res.success(tiers);
}));

// 매장 등급 설정 업데이트/추가
router.post('/stores/:storeId/tier-settings', authMiddleware, checkStorePermission('settings:write'), catchAsync(async (req, res) => {
    const tier = await StoreTier.upsertTier(req.params.storeId, req.body);
    res.success(tier, '등급 설정이 저장되었습니다.');
}));

// 매장 등급 설정 삭제
router.delete('/stores/:storeId/tier-settings/:tierName', authMiddleware, checkStorePermission('settings:write'), catchAsync(async (req, res) => {
    await StoreTier.deleteTier(req.params.storeId, req.params.tierName);
    res.success(null, '등급 설정이 삭제되었습니다.');
}));

// === [통합 Bulk SMS API (최고관리자 전용)] ===

// 1. 필터링 옵션 조회
router.get('/bulk-sms/filter-options', authMiddleware, catchAsync(async (req, res) => {
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: '최고관리자만 접근 가능합니다.' });

    const stores = await prisma.stores.findMany({
        where: { is_active: true },
        select: { id: true, name: true, address: true, business_type: true }
    });

    const regions = [...new Set(stores.map(s => s.address?.split(' ')[0]).filter(Boolean))];
    const businessTypes = [...new Set(stores.map(s => s.business_type).filter(Boolean))];

    res.success({
        stores: stores.map(s => ({ id: s.id, name: s.name })),
        regions,
        businessTypes
    });
}));

// 2. 필터링된 고객 목록 및 통계 조회
router.get('/bulk-sms/customers', authMiddleware, catchAsync(async (req, res) => {
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: '최고관리자만 접근 가능합니다.' });

    const { storeId, region, businessType } = req.query;
    const where = {};
    if (storeId) where.store_id = parseInt(storeId);

    const storeWhere = {};
    if (region) storeWhere.address = { startsWith: region };
    if (businessType) storeWhere.business_type = businessType;

    const customers = await prisma.store_customers.findMany({
        where: {
            ...where,
            stores: Object.keys(storeWhere).length > 0 ? storeWhere : undefined
        },
        include: {
            stores: { select: { name: true, address: true, business_type: true } }
        },
        orderBy: { created_at: 'desc' }
    });

    res.success({
        count: customers.length,
        customers: customers.slice(0, 100)
    });
}));

// 3. 통합 Bulk SMS 발송 처리
router.post('/bulk-sms/send', authMiddleware, catchAsync(async (req, res) => {
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: '최고관리자만 접근 가능합니다.' });

    const { filters, message } = req.body;
    if (!message) return res.status(400).json({ error: '메시지 내용이 필요합니다.' });

    const { storeId, region, businessType } = filters || {};
    const where = {};
    if (storeId) where.store_id = parseInt(storeId);
    const storeWhere = {};
    if (region) storeWhere.address = { startsWith: region };
    if (businessType) storeWhere.business_type = businessType;

    const targets = await prisma.store_customers.findMany({
        where: {
            ...where,
            stores: Object.keys(storeWhere).length > 0 ? storeWhere : undefined
        },
        select: { customer_phone: true }
    });

    const uniquePhones = [...new Set(targets.map(t => t.customer_phone))];

    setImmediate(async () => {
        let sentCount = 0;
        let failCount = 0;
        for (const phone of uniquePhones) {
            try {
                const result = await sendSms(phone, message);
                if (result.sent || result.dev) sentCount++;
                else failCount++;
            } catch {
                failCount++;
            }
            if (uniquePhones.length > 10) await new Promise(r => setTimeout(r, 200));
        }
        const logger = require('../utils/logger');
        logger.info(`Bulk SMS 발송 완료: total=${uniquePhones.length}, sent=${sentCount}, failed=${failCount}`);
    });
    res.success({
        target_count: uniquePhones.length,
        status: 'processing',
        job_id: Date.now()
    }, `${uniquePhones.length}명에게 SMS 발송을 시작했습니다.`);
}));

// === [매장 정보 보강 — 네이버 지역검색 API (최고관리자 전용)] ===
// 상호+주소로 좌표·전화·업종을 공식 API로 보강. 커서 기반 소량 배치로
// 일일 요청 한도(2.5만)를 준수하며 "조금씩" 진행한다. 빈 필드만 채운다.
const naverLocal = require('../services/naverLocalService');

router.post('/enrich-stores', authMiddleware, catchAsync(async (req, res) => {
    if (req.user.role !== 'super_admin') return res.status(403).json({ error: '최고관리자만 접근 가능합니다.' });
    if (!naverLocal.isConfigured()) {
        return res.status(503).json({ success: false, error: '네이버 API 키(NAVER_CLIENT_SECRET)가 설정되지 않았습니다.' });
    }

    const limit = Math.min(parseInt(req.body?.limit) || 10, 30); // 1회 최대 30건
    const afterId = parseInt(req.body?.afterId) || 0;            // 커서(이 id 초과부터)
    const delayMs = 250;                                          // 호출 간 지연

    const candidates = await prisma.stores.findMany({
        where: {
            is_active: true,
            id: { gt: afterId },
            NOT: [{ name: { contains: '?' } }, { name: { contains: '�' } }],
            OR: [{ latitude: null }, { phone: null }, { business_type: null }],
        },
        select: { id: true, name: true, address: true, latitude: true, longitude: true, phone: true, business_type: true },
        orderBy: { id: 'asc' },
        take: limit,
    });

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    let matched = 0, updated = 0;
    const results = [];
    for (const s of candidates) {
        try {
            const r = await naverLocal.enrichStore(s);
            if (r) {
                matched++;
                await Store.update(s.id, r.patch);
                updated++;
                results.push({ id: s.id, name: s.name, patch: r.patch });
            } else {
                results.push({ id: s.id, name: s.name, matched: false });
            }
        } catch (e) {
            results.push({ id: s.id, name: s.name, error: (e.message || '').slice(0, 80) });
        }
        await sleep(delayMs);
    }

    const nextCursor = candidates.length ? candidates[candidates.length - 1].id : afterId;
    res.success({
        processed: candidates.length,
        matched,
        updated,
        nextCursor,
        done: candidates.length < limit,
    }, `${candidates.length}건 처리 · ${updated}건 보강`);
}));

// === [슈퍼관리자 플랫폼 대시보드] ===
const requireSuper = (req, res, next) =>
    req.user?.role === 'super_admin' ? next() : res.status(403).json({ error: '최고관리자만 접근 가능합니다.' });

// 플랫폼 전체 지표
router.get('/platform/overview', authMiddleware, requireSuper, catchAsync(async (req, res) => {
    const [totalStores, activeStores, totalCustomers, totalOrders, pointsAgg] = await Promise.all([
        prisma.stores.count(),
        prisma.stores.count({ where: { is_active: true } }),
        prisma.store_customers.count(),
        prisma.orders.count(),
        prisma.user_points.aggregate({ _sum: { lifetime_earned: true, lifetime_used: true, total_points: true } }),
    ]);
    res.success({
        totalStores,
        activeStores,
        inactiveStores: totalStores - activeStores,
        totalCustomers,
        totalOrders,
        pointsIssued: pointsAgg._sum.lifetime_earned || 0,
        pointsUsed: pointsAgg._sum.lifetime_used || 0,
        pointsBalance: pointsAgg._sum.total_points || 0,
    });
}));

// 매장 목록(검색·페이지네이션) + 매장별 지표(주문·매출·고객·포인트)
router.get('/platform/stores', authMiddleware, requireSuper, catchAsync(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const search = (req.query.search || '').trim();

    const where = {
        NOT: [{ name: { contains: '?' } }, { name: { contains: '�' } }],
        ...(search ? { OR: [{ name: { contains: search } }, { address: { contains: search } }] } : {}),
    };

    const [total, stores] = await Promise.all([
        prisma.stores.count({ where }),
        prisma.stores.findMany({
            where,
            select: { id: true, name: true, address: true, business_type: true, is_active: true, created_at: true },
            orderBy: { id: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
    ]);

    const ids = stores.map(s => s.id);
    // 페이지 내 매장에 한해 지표 집계(가벼움)
    const [orderStats, custStats, pointStats] = await Promise.all([
        ids.length ? prisma.orders.groupBy({ by: ['store_id'], where: { store_id: { in: ids } }, _count: { _all: true }, _sum: { total_amount: true } }) : [],
        ids.length ? prisma.store_customers.groupBy({ by: ['store_id'], where: { store_id: { in: ids } }, _count: { _all: true } }) : [],
        ids.length ? prisma.point_transactions.groupBy({ by: ['store_id'], where: { store_id: { in: ids } }, _sum: { amount: true } }) : [],
    ]);
    const orderMap = Object.fromEntries(orderStats.map(o => [o.store_id, { orders: o._count._all, sales: o._sum.total_amount || 0 }]));
    const custMap = Object.fromEntries(custStats.map(c => [c.store_id, c._count._all]));
    const pointMap = Object.fromEntries(pointStats.map(p => [p.store_id, p._sum.amount || 0]));

    const rows = stores.map(s => ({
        ...s,
        orders: orderMap[s.id]?.orders || 0,
        sales: orderMap[s.id]?.sales || 0,
        customers: custMap[s.id] || 0,
        points: pointMap[s.id] || 0,
    }));

    res.success({ stores: rows, page, limit, total, totalPages: Math.ceil(total / limit) });
}));

module.exports = router;
