const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const authMiddleware = require('../middleware/auth');
const { checkStorePermission, getStoreRole } = require('../middleware/storeAuth');
const validate = require('../middleware/validate');
const { order: schema } = require('../utils/validationSchemas');
const notificationService = require('../services/notificationService');
const prisma = require('../config/prisma');
const catchAsync = require('../utils/catchAsync');
const logger = require('../utils/logger');
const { encryptPhone, decryptPhoneFields } = require('../utils/phoneEncryption');

// 주문 생성 (공개)
router.post('/', validate(schema.create), catchAsync(async (req, res) => {
    const { user_coupon_id } = req.body;
    let discount_amount = 0;

    if (user_coupon_id) {
        const userCoupon = await prisma.user_coupons.findUnique({
            where: { id: parseInt(user_coupon_id) },
            include: { coupons: true }
        });

        if (!userCoupon || userCoupon.status !== 'UNUSED') {
            return res.status(400).json({ error: '유효하지 않은 쿠폰입니다.' });
        }

        const coupon = userCoupon.coupons;
        if (coupon.type === 'FIXED') {
            discount_amount = coupon.amount;
        } else if (coupon.type === 'PERCENT') {
            discount_amount = Math.floor(req.body.total_amount * (coupon.amount / 100));
        }

        if (req.body.total_amount < coupon.min_order_amount) {
            return res.status(400).json({ error: `최소 ${coupon.min_order_amount.toLocaleString()}원 이상 주문 시 사용 가능합니다.` });
        }
    }

    // table_number(문자열) → table_id(정수) 변환: QR 스캔 시 URL 파라미터로 전달된 테이블 번호를 DB ID로 매핑
    const rawTableId = req.body.table_id;
    const rawTableNumber = req.body.table_number;
    let resolvedTableId = null;
    let resolvedTableName = null;

    const storeIdNum = parseInt(req.body.store_id);
    // table_number가 명시적으로 전달된 경우 우선 사용
    const lookupStr = rawTableNumber || (rawTableId && isNaN(parseInt(rawTableId)) ? String(rawTableId) : null);

    if (lookupStr) {
        const table = await prisma.tables.findFirst({
            where: { store_id: storeIdNum, table_number: lookupStr }
        });
        resolvedTableId = table?.id || null;
        resolvedTableName = table?.table_number || lookupStr;
    } else if (rawTableId && !isNaN(parseInt(rawTableId))) {
        resolvedTableId = parseInt(rawTableId);
        // 테이블 이름 조회
        const table = await prisma.tables.findUnique({ where: { id: resolvedTableId } });
        resolvedTableName = table?.table_number || null;
    }

    // 품절·재고 사전 검증 (주문 생성 전 선제 차단 — 동시성 1차 방어선)
    const itemsToValidate = req.body.items || [];
    if (itemsToValidate.length > 0) {
        const insufficient = [];
        for (const item of itemsToValidate) {
            if (!item.product_id) continue;
            const product = await prisma.products.findUnique({
                where: { id: parseInt(item.product_id) },
                select: { name: true, stock_quantity: true, is_sold_out: true }
            });
            if (!product) continue;
            if (product.is_sold_out) {
                insufficient.push(`'${product.name}' 품절`);
            } else if (product.stock_quantity !== null && product.stock_quantity < (item.quantity || 1)) {
                insufficient.push(`'${product.name}' 재고 부족 (재고 ${product.stock_quantity}개)`);
            }
        }
        if (insufficient.length > 0) {
            return res.status(409).json({ success: false, error: insufficient.join(', ') });
        }
    }

    const final_amount = Math.max(0, req.body.total_amount - discount_amount);
    const orderData = { ...req.body };
    if (orderData.phone && !orderData.customer_phone) {
        orderData.customer_phone = orderData.phone;
    }
    if (orderData.customer_phone) {
        orderData.customer_phone = encryptPhone(orderData.customer_phone);
    }
    const order = await Order.create({
        ...orderData,
        table_id: resolvedTableId,
        total_amount: final_amount,
        discount_amount
    });

    if (user_coupon_id) {
        const Coupon = require('../models/Coupon');
        await Coupon.useCoupon(user_coupon_id, order.id);
    }

    const io = req.app.get('io');

    if (order.table_id) {
        const Table = require('../models/Table');
        await Table.update(order.table_id, { status: 'occupied' });
        if (io) {
            io.emit('table-updated', { store_id: order.store_id, table_id: order.table_id });
        }
    }

    if (order && order.id) {
        const items = await prisma.order_items.findMany({
            where: { order_id: order.id },
            select: { product_id: true, quantity: true }
        });
        for (const item of items) {
            if (!item.product_id) continue;
            // 원자적 재고 차감: 트랜잭션 내에서 재고 확인 → 조건부 차감 → 이력 기록
            // stock_quantity가 부족하면 차감하지 않고 경고만 남김 (동시성 2차 방어선)
            const result = await prisma.$transaction(async (tx) => {
                const product = await tx.products.findUnique({
                    where: { id: item.product_id },
                    select: { id: true, store_id: true, stock_quantity: true, low_stock_threshold: true }
                });
                if (!product || product.stock_quantity === null) return null;
                if (product.stock_quantity < item.quantity) {
                    logger.warn(`[Orders] 재고 동시성 충돌: product_id=${item.product_id}, 재고=${product.stock_quantity}, 요청=${item.quantity}`);
                    await tx.products.update({
                        where: { id: item.product_id },
                        data: { is_sold_out: true }
                    });
                    return null;
                }
                const newQty = product.stock_quantity - item.quantity;
                await tx.products.update({
                    where: { id: item.product_id },
                    data: { stock_quantity: newQty, is_sold_out: newQty === 0 }
                });
                await tx.stock_history.create({
                    data: {
                        product_id: item.product_id,
                        store_id: product.store_id,
                        change: -item.quantity,
                        qty_after: newQty,
                        reason: 'ORDER',
                        order_id: order.id
                    }
                });
                return { newQty, threshold: product.low_stock_threshold };
            });
            if (result && result.newQty <= result.threshold) {
                notificationService.notifyLowStockDB({ id: item.product_id, stock_quantity: result.newQty })
                    .catch(err => logger.warn(`[알림 실패] 재고 부족 알림 (product ${item.product_id}): ${err.message}`));
            }
        }
    }

    // 실시간 주문 이벤트: 어드민 주문 패널 즉시 갱신용
    if (io && order && order.store_id) {
        const newOrderPayload = {
            orderId: order.id,
            orderNumber: order.order_number,
            storeId: order.store_id,
            tableId: order.table_id,
            tableName: resolvedTableName,
            totalAmount: order.total_amount,
            status: order.status,
            itemCount: order.order_items?.length || 0,
            createdAt: order.created_at
        };
        io.to(`store - ${order.store_id}`).emit('new-order', newOrderPayload);
        io.to(`kitchen - ${order.store_id}`).emit('new-order', newOrderPayload);
    }

    // DB 알림 레코드 생성 + 소켓 notification 이벤트 (알림 벨 갱신)
    if (order && order.store_id) {
        const orderWithTable = { ...order, table_name: resolvedTableName };
        notificationService.notifyNewOrderDB(orderWithTable)
            .catch(err => logger.warn(`[알림 실패] 신규 주문 알림 (order ${order.id}): ${err.message}`));
    }

    res.success(order, '주문이 생성되었습니다');
}));

// 고객 본인의 주문 내역 조회 (전화번호 또는 토스 키 기반)
router.get('/customer/history', catchAsync(async (req, res) => {
    const { phone, toss_user_key } = req.query;
    if (!phone && !toss_user_key) {
        return res.status(400).json({ error: '조회를 위한 정보가 부족합니다.' });
    }
    const orders = await Order.findByCustomer(phone, toss_user_key);
    res.success(orders);
}));

// 매장별 상세 통계 (그래프용)
router.get('/store/:storeId/detailed-stats', authMiddleware, checkStorePermission('stats:read'), catchAsync(async (req, res) => {
    const { start_date, end_date } = req.query;
    if (!start_date || !end_date) {
        return res.status(400).json({ error: '시작일과 종료일이 필요합니다' });
    }
    const stats = await Order.getDetailedStats(req.params.storeId, start_date, end_date);
    res.success(stats);
}));

// 매장별 주문 통계 (상단 카드용)
router.get('/store/:storeId/stats', authMiddleware, checkStorePermission('stats:read'), catchAsync(async (req, res) => {
    const { start_date, end_date } = req.query;
    const stats = await Order.getStats(req.params.storeId, start_date, end_date);
    res.success(stats);
}));

// 매장별 주문 목록 조회
router.get('/store/:storeId', authMiddleware, checkStorePermission('order:read'), catchAsync(async (req, res) => {
    const { status, date } = req.query;
    const orders = await Order.findByStoreId(req.params.storeId, status, date);
    const logger = require('../utils/logger');
    logger.info(`주문 목록 조회: store=${req.params.storeId}, count=${orders.length}`);
    res.success(orders);
}));

// 주문 단일 상세 조회 (ID 기반)
router.get('/:id', catchAsync(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
        return res.status(400).json({ error: '유효하지 않은 주문 ID입니다' });
    }
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ error: '주문을 찾을 수 없습니다' });
    res.success(order);
}));

// 주문 상태 업데이트
router.put('/:id/status', authMiddleware, catchAsync(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const order = await Order.findById(parseInt(id));
    if (!order) return res.status(404).json({ error: '주문을 찾을 수 없습니다' });

    const { staff_id } = req.body;
    const updatedOrder = await Order.updateStatus(parseInt(id), status, staff_id);

    if (['completed', 'ready'].includes(status) && updatedOrder.table_id) {
        const Table = require('../models/Table');
        await Table.update(updatedOrder.table_id, { status: 'dirty' });
        const io = req.app.get('io');
        if (io) {
            io.emit('table-updated', { store_id: updatedOrder.store_id, table_id: updatedOrder.table_id });
        }
    }

    const customerToken = updatedOrder.customer_fcm_token;
    notificationService.notifyOrderStatus(updatedOrder, status, customerToken);
    notificationService.notifyOrderStatusDB(updatedOrder, status)
        .catch(err => logger.warn(`[알림 실패] 주문 상태 알림 (order ${updatedOrder.id}, ${status}): ${err.message}`));

    const io = req.app.get('io');
    const STATUS_LABELS = {
        confirmed: '주문이 확인되었습니다',
        preparing: '조리 중입니다',
        ready: '준비가 완료되었습니다',
        completed: '주문이 완료되었습니다',
        cancelled: '주문이 취소되었습니다'
    };

    const orderUpdatePayload = {
        order_id: updatedOrder.id,
        order_number: updatedOrder.order_number,
        status,
        status_label: STATUS_LABELS[status] || `상태 변경: ${status}`,
        store_id: updatedOrder.store_id,
        table_id: updatedOrder.table_id,
        table_name: updatedOrder.table_name || null,
        updated_at: new Date().toISOString()
    };

    if (io) {
        // 어드민 주문 패널 즉시 갱신
        io.to(`store - ${updatedOrder.store_id}`).emit('order-updated', orderUpdatePayload);
        // 주방 디스플레이 즉시 갱신
        io.to(`kitchen - ${updatedOrder.store_id}`).emit('order-updated', orderUpdatePayload);
        // 개별 주문 추적 (고객 OrderStatusModal)
        io.to(`order - ${updatedOrder.id}`).emit('order-updated', orderUpdatePayload);

        // 전화번호 기반 고객 알림 채널
        const customerPhone = updatedOrder.customer_phone;
        if (customerPhone) {
            const { decryptPhone, normalizePhone } = require('../utils/phoneEncryption');
            const normalized = normalizePhone(decryptPhone(customerPhone));
            io.to(`customer-orders-${normalized}`).emit('order-status-updated', orderUpdatePayload);
        }
    }

    res.json({ success: true, order: updatedOrder, message: '주문 상태가 변경되었습니다' });
}));

// 주문 취소 (재고 복구 포함 — 결제 없는 주문 또는 관리자 강제 취소)
router.post('/:id/cancel', authMiddleware, catchAsync(async (req, res) => {
    const id = parseInt(req.params.id);
    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ error: '주문을 찾을 수 없습니다' });

    // 매장 접근 권한 검증 (IDOR 방지)
    if (req.user?.role !== 'super_admin') {
        const role = await getStoreRole(req.user?.id, order.store_id);
        const allowed = ['owner', 'manager', 'staff', 'kitchen'];
        if (!role || !allowed.includes(role)) {
            return res.status(403).json({ error: '해당 매장에 대한 권한이 없습니다.' });
        }
    }

    // 멱등성: 이미 취소된 주문이면 재처리 없이 반환
    if (order.status === 'cancelled') {
        return res.json({ success: true, message: '이미 취소된 주문입니다.' });
    }

    await Order.updateStatus(id, 'cancelled');

    // 재고 복구
    const items = await prisma.order_items.findMany({
        where: { order_id: id },
        select: { product_id: true, quantity: true }
    });
    for (const item of items) {
        if (!item.product_id) continue;
        try {
            await prisma.$transaction(async (tx) => {
                const product = await tx.products.findUnique({
                    where: { id: item.product_id },
                    select: { id: true, store_id: true, stock_quantity: true }
                });
                if (!product || product.stock_quantity === null) return;
                const restoredQty = product.stock_quantity + item.quantity;
                await tx.products.update({
                    where: { id: item.product_id },
                    data: { stock_quantity: restoredQty, is_sold_out: false }
                });
                await tx.stock_history.create({
                    data: {
                        product_id: item.product_id,
                        store_id: product.store_id,
                        change: item.quantity,
                        qty_after: restoredQty,
                        reason: 'CANCEL',
                        order_id: id
                    }
                });
            });
        } catch (e) {
            logger.warn(`[Orders] 취소 재고 복구 실패: product_id=${item.product_id}`, e.message);
        }
    }

    const io = req.app.get('io');
    if (io) {
        io.to(`store - ${order.store_id}`).emit('order-updated', {
            order_id: id,
            status: 'cancelled',
            store_id: order.store_id
        });
    }

    res.json({ success: true, message: '주문이 취소되었습니다.' });
}));

// 주문 삭제
router.delete('/:id', authMiddleware, catchAsync(async (req, res) => {
    await Order.delete(parseInt(req.params.id));
    res.success(null, '주문이 삭제되었습니다');
}));

module.exports = router;
