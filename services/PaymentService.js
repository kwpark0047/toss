const Payment = require('../models/Payment');
const Order = require('../models/Order');
const Ledger = require('../models/Ledger');
const Point = require('../models/Point');
const StoreCustomer = require('../models/StoreCustomer');
const TossAPI = require('../utils/toss');
const notificationService = require('../utils/notifications');
const prisma = require('../config/prisma');
const logger = require('../utils/logger');

/**
 * [PaymentService]
 * 결제 승인/취소 및 관련 비즈니스 로직(장부, 포인트, 주문 상태, 알림)을 통합 관리합니다.
 */
class PaymentService {
    constructor(io) {
        this.io = io; // WebSocket 인스턴스 (알림용)
    }

    // [현장/즉시 결제 처리 (cash, point, store_card, transfer)]
    // 라우터에서 직접 처리하던 로직을 서비스 레이어로 통합
    async processDirectPayment(paymentData) {
        const {
            store_id, items, total_amount, payment_method,
            point_amount = 0, phone, toss_user_key, customer_name
        } = paymentData;

        // 1. 주문 생성
        const order = await Order.create({
            store_id,
            items,
            total_amount,
            customer_phone: phone,
            toss_user_key,
            customer_name,
            payment_method: payment_method === 'mixed' ? 'card' : payment_method,
            status: 'pending'
        });

        // 2. 결제 기록 생성
        const orderName = items.length > 1
            ? `${items[0].product_name} 외 ${items.length - 1}건`
            : items[0].product_name;

        const payment = await Payment.create({
            order_id: order.id,
            store_id,
            order_name: orderName,
            amount: total_amount,
            method: payment_method.toUpperCase(),
            status: (payment_method === 'cash' || payment_method === 'point') ? 'DONE' : 'READY'
        });

        // 3. 즉시완료 결제 처리
        const IMMEDIATE_METHODS = ['cash', 'point', 'store_card', 'transfer'];
        if (IMMEDIATE_METHODS.includes(payment_method)) {
            logger.info(`[PaymentService] 즉시 결제 처리 시작: order=${order.id}`);

            // 3-1. 포인트 사용
            if (point_amount > 0) {
                await Point.use({
                    identifier: { phone, toss_user_key },
                    store_id,
                    order_id: order.id,
                    payment_id: payment.id,
                    amount: point_amount,
                    description: `주문(#${order.order_number}) 포인트 사용`
                });
            }

            // 3-2. 포인트 적립
            const earnPoints = await Point.calculateEarnPoints(total_amount, store_id);
            if (earnPoints > 0) {
                await Point.earn({
                    identifier: { phone, toss_user_key },
                    store_id,
                    order_id: order.id,
                    payment_id: payment.id,
                    amount: earnPoints,
                    description: `주문(#${order.order_number}) 적립`
                });
            }

            // 3-3. 장부 기록
            await Ledger.add({
                store_id,
                order_id: order.id,
                payment_id: payment.id,
                type: 'INCOME',
                category: 'SALE',
                amount: total_amount,
                method: payment_method.toUpperCase(),
                description: `결제 완료: ${order.order_number}`
            });

            // 3-4. 주문 상태 업데이트
            await Order.updatePayment(order.id, payment_method.toUpperCase(), 'paid');
            await Order.updateStatus(order.id, 'paid');

            // 3-5. 단골 고객 업데이트
            await StoreCustomer.upsertCustomer({
                store_id,
                customer_phone: phone,
                customer_name,
                toss_user_key,
                amount: total_amount
            });

            // 3-6. 실시간 알림
            if (this.io) {
                this.io.to(`store - ${store_id}`).emit('new-order', order);
                this.io.to(`store - ${store_id}`).emit('payment-success', {
                    order_id: order.id,
                    order_number: order.order_number,
                    amount: total_amount
                });
            }
        }

        return { ...payment, order_number: order.order_number, order_id: order.id };
    }

    // [분할 결제 처리]
    async processSplitPayment(splitData) {
        const { order_id, amount, payer_phone, split_type: _split_type, payment_method } = splitData;

        const txResult = await prisma.$transaction(async (tx) => {
            const order = await tx.orders.findUnique({
                where: { id: parseInt(order_id) },
                include: { order_items: true }
            });
            if (!order) throw new Error('주문을 찾을 수 없습니다.');

            const payment = await tx.payments.create({
                data: {
                    order_id: order.id,
                    store_id: order.store_id,
                    order_name: `분할결제 #${order.order_number}`,
                    amount: parseInt(amount),
                    method: (payment_method || 'CARD').toUpperCase(),
                    status: 'DONE',
                    payer_phone: payer_phone || null,
                    is_partial: true,
                    created_at: new Date(),
                    updated_at: new Date(),
                    approved_at: new Date()
                }
            });

            await tx.ledger.create({
                data: {
                    store_id: order.store_id,
                    order_id: order.id,
                    payment_id: payment.id,
                    type: 'INCOME',
                    category: 'SALE',
                    amount: parseInt(amount),
                    method: (payment_method || 'CARD').toUpperCase(),
                    description: `분할결제: #${order.order_number} (${payer_phone || '익명'})`
                }
            });

            const donePayments = await tx.payments.findMany({
                where: { order_id: order.id, status: 'DONE' },
                select: { amount: true }
            });
            const totalPaid = donePayments.reduce((s, p) => s + p.amount, 0);
            const isFullyPaid = totalPaid >= order.total_amount;

            await tx.orders.update({
                where: { id: order.id },
                data: {
                    payment_status: isFullyPaid ? 'paid' : 'partial',
                    split_status: isFullyPaid ? 'COMPLETED' : 'PARTIAL',
                    status: isFullyPaid ? 'paid' : undefined,
                    updated_at: new Date()
                }
            });

            if (payer_phone) {
                await tx.store_customers.upsert({
                    where: {
                        uk_store_customer: { store_id: order.store_id, customer_phone: payer_phone }
                    },
                    update: {
                        visit_count: { increment: 1 },
                        total_spent: { increment: parseInt(amount) },
                        last_visit_at: new Date()
                    },
                    create: {
                        store_id: order.store_id,
                        customer_phone: payer_phone,
                        customer_name: payer_phone,
                        visit_count: 1,
                        total_spent: parseInt(amount),
                        tier: 'GENERAL'
                    }
                });
            }

            return { payment, order, totalPaid, isFullyPaid };
        });

        if (this.io) {
            const tableId = txResult.order.table_id;
            if (tableId) {
                this.io.to(`table - ${tableId}`).emit('split-payment-update', {
                    orderId: txResult.order.id,
                    totalAmount: txResult.order.total_amount,
                    paidAmount: txResult.totalPaid,
                    remainingAmount: Math.max(0, txResult.order.total_amount - txResult.totalPaid),
                    status: txResult.isFullyPaid ? 'COMPLETED' : 'PARTIAL',
                    payer: payer_phone || 'anonymous'
                });
            }
            if (txResult.isFullyPaid) {
                this.io.to(`store - ${txResult.order.store_id}`).emit('new-order', txResult.order);
            }
        }

        return {
            payment: txResult.payment,
            order_id: txResult.order.id,
            order_number: txResult.order.order_number,
            total_paid: txResult.totalPaid,
            is_fully_paid: txResult.isFullyPaid,
            message: txResult.isFullyPaid
                ? '분할 결제가 모두 완료되었습니다.'
                : `분할 결제 중 — ${txResult.totalPaid.toLocaleString()}원 / ${txResult.order.total_amount.toLocaleString()}원`
        };
    }

    // [결제 승인 처리]
    async processApproval(paymentKey, orderIdString, amount, customerKey) {
        // 1. 토스 승인 API 호출 (성공 시 결제키, 주문번호 등 반환)
        // 브랜드페이용 키이거나 customerKey가 있으면 브랜드페이 승인 API 호출
        let tossResponse;
        if (paymentKey.startsWith('bp_') || customerKey) {
            tossResponse = await TossAPI.confirmBrandPay(paymentKey, orderIdString, amount, customerKey);
        } else {
            tossResponse = await TossAPI.confirmPayment(paymentKey, orderIdString, amount);
        }

        logger.info('[PaymentService] 토스 결제 승인 완료:', tossResponse.paymentKey);

        try {
            // [최적화] 모든 후처리 로직을 하나의 트랜잭션으로 통합하여 원자성 보장
            const result = await prisma.$transaction(async (tx) => {
                // 2. 주문/결제 데이터 조회
                const orderData = await tx.orders.findUnique({
                    where: { order_number: orderIdString }
                });
                if (!orderData) throw new Error(`주문번호(${orderIdString})를 찾을 수 없습니다.`);

                const pendingPayment = await tx.payments.findFirst({
                    where: { order_id: orderData.id, status: 'READY' }
                });

                if (!pendingPayment) {
                    const donePayment = await tx.payments.findFirst({
                        where: { order_id: orderData.id, status: 'DONE', payment_key: paymentKey }
                    });
                    if (donePayment) return { alreadyDone: true };
                    throw new Error('결제 대기 중인(READY) 레코드를 찾을 수 없습니다.');
                }

                // 3. 결제 정보 업데이트
                const updatedPayment = await tx.payments.update({
                    where: { id: pendingPayment.id },
                    data: {
                        payment_key: paymentKey,
                        method: tossResponse.method,
                        status: 'DONE',
                        approved_at: tossResponse.approvedAt ? new Date(tossResponse.approvedAt) : new Date(),
                        receipt_url: tossResponse.receipt?.url,
                        card_company: tossResponse.card?.company,
                        card_number: tossResponse.card?.number,
                        installment_months: tossResponse.card?.installmentMonths || 0,
                        easy_pay_provider: tossResponse.easyPay?.provider,
                        raw_response: JSON.stringify(tossResponse),
                        updated_at: new Date()
                    }
                });

                // 4. 장부 기록
                await tx.ledger.create({
                    data: {
                        store_id: orderData.store_id,
                        order_id: orderData.id,
                        payment_id: updatedPayment.id,
                        type: 'INCOME',
                        category: 'SALE',
                        amount: tossResponse.totalAmount,
                        method: tossResponse.method,
                        description: `결제 승인: ${orderData.order_number}`
                    }
                });

                // 5. 단골 고객 정보 갱신
                // upsertCustomer가 내부적으로 prisma를 사용하므로 직접 tx로 구현하거나 tx 주입 필요
                // 여기서는 안정성을 위해 tx 내부에서 직접 업데이트 로직 수행
                const customer = await tx.store_customers.upsert({
                    where: { uk_store_customer: { store_id: orderData.store_id, customer_phone: orderData.customer_phone } },
                    update: {
                        visit_count: { increment: 1 },
                        total_spent: { increment: tossResponse.totalAmount },
                        last_visit_at: new Date(),
                        toss_user_key: tossResponse.customerKey || orderData.toss_user_key
                    },
                    create: {
                        store_id: orderData.store_id,
                        customer_phone: orderData.customer_phone,
                        customer_name: orderData.customer_name,
                        toss_user_key: tossResponse.customerKey,
                        visit_count: 1,
                        total_spent: tossResponse.totalAmount,
                        tier: 'GENERAL'
                    }
                });

                // 6. 포인트 적립
                let pointResult = null;
                const earnPoints = await Point.calculateEarnPoints(tossResponse.totalAmount, orderData.store_id, { phone: orderData.customer_phone });

                if (earnPoints > 0) {
                    const userPoint = await tx.user_points.upsert({
                        where: { phone: orderData.customer_phone },
                        update: {
                            total_points: { increment: earnPoints },
                            lifetime_earned: { increment: earnPoints }
                        },
                        create: {
                            phone: orderData.customer_phone,
                            total_points: earnPoints,
                            lifetime_earned: earnPoints
                        }
                    });

                    pointResult = await tx.point_transactions.create({
                        data: {
                            user_point_id: userPoint.id,
                            store_id: orderData.store_id,
                            order_id: orderData.id,
                            payment_id: updatedPayment.id,
                            type: 'earn',
                            amount: earnPoints,
                            balance_after: userPoint.total_points + earnPoints,
                            description: `주문(#${orderData.order_number}) 적립`
                        }
                    });
                }

                // 7. 주문 및 분할 정산 상태 업데이트 (집계 쿼리 최적화)
                const aggregates = await tx.payments.aggregate({
                    where: { order_id: orderData.id, status: 'DONE' },
                    _sum: { amount: true }
                });
                const totalPaidAmount = aggregates._sum.amount || 0;

                const isFullyPaid = totalPaidAmount >= orderData.total_amount;
                await tx.orders.update({
                    where: { id: orderData.id },
                    data: {
                        method: tossResponse.method,
                        payment_status: isFullyPaid ? 'paid' : 'partial',
                        split_status: orderData.is_split_payment ? (isFullyPaid ? 'COMPLETED' : 'PARTIAL') : undefined,
                        status: isFullyPaid ? 'paid' : undefined,
                        updated_at: new Date()
                    }
                });

                return { updatedPayment, order: orderData, totalPaidAmount, pointResult, customer };
            });

            if (result.alreadyDone) {
                return { success: true, payment: tossResponse, message: '이미 처리된 결제' };
            }

            const { order, totalPaidAmount, pointResult } = result;

            // 8. 비동기 알림 처리 (트랜잭션 외부에서 실행하여 응답 지연 방지)
            if (this.io) {
                if (order.table_id) {
                    this.io.to(`table - ${order.table_id}`).emit('split-payment-update', {
                        orderId: order.id,
                        totalAmount: order.total_amount,
                        paidAmount: totalPaidAmount,
                        remainingAmount: Math.max(0, order.total_amount - totalPaidAmount),
                        status: (totalPaidAmount >= order.total_amount) ? "COMPLETED" : "PARTIAL",
                        payer: tossResponse.customerKey || order.customer_phone
                    });
                }

                const store = await prisma.stores.findUnique({ where: { id: order.store_id }, include: { users: true } });
                const managerTokens = store?.users?.map(u => u.fcm_token).filter(t => t) || [];

                notificationService.sendNewOrderNotification(this.io, {
                    ...order,
                    total_amount: tossResponse.totalAmount,
                    message: `결제 완료: ${order.order_number}번 주문 (${tossResponse.totalAmount.toLocaleString()}원)`
                }, managerTokens);

                if (store.owner_phone) {
                    notificationService.sendAlimTalk(store.owner_phone, 'PAYMENT_COMPLETE', {
                        storeName: store.name,
                        amount: tossResponse.totalAmount,
                        orderNumber: order.order_number
                    });
                }
            }

            return { success: true, payment: tossResponse, point: pointResult };

        } catch (e) {
            logger.error(e);
            throw e;
        }
    }

    // [결제 취소 처리]
    async processCancellation(orderId, cancelReason, requesterInfo) {
        // 1. 취소 대상 결제 찾기
        const payments = await Payment.findByOrderId(orderId);

        // 멱등성: 이미 취소된 결제는 재처리 없이 즉시 반환 (중복 취소 방지)
        const alreadyCanceled = payments.find(p => ['CANCELED', 'CANCELLED'].includes(p.status));
        if (alreadyCanceled) {
            logger.info('[PaymentService] 중복 취소 요청 무시 (멱등성):', alreadyCanceled.payment_key);
            return { success: true, message: '이미 취소 처리된 결제입니다.' };
        }

        const payment = payments.find(p => p.status === 'DONE');
        if (!payment) {
            throw new Error('취소할 유효한 결제 내역이 없습니다.');
        }

        // 2. 토스 취소 API 호출
        await TossAPI.cancelPayment(payment.payment_key, cancelReason || '시스템 취소');
        logger.info('[PaymentService] 토스 결제 취소 완료:', payment.payment_key);

        // 3. DB 상태 업데이트
        await Payment.cancel(payment.payment_key, cancelReason);

        // 4. 포인트 회수/복구 처리
        const order = await Order.findById(payment.order_id);
        const userIdentifier = { phone: order.customer_phone, toss_user_key: order.toss_user_key };

        try {
            const pointTxs = await Point.findByPaymentId(payment.id);
            for (const tx of pointTxs) {
                if (tx.type === 'earn') {
                    await Point.cancel({
                        identifier: userIdentifier,
                        store_id: payment.store_id,
                        order_id: payment.order_id,
                        payment_id: payment.id,
                        original_type: 'earn',
                        amount: tx.amount,
                        description: `결제 취소(${payment.payment_key}) 포인트 회수`
                    });
                    logger.info(`[PaymentService] 포인트 회수 완료 (${tx.amount}P)`);
                } else if (tx.type === 'use') {
                    const usedAmount = Math.abs(tx.amount);
                    await Point.cancel({
                        identifier: userIdentifier,
                        store_id: payment.store_id,
                        order_id: payment.order_id,
                        payment_id: payment.id,
                        original_type: 'use',
                        amount: usedAmount,
                        description: `결제 취소(${payment.payment_key}) 포인트 복구`
                    });
                    logger.info(`[PaymentService] 포인트 복구 완료 (${usedAmount}P)`);
                }
            }
        } catch (e) {
            logger.warn(e);
        }

        // 5. 장부(Ledger) 기록: 환불
        Ledger.add({
            store_id: payment.store_id,
            order_id: payment.order_id,
            payment_id: payment.id,
            type: 'REFUND',
            category: 'CANCEL',
            amount: payment.amount,
            method: payment.method,
            description: `환불: ${cancelReason}`
        });

        // 6. 주문 상태 업데이트
        await Order.updatePayment(payment.order_id, payment.method, 'refunded');
        await Order.updateStatus(payment.order_id, 'cancelled');

        // 7. 재고 복구: 취소된 주문의 상품 수량을 원복
        try {
            const items = await prisma.order_items.findMany({
                where: { order_id: payment.order_id },
                select: { product_id: true, quantity: true }
            });
            for (const item of items) {
                if (!item.product_id) continue;
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
                            order_id: payment.order_id
                        }
                    });
                });
                logger.info(`[PaymentService] 재고 복구: product_id=${item.product_id}, +${item.quantity}개`);
            }
        } catch (e) {
            logger.warn('[PaymentService] 재고 복구 실패 (취소는 완료):', e.message);
        }

        return { success: true, message: '결제 취소 및 환불 처리가 완료되었습니다.' };
    }
}

module.exports = PaymentService;
