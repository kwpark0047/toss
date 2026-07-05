const TossAPI = require('../utils/toss');
const notificationUtils = require('../utils/notifications');
const prisma = require('../config/prisma');
const logger = require('../utils/logger');

/**
 * [PaymentService]
 * 결제 승인/취소 및 관련 비즈니스 로직(장부, 포인트, 주문 상태, 알림)을 통합 관리합니다.
 * 모든 DB 접근은 Prisma Client를 통해 직접 수행합니다.
 */
class PaymentService {
    constructor(io) {
        this.io = io; // WebSocket 인스턴스 (알림용)
    }

  // ── 헬퍼: 주문번호 자동 생성 ──────────────────────────────────
  _generateOrderNumber() {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const randomStr = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      return `${dateStr}-${randomStr}`;
  }

  // ── 헬퍼: 적립 가능 포인트 계산 ──────────────────────────────
  async _calculateEarnPoints(amount, storeId, identifier) {
      const settings = await prisma.store_point_settings.findUnique({
          where: { store_id: parseInt(storeId) }
      });
      if (!settings || !settings.is_enabled) return 0;
      if (amount < settings.min_earn_amount) return 0;

      let earnRate = settings.earn_rate;

      // 고객 등급별 적립률
      if (identifier) {
          const { phone, toss_user_key } = identifier;
          const where = { store_id: parseInt(storeId) };
          if (phone) where.customer_phone = phone;
          else if (toss_user_key) where.toss_user_key = toss_user_key;

          if (Object.keys(where).length > 1) {
              const customer = await prisma.store_customers.findFirst({ where });
              if (customer && customer.tier !== 'GENERAL') {
                  const tiers = await prisma.store_tier_settings.findMany({
                      where: { store_id: parseInt(storeId) }
                  });
                  const currentTier = tiers.find(t => t.tier_name === customer.tier);
                  if (currentTier) {
                      earnRate = currentTier.earn_rate;
                  }
              }
          }
      }

      return Math.floor(amount * (earnRate / 100));
  }

  // ── 헬퍼: 포인트 사용자 조회/생성 ────────────────────────────
  async _findOrCreatePointUser(identifier, tx) {
      const { toss_user_key, phone, user_id } = identifier;
      const where = {};
      if (toss_user_key) where.toss_user_key = toss_user_key;
      else if (phone) where.phone = phone;
      else if (user_id) where.user_id = user_id;

      const db = tx || prisma;
      let user = await db.user_points.findFirst({ where });
      if (!user) {
          user = await db.user_points.create({
              data: {
                  user_id: user_id || null,
                  toss_user_key: toss_user_key || null,
                  phone: phone || null,
                  total_points: 0
              }
          });
      }
      return user;
  }

    // [현장/즉시 결제 처리 (cash, point, store_card, transfer)]
    async processDirectPayment(paymentData) {
        const {
            store_id, items, total_amount, payment_method,
            point_amount = 0, phone, toss_user_key, customer_name
        } = paymentData;

        // 1. 주문 + 결제 + 장부 + 포인트를 하나의 트랜잭션으로 처리
        const result = await prisma.$transaction(async (tx) => {
            // 1-1. 상품 유효성 검사
            if (!items || items.length === 0) throw new Error('주문 상품이 없습니다.');

            for (const item of items) {
                const product = await tx.products.findUnique({ where: { id: item.product_id } });
                if (!product || product.store_id !== parseInt(store_id)) {
                    throw new Error(`상품 정보를 찾을 수 없습니다: ${item.product_name}`);
                }
                if (product.is_sold_out) throw new Error(`품절된 상품이 포함되어 있습니다: ${product.name}`);
                if (!product.is_active) throw new Error(`판매 중단된 상품입니다: ${product.name}`);
            }

            // 1-2. 주문 생성
            const orderNumber = this._generateOrderNumber();
            const order = await tx.orders.create({
                data: {
                    store_id: parseInt(store_id),
                    order_number: orderNumber,
                    customer_phone: phone || null,
                    customer_name: customer_name || null,
                    total_amount: parseFloat(total_amount),
                    status: 'pending',
                    method: payment_method === 'mixed' ? 'card' : payment_method,
                    toss_user_key: toss_user_key || null,
                    created_at: new Date(),
                    updated_at: new Date(),
                    order_items: {
                        create: items.map(item => ({
                            product_id: item.product_id,
                            product_name: item.product_name,
                            quantity: item.quantity,
                            price: item.price,
                            subtotal: item.price * item.quantity,
                            options: item.options ? JSON.stringify(item.options) : null,
                            user_phone: item.user_phone || phone || null
                        }))
                    }
                },
                include: { order_items: true }
            });

            // 1-3. 결제 기록 생성
            const orderName = items.length > 1
                ? `${items[0].product_name} 외 ${items.length - 1}건`
                : items[0].product_name;

            const payment = await tx.payments.create({
                data: {
                    order_id: order.id,
                    store_id: parseInt(store_id),
                    order_name: orderName,
                    amount: parseInt(total_amount),
                    method: payment_method.toUpperCase(),
                    status: (payment_method === 'cash' || payment_method === 'point') ? 'DONE' : 'READY',
                    created_at: new Date(),
                    updated_at: new Date()
                }
            });

            // 1-4. 즉시완료 결제 후처리
            const IMMEDIATE_METHODS = ['cash', 'point', 'store_card', 'transfer'];
            if (IMMEDIATE_METHODS.includes(payment_method)) {
                // 포인트 사용
                if (point_amount > 0) {
                    const user = await this._findOrCreatePointUser({ phone, toss_user_key }, tx);
                    if (!user || user.total_points < point_amount) throw new Error('포인트가 부족합니다');

                    const newBalance = user.total_points - point_amount;
                    await tx.user_points.update({
                        where: { id: user.id },
                        data: { total_points: newBalance, lifetime_used: { increment: point_amount }, updated_at: new Date() }
                    });
                    await tx.point_transactions.create({
                        data: {
                            user_point_id: user.id,
                            store_id: parseInt(store_id),
                            order_id: order.id,
                            payment_id: payment.id,
                            type: 'use',
                            amount: -point_amount,
                            balance_after: newBalance,
                            description: `주문(#${order.order_number}) 포인트 사용`
                        }
                    });
                }

                // 포인트 적립
                const earnPoints = await this._calculateEarnPoints(total_amount, store_id, { phone, toss_user_key });
                if (earnPoints > 0) {
                    const user = await this._findOrCreatePointUser({ phone, toss_user_key }, tx);
                    const newBalance = user.total_points + earnPoints;
                    await tx.user_points.update({
                        where: { id: user.id },
                        data: { total_points: newBalance, lifetime_earned: { increment: earnPoints }, updated_at: new Date() }
                    });
                    await tx.point_transactions.create({
                        data: {
                            user_point_id: user.id,
                            store_id: parseInt(store_id),
                            order_id: order.id,
                            payment_id: payment.id,
                            type: 'earn',
                            amount: earnPoints,
                            balance_after: newBalance,
                            description: `주문(#${order.order_number}) 적립`,
                            expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
                        }
                    });
                }

                // 장부 기록
                await tx.ledger.create({
                    data: {
                        store_id: parseInt(store_id),
                        order_id: order.id,
                        payment_id: payment.id,
                        type: 'INCOME',
                        category: 'SALE',
                        amount: parseInt(total_amount),
                        method: payment_method.toUpperCase(),
                        description: `결제 완료: ${order.order_number}`
                    }
                });

                // 주문 상태 업데이트
                await tx.orders.update({
                    where: { id: order.id },
                    data: { method: payment_method.toUpperCase(), payment_status: 'paid', status: 'paid', updated_at: new Date(), completed_at: new Date() }
                });

                // 단골 고객 업데이트
                if (phone) {
                    await tx.store_customers.upsert({
                        where: { uk_store_customer: { store_id: parseInt(store_id), customer_phone: phone } },
                        update: {
                            customer_name: customer_name || undefined,
                            toss_user_key: toss_user_key || undefined,
                            visit_count: { increment: 1 },
                            total_spent: { increment: parseInt(total_amount) },
                            last_visit_at: new Date()
                        },
                        create: {
                            store_id: parseInt(store_id),
                            customer_phone: phone,
                            customer_name: customer_name || null,
                            toss_user_key: toss_user_key || null,
                            visit_count: 1,
                            total_spent: parseInt(total_amount),
                            tier: 'GENERAL'
                        }
                    });
                }
            }

            return { payment, order };
        });

        // 2. 실시간 알림 (트랜잭션 외부)
        if (result.payment.status === 'DONE' && this.io) {
            this.io.to(`store - ${store_id}`).emit('new-order', result.order);
            this.io.to(`store - ${store_id}`).emit('payment-success', {
                order_id: result.order.id,
                order_number: result.order.order_number,
                amount: total_amount
            });
        }

        return { ...result.payment, order_number: result.order.order_number, order_id: result.order.id };
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
        // 1. 토스 승인 API 호출
        let tossResponse;
        if (paymentKey.startsWith('bp_') || customerKey) {
            tossResponse = await TossAPI.confirmBrandPay(paymentKey, orderIdString, amount, customerKey);
        } else {
            tossResponse = await TossAPI.confirmPayment(paymentKey, orderIdString, amount);
        }

        logger.info('[PaymentService] 토스 결제 승인 완료:', tossResponse.paymentKey);

        try {
            // 모든 후처리 로직을 하나의 트랜잭션으로 통합하여 원자성 보장
            const result = await prisma.$transaction(async (tx) => {
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

                // 단골 고객 정보 갱신
                if (orderData.customer_phone) {
                    await tx.store_customers.upsert({
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
                }

                // 포인트 적립
                let pointResult = null;
                const earnPoints = await this._calculateEarnPoints(
                    tossResponse.totalAmount, orderData.store_id,
                    { phone: orderData.customer_phone }
                );

                if (earnPoints > 0 && orderData.customer_phone) {
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

                // 주문 및 분할 정산 상태 업데이트
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

                return { updatedPayment, order: orderData, totalPaidAmount, pointResult };
            });

            if (result.alreadyDone) {
                return { success: true, payment: tossResponse, message: '이미 처리된 결제' };
            }

            const { order, totalPaidAmount, pointResult } = result;

            // 비동기 알림 처리 (트랜잭션 외부)
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

                notificationUtils.sendNewOrderNotification(this.io, {
                    ...order,
                    total_amount: tossResponse.totalAmount,
                    message: `결제 완료: ${order.order_number}번 주문 (${tossResponse.totalAmount.toLocaleString()}원)`
                }, managerTokens);

                if (store.owner_phone) {
                    notificationUtils.sendAlimTalk(store.owner_phone, 'PAYMENT_COMPLETE', {
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
    async processCancellation(orderId, cancelReason) {
        // 1. 취소 대상 결제 찾기
        const payments = await prisma.payments.findMany({
            where: { order_id: parseInt(orderId) },
            orderBy: { created_at: 'desc' }
        });

        // 멱등성: 이미 취소된 결제는 재처리 없이 즉시 반환
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

        // 3. DB 상태 업데이트 + 포인트 회수/복구 + 장부 + 주문 상태 (트랜잭션)
        await prisma.$transaction(async (tx) => {
            // 3-1. 결제 상태 취소
            await tx.payments.update({
                where: { payment_key: payment.payment_key },
                data: { status: 'CANCELED', cancelled_at: new Date(), cancel_reason: cancelReason, updated_at: new Date() }
            });

            // 3-2. 주문 조회
            const order = await tx.orders.findUnique({
                where: { id: payment.order_id },
                include: { order_items: true }
            });
            if (!order) throw new Error('주문을 찾을 수 없습니다.');

            // 3-3. 포인트 회수/복구
            const pointTxs = await tx.point_transactions.findMany({
                where: { payment_id: payment.id }
            });

            for (const pt of pointTxs) {
                if (pt.type === 'earn') {
                    const user = await tx.user_points.findFirst({
                        where: { id: pt.user_point_id }
                    });
                    if (user) {
                        const newBalance = Math.max(0, user.total_points - pt.amount);
                        await tx.user_points.update({
                            where: { id: user.id },
                            data: { total_points: newBalance, lifetime_earned: { decrement: pt.amount }, updated_at: new Date() }
                        });
                        await tx.point_transactions.create({
                            data: {
                                user_point_id: user.id,
                                store_id: payment.store_id,
                                order_id: payment.order_id,
                                payment_id: payment.id,
                                type: 'cancel_earn',
                                amount: -pt.amount,
                                balance_after: newBalance,
                                description: `결제 취소(${payment.payment_key}) 포인트 회수`
                            }
                        });
                    }
                } else if (pt.type === 'use') {
                    const usedAmount = Math.abs(pt.amount);
                    const user = await tx.user_points.findFirst({
                        where: { id: pt.user_point_id }
                    });
                    if (user) {
                        const newBalance = user.total_points + usedAmount;
                        await tx.user_points.update({
                            where: { id: user.id },
                            data: { total_points: newBalance, lifetime_used: { decrement: usedAmount }, updated_at: new Date() }
                        });
                        await tx.point_transactions.create({
                            data: {
                                user_point_id: user.id,
                                store_id: payment.store_id,
                                order_id: payment.order_id,
                                payment_id: payment.id,
                                type: 'cancel_use',
                                amount: usedAmount,
                                balance_after: newBalance,
                                description: `결제 취소(${payment.payment_key}) 포인트 복구`
                            }
                        });
                    }
                }
            }

            // 3-4. 장부 기록: 환불
            await tx.ledger.create({
                data: {
                    store_id: payment.store_id,
                    order_id: payment.order_id,
                    payment_id: payment.id,
                    type: 'REFUND',
                    category: 'CANCEL',
                    amount: payment.amount,
                    method: payment.method,
                    description: `환불: ${cancelReason}`
                }
            });

            // 3-5. 주문 상태 업데이트
            await tx.orders.update({
                where: { id: payment.order_id },
                data: {
                    method: payment.method,
                    payment_status: 'refunded',
                    status: 'cancelled',
                    updated_at: new Date()
                }
            });
        });

        // 4. 재고 복구 (별도 트랜잭션, 취소 실패해도 결제 취소는 유지)
        try {
            const items = await prisma.order_items.findMany({
                where: { order_id: payment.order_id },
                select: { product_id: true, quantity: true }
            });
            for (const item of items) {
                if (!item.product_id) continue;
                const product = await prisma.products.findUnique({
                    where: { id: item.product_id },
                    select: { id: true, store_id: true, stock_quantity: true }
                });
                if (!product || product.stock_quantity === null) continue;

                const restoredQty = product.stock_quantity + item.quantity;
                await prisma.products.update({
                    where: { id: item.product_id },
                    data: { stock_quantity: restoredQty, is_sold_out: false }
                });
                await prisma.stock_history.create({
                    data: {
                        product_id: item.product_id,
                        store_id: product.store_id,
                        change: item.quantity,
                        qty_after: restoredQty,
                        reason: 'CANCEL',
                        order_id: payment.order_id
                    }
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
