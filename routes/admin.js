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
    const region = (req.query.region || '').trim();          // 지역(주소 부분일치)
    const businessType = (req.query.business_type || '').trim();
    const status = (req.query.status || '').trim();          // active | inactive | ''

    const where = {
        NOT: [{ name: { contains: '?' } }, { name: { contains: '�' } }],
        ...(search ? { OR: [{ name: { contains: search } }, { address: { contains: search } }] } : {}),
        ...(region ? { address: { contains: region } } : {}),
        ...(businessType ? { business_type: { contains: businessType } } : {}),
        ...(status === 'active' ? { is_active: true } : status === 'inactive' ? { is_active: false } : {}),
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

// 매장 상세 드릴인 (최근 주문 + 일별 매출/주문 추이)
router.get('/platform/stores/:id/detail', authMiddleware, requireSuper, catchAsync(async (req, res) => {
    const id = parseInt(req.params.id);
    const days = Math.min(parseInt(req.query.days) || 14, 60);
    const since = new Date(Date.now() - (days - 1) * 86400000);
    since.setHours(0, 0, 0, 0);

    const store = await prisma.stores.findUnique({
        where: { id },
        select: { id: true, name: true, address: true, business_type: true, phone: true, is_active: true, created_at: true },
    });
    if (!store) return res.status(404).json({ success: false, error: '매장을 찾을 수 없습니다.' });

    const [orders, custCount, pointAgg] = await Promise.all([
        prisma.orders.findMany({
            where: { store_id: id },
            select: { id: true, order_number: true, status: true, total_amount: true, created_at: true, customer_phone: true },
            orderBy: { created_at: 'desc' },
            take: 200,
        }),
        prisma.store_customers.count({ where: { store_id: id } }),
        prisma.point_transactions.aggregate({ where: { store_id: id }, _sum: { amount: true } }),
    ]);

    // 일별 매출/주문 버킷 (최근 days일)
    const buckets = {};
    for (let i = 0; i < days; i++) {
        const d = new Date(since.getTime() + i * 86400000);
        buckets[d.toISOString().slice(0, 10)] = { date: d.toISOString().slice(0, 10), sales: 0, orders: 0 };
    }
    let totalSales = 0;
    for (const o of orders) {
        totalSales += o.total_amount || 0;
        const key = new Date(o.created_at).toISOString().slice(0, 10);
        if (buckets[key]) { buckets[key].sales += o.total_amount || 0; buckets[key].orders += 1; }
    }

    res.success({
        store,
        summary: {
            totalOrders: orders.length,
            totalSales,
            customers: custCount,
            points: pointAgg._sum.amount || 0,
        },
        daily: Object.values(buckets),
        recentOrders: orders.slice(0, 8),
    });
}));

// 매장 활성/비활성 토글
router.patch('/platform/stores/:id/active', authMiddleware, requireSuper, catchAsync(async (req, res) => {
    const id = parseInt(req.params.id);
    const { is_active } = req.body;
    const updated = await prisma.stores.update({ where: { id }, data: { is_active: !!is_active } });
    return res.success({ id: updated.id, is_active: updated.is_active }, is_active ? '매장을 활성화했습니다.' : '매장을 비활성화했습니다.');
}));

// 슈퍼관리자 포인트 수동 지급/차감 (매장 컨텍스트)
router.post('/platform/stores/:id/points', authMiddleware, requireSuper, catchAsync(async (req, res) => {
    const storeId = parseInt(req.params.id);
    const { phone, amount, reason } = req.body;
    const amt = parseInt(amount);
    if (!phone || !amt || isNaN(amt) || amt === 0) {
        return res.status(400).json({ success: false, error: '전화번호와 0이 아닌 포인트 금액이 필요합니다.' });
    }
    const digits = String(phone).replace(/\D/g, '');
    if (digits.length < 10) return res.status(400).json({ success: false, error: '전화번호 형식이 올바르지 않습니다.' });

    const result = await prisma.$transaction(async (tx) => {
        let up = await tx.user_points.findFirst({ where: { phone: digits } });
        if (!up) {
            if (amt < 0) throw new AppError('차감할 포인트 계정이 없습니다.', 400);
            up = await tx.user_points.create({ data: { phone: digits, total_points: 0, lifetime_earned: 0, lifetime_used: 0 } });
        }
        const newTotal = (up.total_points || 0) + amt;
        if (newTotal < 0) throw new AppError('보유 포인트보다 많이 차감할 수 없습니다.', 400);
        const data = amt > 0
            ? { total_points: { increment: amt }, lifetime_earned: { increment: amt } }
            : { total_points: { increment: amt }, lifetime_used: { increment: -amt } };
        await tx.user_points.update({ where: { id: up.id }, data });
        await tx.point_transactions.create({
            data: {
                user_point_id: up.id, store_id: storeId, amount: amt,
                type: amt > 0 ? 'ADMIN_GRANT' : 'ADMIN_DEDUCT',
                balance_after: newTotal,
                description: reason || (amt > 0 ? '관리자 지급' : '관리자 차감'),
            },
        });
        return { balance: newTotal };
    });
    return res.success(result, `${amt > 0 ? '지급' : '차감'} 완료 (잔액 ${result.balance}P)`);
}));

// 플랫폼 추이 (일별 주문·매출·신규 매장) — 최근 N일
router.get('/platform/trend', authMiddleware, requireSuper, catchAsync(async (req, res) => {
    const days = Math.min(parseInt(req.query.days) || 14, 60);
    const since = new Date(Date.now() - (days - 1) * 86400000);
    since.setHours(0, 0, 0, 0);

    const [orders, newStores] = await Promise.all([
        prisma.orders.findMany({ where: { created_at: { gte: since } }, select: { total_amount: true, created_at: true } }),
        prisma.stores.findMany({ where: { created_at: { gte: since } }, select: { created_at: true } }),
    ]);

    const buckets = {};
    for (let i = 0; i < days; i++) {
        const key = new Date(since.getTime() + i * 86400000).toISOString().slice(0, 10);
        buckets[key] = { date: key, orders: 0, sales: 0, newStores: 0 };
    }
    for (const o of orders) {
        const k = new Date(o.created_at).toISOString().slice(0, 10);
        if (buckets[k]) { buckets[k].orders += 1; buckets[k].sales += o.total_amount || 0; }
    }
    for (const s of newStores) {
        const k = new Date(s.created_at).toISOString().slice(0, 10);
        if (buckets[k]) buckets[k].newStores += 1;
    }
    res.success({ days, daily: Object.values(buckets) });
}));

// === [서울 열린데이터 매장 보강 (일반음식점 LOCALDATA)] ===
// 서울 오픈데이터 행을 우리 매장과 주소로 매칭해 업종·전화 보강 + 깨진 이름 교정.
// 커서(startIndex) 기반, dryRun 지원. super_admin 전용.
const seoulData = require('../services/seoulDataService');
const { tmToWgs84 } = require('../utils/tmToWgs84');

router.post('/enrich-seoul', authMiddleware, requireSuper, catchAsync(async (req, res) => {
    if (!seoulData.isConfigured()) {
        return res.status(503).json({ success: false, error: '서울 API 키(SEOUL_OPENAPI_KEYS)가 설정되지 않았습니다.' });
    }
    const size = Math.min(parseInt(req.body?.size) || 100, 300);
    const start = Math.max(1, parseInt(req.body?.start) || 1);
    const dryRun = req.body?.dryRun === true;

    const { total, rows } = await seoulData.fetchPage(start, start + size - 1);

    let matched = 0, updated = 0, nameFixed = 0, skipped = 0;
    const skipReasons = { closed: 0, noDong: 0, noCandidate: 0, noNameMatch: 0 };
    const samples = [];
    for (const raw of rows) {
        const r = seoulData.mapRow(raw);
        if (r.state === '폐업') { skipped++; skipReasons.closed++; continue; }
        if (!r.name) { skipped++; skipReasons.noDong++; continue; }
        const dong = seoulData.dongOf(r.jibunAddr) || seoulData.dongOf(r.address);
        if (!dong) { skipped++; skipReasons.noDong++; continue; }

        // 동 범위 후보 조회 → 상호명 정규화 일치로 확정 (오매칭 방지)
        const tNorm = seoulData.normName(r.name);
        const candidates = await prisma.stores.findMany({
            where: { address: { contains: dong } },
            select: { id: true, name: true, address: true, phone: true, business_type: true, is_active: true, latitude: true },
            take: 60,
        });
        if (!candidates.length) { skipped++; skipReasons.noCandidate++; continue; }

        const store = candidates.find(c => !seoulData.hasCorruptName(c.name) && tNorm && seoulData.normName(c.name) === tNorm);
        if (!store) { skipped++; skipReasons.noNameMatch++; continue; }

        matched++;
        const patch = {};
        if (seoulData.hasCorruptName(store.name) && r.name && !seoulData.hasCorruptName(r.name)) { patch.name = r.name; nameFixed++; }
        if (!store.business_type && r.businessType) patch.business_type = r.businessType;
        if (!store.phone && r.phone) patch.phone = r.phone;
        // 좌표 보강: 매장에 위경도 없고 서울데이터 TM 좌표가 있으면 변환해 채움
        if (store.latitude == null && r.x && r.y) {
            const g = tmToWgs84(r.x, r.y);
            if (g && g.lat > 37.3 && g.lat < 37.75 && g.lng > 126.7 && g.lng < 127.3) {
                patch.latitude = Math.round(g.lat * 1e6) / 1e6;
                patch.longitude = Math.round(g.lng * 1e6) / 1e6;
            }
        }

        if (Object.keys(patch).length && !dryRun) { await prisma.stores.update({ where: { id: store.id }, data: patch }); }
        if (Object.keys(patch).length) { updated++; if (samples.length < 8) samples.push({ id: store.id, was: store.name, patch }); }
    }

    res.success({
        dryRun, processed: rows.length, matched, updated, nameFixed, skipped, skipReasons,
        nextStart: start + size, total, done: rows.length < size, samples,
    }, `${rows.length}행 처리 · ${matched} 매칭 · ${updated} ${dryRun ? '보강예정' : '보강'}`);
}));

// === [주소 → 좌표 지오코딩 (좌표 없는 매장)] ===
const geocodeService = require('../services/geocodeService');

router.post('/geocode-stores', authMiddleware, requireSuper, catchAsync(async (req, res) => {
    if (!geocodeService.isConfigured()) {
        return res.status(503).json({ success: false, error: '지오코딩 키(KAKAO_REST_API_KEY 또는 NCP_GEOCODE_KEY_ID/KEY)가 설정되지 않았습니다.' });
    }
    const limit = Math.min(parseInt(req.body?.limit) || 20, 50);
    const afterId = parseInt(req.body?.afterId) || 0;
    const dryRun = req.body?.dryRun === true;

    const stores = await prisma.stores.findMany({
        where: {
            is_active: true, latitude: null, id: { gt: afterId },
            address: { not: null },
            NOT: [{ name: { contains: '?' } }, { name: { contains: '�' } }],
        },
        select: { id: true, name: true, address: true },
        orderBy: { id: 'asc' },
        take: limit,
    });

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    let geocoded = 0, failed = 0;
    const samples = [];
    for (const s of stores) {
        try {
            const g = await geocodeService.geocode(s.address);
            if (g) {
                if (!dryRun) await prisma.stores.update({ where: { id: s.id }, data: { latitude: g.lat, longitude: g.lng } });
                geocoded++;
                if (samples.length < 8) samples.push({ id: s.id, name: s.name, ...g });
            } else { failed++; }
        } catch { failed++; }
        await sleep(120); // API 폭주 방지
    }

    const nextCursor = stores.length ? stores[stores.length - 1].id : afterId;
    res.success({
        dryRun, provider: geocodeService.provider(), processed: stores.length,
        geocoded, failed, nextCursor, done: stores.length < limit, samples,
    }, `${stores.length}건 처리 · ${geocoded} 좌표 ${dryRun ? '확인' : '저장'}`);
}));

module.exports = router;
