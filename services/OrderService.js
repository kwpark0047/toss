const prisma = require('../config/prisma');
const Order = require('../repositories/Order');
const Coupon = require('../repositories/Coupon');
const Table = require('../repositories/Table');
const Product = require('../repositories/Product');
const notificationService = require('./notificationService');
const webhookDispatcher = require('./webhookDispatcher');
const printService = require('./printService');
const logger = require('../utils/logger');
const { encryptPhone, decryptPhone, normalizePhone } = require('../utils/phoneEncryption');
const { AppError } = require('../utils/errorHandler');

// Haversine formula for distance in km
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

class OrderService {
    constructor(io) {
        this.io = io;
    }

    async createOrder(data) {
        const { user_coupon_id, store_id, table_id, table_number, items, total_amount, phone, customer_phone, payment_method, method, latitude, longitude } = data;
        let discount_amount = 0;

        const Store = require('../repositories/Store');
        const store = await Store.findById(store_id);
        if (!store) {
            throw new AppError('매장을 찾을 수 없습니다.', 404);
        }

        if (table_id && latitude && longitude && store.latitude && store.longitude) {
            const distanceKm = getDistanceFromLatLonInKm(latitude, longitude, store.latitude, store.longitude);
            if (distanceKm > 0.5) {
                throw new AppError('매장 반경 500m 밖에서는 주문할 수 없습니다.', 403);
            }
        }

        // 1. 쿠폰 검증
        if (user_coupon_id) {
            const userCoupon = await Coupon.findUserCoupon(user_coupon_id);
            if (!userCoupon || userCoupon.status !== 'UNUSED') {
                throw new AppError('유효하지 않은 쿠폰입니다.', 400);
            }
            const coupon = userCoupon.coupons;
            if (coupon.type === 'FIXED') {
                discount_amount = coupon.amount;
            } else if (coupon.type === 'PERCENT') {
                discount_amount = Math.floor(total_amount * (coupon.amount / 100));
            }
            if (total_amount < coupon.min_order_amount) {
                throw new AppError(`최소 ${coupon.min_order_amount.toLocaleString()}원 이상 주문 시 사용 가능합니다.`, 400);
            }
        }

        // 2. 테이블 식별
        const storeIdNum = parseInt(store_id);
        let resolvedTableId = null;
        let resolvedTableName = null;
        let lookupStr = table_number || (table_id && isNaN(parseInt(table_id)) ? String(table_id) : null);
        if (lookupStr && lookupStr.endsWith('번')) { lookupStr = lookupStr.replace('번', ''); }

        if (lookupStr) {
            const table = await Table.findByStoreAndTable(storeIdNum, lookupStr);
            resolvedTableId = table?.id || null;
            resolvedTableName = table?.table_number || lookupStr;
        } else if (table_id && !isNaN(parseInt(table_id))) {
            resolvedTableId = parseInt(table_id);
            const table = await Table.findById(resolvedTableId);
            resolvedTableName = table?.table_number || null;
        }

        // 3. 재고 및 품절 검증
        if (items && items.length > 0) {
            const insufficient = [];
            for (const item of items) {
                if (!item.product_id) continue;
                const product = await Product.findById(item.product_id);
                if (!product) continue;
                if (product.is_sold_out) {
                    insufficient.push(`'${product.name}' 품절`);
                } else if (product.stock_quantity !== null && product.stock_quantity < (item.quantity || 1)) {
                    insufficient.push(`'${product.name}' 재고 부족 (재고 ${product.stock_quantity}개)`);
                }
            }
            if (insufficient.length > 0) {
                throw new AppError(insufficient.join(', '), 409);
            }
        }

        // 4. 주문 생성 데이터 준비
        const final_amount = Math.max(0, total_amount - discount_amount);
        const orderData = { ...data };
        orderData.method = method || payment_method;
        const rawPhone = phone || customer_phone;
        if (rawPhone) {
            orderData.customer_phone = encryptPhone(rawPhone);
        }

        // 5. 주문 생성
        const order = await Order.create({
            ...orderData,
            table_id: resolvedTableId,
            total_amount: final_amount,
            discount_amount
        });

        // 6. 후처리 (쿠폰 사용, 테이블 상태, 재고 차감, 알림)
        if (user_coupon_id) await Coupon.useCoupon(user_coupon_id, order.id);
        
        if (order.table_id) {
            await Table.update(order.table_id, { status: 'occupied' });
            if (this.io) this.io.emit('table-updated', { store_id: order.store_id, table_id: order.table_id });
        }

        // 재고 차감 및 알림 발송
        this._notifyNewOrder(order, resolvedTableName);

        return order;
    }

    async updateStatus(id, status, staff_id) {
        const orderId = parseInt(id);
        const oldOrder = await Order.findById(orderId);
        const updatedOrder = await Order.updateStatus(orderId, status, staff_id);

        // KDS 수락 시 재고 차감 및 품절 처리
        if (oldOrder && oldOrder.status === 'pending' && ['confirmed', 'preparing', 'ready', 'completed'].includes(status)) {
            await this._processInventory(updatedOrder);
        }

        if (['completed', 'ready'].includes(status) && updatedOrder.table_id) {
            await Table.update(updatedOrder.table_id, { status: 'dirty' });
            if (this.io) this.io.emit('table-updated', { store_id: updatedOrder.store_id, table_id: updatedOrder.table_id });
        }

        try {
            const sseController = require('../controllers/sseController');
            sseController.notifyOrderStatusChange(orderId, status);
        } catch (sseErr) {
            const logger = require('../utils/logger');
            logger.error(`[SSE Error] ${sseErr.message}`);
        }

        // 알림 처리
        let customerToken = updatedOrder.customer_fcm_token;
        if (updatedOrder.customer_phone) {
            const storeCustomer = await prisma.store_customers.findFirst({
                where: { store_id: updatedOrder.store_id, customer_phone: updatedOrder.customer_phone }
            });
            if (storeCustomer?.fcm_token) customerToken = storeCustomer.fcm_token;
        }

        notificationService.notifyOrderStatus(updatedOrder, status, customerToken);
        notificationService.notifyOrderStatusDB(updatedOrder, status).catch(() => {});

        if (['confirmed', 'ready', 'cancelled'].includes(status)) {
            let tName = '포장';
            if (updatedOrder.table_id) {
                const table = await prisma.tables.findUnique({
                    where: { id: updatedOrder.table_id },
                    select: { table_number: true }
                });
                if (table) tName = table.table_number;
            }
            this._sendOrderAlimtalk(updatedOrder, status, { tableName: tName }).catch(e => logger.error(e));
        }

        // 웹훅 및 소켓 전송
        webhookDispatcher.emitEvent(updatedOrder.store_id, 'order.updated', {
            order_id: updatedOrder.id, order_number: updatedOrder.order_number, status,
        });
        if (status === 'completed') {
            webhookDispatcher.emitEvent(updatedOrder.store_id, 'order.completed', {
                order_id: updatedOrder.id, order_number: updatedOrder.order_number, total_amount: updatedOrder.total_amount,
            });
        }

        if (status === 'completed') {
            this._processLoyaltyPoints(updatedOrder).catch(e => logger.error('[Loyalty Error] ' + e.message));
        }

        this._emitOrderUpdate(updatedOrder, status);
        return updatedOrder;
    }

    async cancelOrder(id, userId, userRole) {
        const orderId = parseInt(id);
        const order = await Order.findById(orderId);
        if (!order) throw new AppError('주문을 찾을 수 없습니다', 404);

        if (userRole !== 'super_admin') {
            const { getStoreRole } = require('../middleware/storeAuth');
            const role = await getStoreRole(userId, order.store_id);
            const allowed = ['owner', 'manager', 'staff', 'kitchen'];
            if (!role || !allowed.includes(role)) throw new AppError('해당 매장에 대한 권한이 없습니다.', 403);
        }

        if (order.status === 'cancelled') return { success: true, message: '이미 취소된 주문입니다.' };

        await Order.updateStatus(orderId, 'cancelled');
        // KDS 수락 이후 취소된 경우에만 재고 복구
        if (order.status !== 'pending') {
            await this._restoreInventory(orderId);
        }
        this._sendOrderAlimtalk(order, 'cancelled').catch(e => logger.error(e));

        if (this.io) {
            this.io.to(`store - ${order.store_id}`).emit('order-updated', {
                order_id: orderId, status: 'cancelled', store_id: order.store_id
            });
        }
        return { success: true, message: '주문이 취소되었습니다' };
    }

    // ── 프라이빗 헬퍼 ──────────────────────────────────────────

    async _processInventory(order) {
        const items = await prisma.order_items.findMany({
            where: { order_id: order.id },
            select: { product_id: true, quantity: true }
        });
        for (const item of items) {
            if (!item.product_id) continue;
            const result = await prisma.$transaction(async (tx) => {
                const product = await tx.products.findUnique({
                    where: { id: item.product_id },
                    select: { id: true, name: true, store_id: true, stock_quantity: true, low_stock_threshold: true }
                });
                if (!product || product.stock_quantity === null) return null;
                if (product.stock_quantity < item.quantity) {
                    await tx.products.update({ where: { id: item.product_id }, data: { is_sold_out: true } });
                    return { is_sold_out: true, name: product.name, store_id: product.store_id, productId: product.id, newQty: 0, threshold: product.low_stock_threshold };
                }
                const newQty = product.stock_quantity - item.quantity;
                const is_sold_out = newQty === 0;
                await tx.products.update({
                    where: { id: item.product_id },
                    data: { stock_quantity: newQty, is_sold_out }
                });
                await tx.stock_history.create({
                    data: {
                        product_id: item.product_id, store_id: product.store_id,
                        change: -item.quantity, qty_after: newQty,
                        reason: 'ORDER', order_id: order.id
                    }
                });
                return { is_sold_out, name: product.name, store_id: product.store_id, productId: product.id, newQty, threshold: product.low_stock_threshold };
            });
            if (result) {
                if (result.newQty <= result.threshold) {
                    notificationService.notifyLowStockDB({ id: item.product_id, stock_quantity: result.newQty }).catch(() => {});
                }
                if (this.io && result.is_sold_out) {
                    this.io.to('store - ' + result.store_id).emit('product-updated', {
                        productId: result.productId,
                        is_sold_out: true,
                        name: result.name
                    });
                }
            }
        }
    }

    async _restoreInventory(orderId) {
        const items = await prisma.order_items.findMany({
            where: { order_id: orderId },
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
                            product_id: item.product_id, store_id: product.store_id,
                            change: item.quantity, qty_after: restoredQty,
                            reason: 'CANCEL', order_id: orderId
                        }
                    });
                });
            } catch (e) {
                logger.warn(`[Inventory] 복구 실패: ${item.product_id}`, e.message);
            }
        }
    }


    async _processLoyaltyPoints(order) {
        if (!order.customer_phone) return;
        
        const phoneStr = decryptPhone(order.customer_phone);
        if (!phoneStr) return;

        // Fetch store point settings
        const settings = await prisma.store_point_settings.findUnique({
            where: { store_id: order.store_id }
        });
        
        await prisma.$transaction(async (tx) => {
            // Find or create store_customer
            let customer = await tx.store_customers.findFirst({
                where: { store_id: order.store_id, customer_phone: phoneStr }
            });
            
            if (!customer) {
                customer = await tx.store_customers.create({
                    data: {
                        store_id: order.store_id,
                        customer_phone: phoneStr,
                        visit_count: 1,
                        total_spent: order.total_amount,
                        last_visit_at: new Date()
                    }
                });
            } else {
                await tx.store_customers.update({
                    where: { id: customer.id },
                    data: {
                        visit_count: customer.visit_count + 1,
                        total_spent: customer.total_spent + order.total_amount,
                        last_visit_at: new Date()
                    }
                });
            }

            if (!settings || !settings.is_enabled) return;
            if (order.total_amount < settings.min_earn_amount) return;
            
            const earnedPoints = Math.floor(order.total_amount * ((settings.earn_rate || 0) / 100));
            if (earnedPoints <= 0) return;
            
            // Find or create user_points
            let userPoint = await tx.user_points.findFirst({
                where: { phone: phoneStr }
            });
            
            if (!userPoint) {
                userPoint = await tx.user_points.create({
                    data: {
                        phone: phoneStr,
                        total_points: earnedPoints,
                        lifetime_earned: earnedPoints,
                        lifetime_used: 0
                    }
                });
            } else {
                await tx.user_points.update({
                    where: { id: userPoint.id },
                    data: {
                        total_points: userPoint.total_points + earnedPoints,
                        lifetime_earned: userPoint.lifetime_earned + earnedPoints
                    }
                });
            }
            
            // Add point_transactions
            await tx.point_transactions.create({
                data: {
                    user_point_id: userPoint.id,
                    store_id: order.store_id,
                    order_id: order.id,
                    type: 'EARN',
                    amount: earnedPoints,
                    balance_after: (userPoint ? userPoint.total_points : 0) + earnedPoints,
                    description: `주문 적립 (${order.order_number})`,
                    expires_at: settings.expiry_days ? new Date(Date.now() + settings.expiry_days * 24 * 60 * 60 * 1000) : null
                }
            });
        });
    }

    _notifyNewOrder(order, resolvedTableName) {
        if (!this.io) return;
        const payload = {
            orderId: order.id, orderNumber: order.order_number,
            storeId: order.store_id, tableId: order.table_id,
            tableName: resolvedTableName, totalAmount: order.total_amount,
            status: order.status, itemCount: order.order_items?.length || 0,
            createdAt: order.created_at
        };
        this.io.to(`store - ${order.store_id}`).emit('new-order', payload);
        this.io.to(`kitchen - ${order.store_id}`).emit('new-order', payload);

        notificationService.notifyNewOrderDB({ ...order, table_name: resolvedTableName }).catch(() => {});
        webhookDispatcher.emitEvent(order.store_id, 'order.created', {
            order_id: order.id, order_number: order.order_number,
            total_amount: order.total_amount, table_id: order.table_id, source: 'qr',
        });
        printService.createKitchenJob(order, { tableName: resolvedTableName }).catch(() => {});
    }

    _emitOrderUpdate(order, status) {
        if (!this.io) return;
        const labels = { confirmed: '주문 확인', preparing: '조리 중', ready: '준비 완료', completed: '수령 완료', cancelled: '주문 취소' };
        const payload = {
            order_id: order.id, order_number: order.order_number, status,
            status_label: labels[status] || status,
            store_id: order.store_id, table_id: order.table_id,
            updated_at: new Date().toISOString()
        };
        this.io.to(`store - ${order.store_id}`).emit('order-updated', payload);
        this.io.to(`kitchen - ${order.store_id}`).emit('order-updated', payload);
        this.io.to(`order - ${order.id}`).emit('order-updated', payload);

        if (order.customer_phone) {
            const normalized = normalizePhone(decryptPhone(order.customer_phone));
            this.io.to(`customer-orders-${normalized}`).emit('order-status-updated', payload);
        }
    }

    async _sendOrderAlimtalk(order, status, extraData = {}) {
        try {
            if (!order.customer_phone) return;
            const phone = decryptPhone(order.customer_phone);
            if (!phone) return;

            const store = await prisma.stores.findUnique({
                where: { id: order.store_id },
                select: { name: true }
            });
            const storeName = store?.name || 'WeMarket QR 매장';
            const orderNumber = order.order_number || order.id;

            const alimtalkService = require('./AlimtalkService');

            if (status === 'confirmed') {
                await alimtalkService.sendOrderConfirmed(
                    phone,
                    storeName,
                    orderNumber,
                    order.queue_number || order.id,
                    order.total_amount
                );
            } else if (status === 'ready') {
                await alimtalkService.sendFoodReady(
                    phone,
                    storeName,
                    orderNumber,
                    extraData.tableName || '테이블'
                );
            } else if (status === 'cancelled') {
                await alimtalkService.sendOrderCancelled(
                    phone,
                    storeName,
                    orderNumber,
                    extraData.reason || '매장 사정 또는 재고 소진'
                );
            }
        } catch (error) {
            logger.error(error);
        }
    }
}

module.exports = OrderService;
