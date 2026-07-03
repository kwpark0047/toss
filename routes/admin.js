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
    const StoreTier = require('../models/StoreTier');
    const tiers = await StoreTier.getTiers(req.params.storeId);
    res.success(tiers);
}));

// 매장 등급 설정 업데이트/추가
router.post('/stores/:storeId/tier-settings', authMiddleware, checkStorePermission('settings:write'), catchAsync(async (req, res) => {
    const StoreTier = require('../models/StoreTier');
    const tier = await StoreTier.upsertTier(req.params.storeId, req.body);
    res.success(tier, '등급 설정이 저장되었습니다.');
}));

// 매장 등급 설정 삭제
router.delete('/stores/:storeId/tier-settings/:tierName', authMiddleware, checkStorePermission('settings:write'), catchAsync(async (req, res) => {
    const StoreTier = require('../models/StoreTier');
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

module.exports = router;
