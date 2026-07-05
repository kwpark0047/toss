/**
 * v1.js — WeMarket Open API v1 (외부 개발자용)
 *
 * 인증: X-API-Key (또는 Bearer wm_live_...). 모든 응답은 API 키에 묶인 매장으로
 * 자동 스코프된다(멀티테넌트 격리). 읽기는 read, 주문 생성은 write 스코프 필요.
 *
 * 표준 응답: { data, meta } / 오류: { error, message }
 */
const router = require('express').Router();
const prisma = require('../config/prisma');
const catchAsync = require('../utils/catchAsync');
const { apiKeyAuth, requireScope } = require('../middleware/apiKeyAuth');
const { decryptPhone } = require('../utils/phoneEncryption');
const { kstDayRange } = require('../utils/kstTime');
const Order = require('../models/Order');
const { emitEvent } = require('../services/webhookDispatcher');

router.use(apiKeyAuth); // 모든 v1 라우트 API 키 필수

// 개인정보 마스킹 (Open API는 원문 전화번호 미노출)
const maskPhone = (enc) => {
    const p = decryptPhone(enc) || '';
    const d = p.replace(/\D/g, '');
    if (d.length < 8) return null;
    return `${d.slice(0, 3)}-****-${d.slice(-4)}`;
};

// ── 매장 ────────────────────────────────────────────────────────────────
router.get('/store', catchAsync(async (req, res) => {
    const s = await prisma.stores.findUnique({
        where: { id: req.apiClient.storeId },
        select: { id: true, name: true, description: true, address: true, phone: true,
                  open_time: true, close_time: true, business_type: true },
    });
    if (!s) return res.status(404).json({ error: 'not_found' });
    res.json({ data: s });
}));

// ── 메뉴 ────────────────────────────────────────────────────────────────
router.get('/menus', catchAsync(async (req, res) => {
    const products = await prisma.products.findMany({
        where: { store_id: req.apiClient.storeId },
        select: { id: true, name: true, price: true, description: true, image_url: true,
                  category_id: true, is_sold_out: true, is_popular: true, is_new: true },
        orderBy: { id: 'asc' },
    });
    res.json({ data: products, meta: { count: products.length } });
}));

// ── 주문 조회 (날짜/상태 필터) ────────────────────────────────────────────
router.get('/orders', catchAsync(async (req, res) => {
    const { status, date, limit = 50 } = req.query;
    const where = { store_id: req.apiClient.storeId };
    if (status) where.status = status.includes(',') ? { in: status.split(',') } : status;
    if (date) { const { startOfDay, endOfDay } = kstDayRange(date); where.created_at = { gte: startOfDay, lte: endOfDay }; }
    const orders = await prisma.orders.findMany({
        where,
        include: { order_items: true },
        orderBy: { created_at: 'desc' },
        take: Math.min(parseInt(limit) || 50, 200),
    });
    const data = orders.map(o => ({
        id: o.id, order_number: o.order_number, status: o.status,
        total_amount: o.total_amount, table_id: o.table_id,
        customer_phone: maskPhone(o.customer_phone),
        created_at: o.created_at,
        items: (o.order_items || []).map(i => ({ name: i.product_name, quantity: i.quantity, price: i.price })),
    }));
    res.json({ data, meta: { count: data.length } });
}));

router.get('/orders/:id', catchAsync(async (req, res) => {
    const o = await prisma.orders.findFirst({
        where: { id: parseInt(req.params.id), store_id: req.apiClient.storeId },
        include: { order_items: true },
    });
    if (!o) return res.status(404).json({ error: 'not_found' });
    res.json({ data: {
        id: o.id, order_number: o.order_number, status: o.status, total_amount: o.total_amount,
        table_id: o.table_id, customer_phone: maskPhone(o.customer_phone), created_at: o.created_at,
        items: (o.order_items || []).map(i => ({ name: i.product_name, quantity: i.quantity, price: i.price })),
    }});
}));

// ── 주문 생성 (write 스코프) ──────────────────────────────────────────────
// 외부 시스템(POS·배달·키오스크)이 매장의 실제 메뉴(product_id)를 참조해 주문 주입.
// 가격/재고는 서버가 DB 기준으로 재계산·차감하므로 클라이언트 가격 위변조 불가.
router.post('/orders', requireScope('write'), catchAsync(async (req, res) => {
    const { items, table_id, customer_phone, notes } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'invalid_request', message: 'items 배열이 필요합니다.' });
    }
    if (items.some(i => !i.product_id)) {
        return res.status(400).json({ error: 'invalid_request', message: '각 item에 매장 메뉴의 product_id가 필요합니다. GET /v1/menus로 조회하세요.' });
    }

    // 서버가 DB 가격으로 총액 산정 (Order.create가 재검증하지만 total_amount 인자 필요)
    const productIds = [...new Set(items.map(i => Number(i.product_id)))];
    const products = await prisma.products.findMany({
        where: { id: { in: productIds }, store_id: req.apiClient.storeId },
        select: { id: true, price: true },
    });
    const priceMap = Object.fromEntries(products.map(p => [p.id, p.price]));
    const invalid = productIds.filter(id => !(id in priceMap));
    if (invalid.length) {
        return res.status(400).json({ error: 'invalid_request', message: `이 매장에 존재하지 않는 product_id: ${invalid.join(', ')}` });
    }
    const total = items.reduce((s, i) => s + (priceMap[Number(i.product_id)] || 0) * (Number(i.quantity) || 1), 0);

    const order = await Order.create({
        store_id: req.apiClient.storeId,
        table_id: table_id || null,
        customer_phone: customer_phone || null,
        method: 'external',
        notes: notes || 'Open API 주문',
        total_amount: total,
        status: 'pending',
        items: items.map(i => ({ product_id: Number(i.product_id), quantity: Number(i.quantity) || 1, options: i.options || null })),
    });

    emitEvent(req.apiClient.storeId, 'order.created', {
        order_id: order.id, order_number: order.order_number, total_amount: order.total_amount, source: 'open_api',
    });
    res.status(201).json({ data: { id: order.id, order_number: order.order_number, status: order.status, total_amount: order.total_amount } });
}));

// ── 분석 요약 ─────────────────────────────────────────────────────────────
router.get('/analytics/summary', catchAsync(async (req, res) => {
    const { date } = req.query;
    const where = { store_id: req.apiClient.storeId, status: { notIn: ['cancelled'] } };
    if (date) { const { startOfDay, endOfDay } = kstDayRange(date); where.created_at = { gte: startOfDay, lte: endOfDay }; }
    const orders = await prisma.orders.findMany({ where, select: { total_amount: true } });
    const revenue = orders.reduce((s, o) => s + (o.total_amount || 0), 0);
    res.json({ data: {
        order_count: orders.length,
        revenue,
        avg_order_value: orders.length ? Math.round(revenue / orders.length) : 0,
        period: date || 'all_time',
    }});
}));

// ── 프린트 잡 (온프레미스 프린트 브리지용, write 스코프) ──────────────────────
// 브리지가 주기적으로 claim → 로컬 프린터로 payload_b64(ESC/POS) 전송 → ack.
router.post('/print/jobs/claim', requireScope('write'), catchAsync(async (req, res) => {
    const max = Math.min(parseInt(req.body?.max) || 5, 20);
    // pending 중 오래된 순으로 원자적 claim (동시 브리지 중복 방지)
    const claimed = await prisma.$queryRawUnsafe(
        `UPDATE print_jobs SET status='printing', claimed_at=NOW(), attempts=attempts+1
         WHERE id IN (
           SELECT id FROM print_jobs WHERE store_id=$1 AND status='pending'
           ORDER BY created_at ASC LIMIT $2 FOR UPDATE SKIP LOCKED
         ) RETURNING id, order_id, kind, payload_b64, attempts`,
        req.apiClient.storeId, max
    );
    res.json({ data: claimed, meta: { count: claimed.length } });
}));

router.post('/print/jobs/:id/ack', requireScope('write'), catchAsync(async (req, res) => {
    const { success, error } = req.body || {};
    const id = parseInt(req.params.id);
    if (success) {
        await prisma.$executeRawUnsafe(
            `UPDATE print_jobs SET status='done', printed_at=NOW(), error=NULL WHERE id=$1 AND store_id=$2`,
            id, req.apiClient.storeId
        );
    } else {
        // 3회 미만이면 재시도(pending 복귀), 이상이면 failed
        const rows = await prisma.$queryRawUnsafe(
            `SELECT attempts FROM print_jobs WHERE id=$1 AND store_id=$2`, id, req.apiClient.storeId
        );
        const status = (rows[0]?.attempts || 0) >= 3 ? 'failed' : 'pending';
        await prisma.$executeRawUnsafe(
            `UPDATE print_jobs SET status=$1, error=$2 WHERE id=$3 AND store_id=$4`,
            status, String(error || '').slice(0, 300), id, req.apiClient.storeId
        );
    }
    res.json({ data: { id, ok: true } });
}));

module.exports = router;
