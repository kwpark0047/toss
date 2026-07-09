const TossAPI = require('../utils/toss');
const notificationUtils = require('../utils/notifications');
const prisma = require('../config/prisma');
const logger = require('../utils/logger');
const pointService = require('./PointService');
const ledgerService = require('./LedgerService');
const { AppError } = require('../utils/errorHandler');

/**
 * [PaymentService]
 * 결제 승인/취소 오케스트레이션을 담당합니다.
 * PointService, LedgerService를 호출하여 개별 도메인을 처리하고,
 * 트랜잭션 조정 및 WebSocket 알림을 관리합니다.
 */
class PaymentService {
  constructor(io) {
    this.io = io;
  }

  // ── 헬퍼: 주문번호 자동 생성 ──────────────────────────────────
  _generateOrderNumber() {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomStr = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${dateStr}-${randomStr}`;
  }

  // ── 헬퍼: 단골 고객 정보 갱신 ────────────────────────────────
  async _upsertCustomer(storeId, phone, customerName, tossUserKey, amount, tx) {
    if (!phone) return;
    await tx.store_customers.upsert({
      where: { uk_store_customer: { store_id: storeId, customer_phone: phone } },
      update: {
        customer_name: customerName || undefined,
        toss_user_key: tossUserKey || undefined,
        visit_count: { increment: 1 },
        total_spent: { increment: amount },
        last_visit_at: new Date()
      },
      create: {
        store_id: storeId,
        customer_phone: phone,
        customer_name: customerName || phone,
        toss_user_key: tossUserKey || null,
        visit_count: 1,
        total_spent: amount,
        tier: 'GENERAL'
      }
    });
  }

  // ── 헬퍼: WebSocket 알림 전송 ────────────────────────────────
  _emitNewOrder(storeId, order) {
    if (!this.io) return;
    this.io.to(`store - ${storeId}`).emit('new-order', order);
  }

  _emitPaymentSuccess(storeId, orderId, orderNumber, amount) {
    if (!this.io) return;
    this.io.to(`store - ${storeId}`).emit('payment-success', {
      order_id: orderId, order_number: orderNumber, amount
    });
  }

  _emitSplitUpdate(tableId, order, totalPaid, isFullyPaid, payer) {
    if (!this.io || !tableId) return;
    this.io.to(`table - ${tableId}`).emit('split-payment-update', {
      orderId: order.id,
      totalAmount: order.total_amount,
      paidAmount: totalPaid,
      remainingAmount: Math.max(0, order.total_amount - totalPaid),
      status: isFullyPaid ? 'COMPLETED' : 'PARTIAL',
      payer
    });
  }

  // ═════════════════════════════════════════════════════════════════
  // [현장/즉시 결제 처리 (cash, point, store_card, transfer)]
  // ═════════════════════════════════════════════════════════════════
  async processDirectPayment(paymentData) {
    const {
      store_id, items, total_amount, payment_method,
      point_amount = 0, phone, toss_user_key, customer_name
    } = paymentData;

    const result = await prisma.$transaction(async (tx) => {
      if (!items || items.length === 0) throw new AppError('주문 상품이 없습니다.', 400);

      for (const item of items) {
        const product = await tx.products.findUnique({ where: { id: item.product_id } });
        if (!product || product.store_id !== parseInt(store_id)) {
          throw new AppError(`상품 정보를 찾을 수 없습니다: ${item.product_name}`, 400);
        }
        if (product.is_sold_out) throw new AppError(`품절된 상품이 포함되어 있습니다: ${product.name}`, 409);
        if (!product.is_active) throw new AppError(`판매 중단된 상품입니다: ${product.name}`, 400);
      }

      // 주문 생성
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

      // 결제 기록 생성
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

      // 즉시완료 결제 후처리
      const IMMEDIATE_METHODS = ['cash', 'point', 'store_card', 'transfer'];
      if (IMMEDIATE_METHODS.includes(payment_method)) {
        if (point_amount > 0) {
          await pointService.use(
            order.id, payment.id, parseInt(store_id), orderNumber,
            { phone, toss_user_key }, point_amount, tx
          );
        }

        const earnPoints = await pointService.calculateEarnPoints(
          total_amount, store_id, { phone, toss_user_key }
        );
        if (earnPoints > 0) {
          await pointService.earn(
            order.id, payment.id, parseInt(store_id), orderNumber,
            phone, earnPoints, tx
          );
        }

        await ledgerService.recordIncome({
          storeId: parseInt(store_id), orderId: order.id, paymentId: payment.id,
          amount: parseInt(total_amount), method: payment_method.toUpperCase(),
          description: `결제 완료: ${orderNumber}`
        }, tx);

        await tx.orders.update({
          where: { id: order.id },
          data: {
            method: payment_method.toUpperCase(),
            payment_status: 'paid',
            status: 'paid',
            updated_at: new Date(),
            completed_at: new Date()
          }
        });

        await this._upsertCustomer(parseInt(store_id), phone, customer_name, toss_user_key, parseInt(total_amount), tx);
      }

      return { payment, order };
    });

    if (result.payment.status === 'DONE' && this.io) {
      this._emitNewOrder(store_id, result.order);
      this._emitPaymentSuccess(store_id, result.order.id, result.order.order_number, total_amount);
    }

    return {
      ...result.payment,
      order_number: result.order.order_number,
      order_id: result.order.id
    };
  }

  // ═════════════════════════════════════════════════════════════════
  // [분할 결제 처리]
  // ═════════════════════════════════════════════════════════════════
  async processSplitPayment(splitData) {
    const { order_id, amount, payer_phone, payment_method } = splitData;

    const txResult = await prisma.$transaction(async (tx) => {
      const order = await tx.orders.findUnique({
        where: { id: parseInt(order_id) },
        include: { 
          order_items: true,
          payments: { where: { status: 'DONE' } }
        }
      });
      if (!order) throw new Error('주문을 찾을 수 없습니다.');

      const currentPaid = order.payments.reduce((s, p) => s + p.amount, 0);
      const remaining = order.total_amount - currentPaid;
      const requestedAmount = parseInt(amount);

      if (requestedAmount > remaining) {
        throw new AppError(`결제 요청 금액(${requestedAmount.toLocaleString()}원)이 남은 금액(${remaining.toLocaleString()}원)을 초과합니다.`, 400);
      }

      const payment = await tx.payments.create({
        data: {
          order_id: order.id,
          store_id: order.store_id,
          order_name: `분할결제 #${order.order_number}`,
          amount: requestedAmount,
          method: (payment_method || 'CARD').toUpperCase(),
          status: 'DONE',
          payer_phone: payer_phone || null,
          is_partial: true,
          created_at: new Date(),
          updated_at: new Date(),
          approved_at: new Date()
        }
      });

      await ledgerService.recordIncome({
        storeId: order.store_id, orderId: order.id, paymentId: payment.id,
        amount: requestedAmount, method: (payment_method || 'CARD').toUpperCase(),
        description: `분할결제: #${order.order_number} (${payer_phone || '익명'})`
      }, tx);

      const totalPaid = currentPaid + requestedAmount;
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
        await this._upsertCustomer(order.store_id, payer_phone, payer_phone, null, requestedAmount, tx);
      }

      return { payment, order, totalPaid, isFullyPaid };
    });

    this._emitSplitUpdate(txResult.order.table_id, txResult.order, txResult.totalPaid, txResult.isFullyPaid, payer_phone);
    if (txResult.isFullyPaid) {
      this._emitNewOrder(txResult.order.store_id, txResult.order);
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

  // ═════════════════════════════════════════════════════════════════
  // [결제 승인 처리]
  // ═════════════════════════════════════════════════════════════════
  async processApproval(paymentKey, orderIdString, amount, customerKey) {
    if (!paymentKey || typeof paymentKey !== 'string') {
      throw new AppError('결제 키(paymentKey)가 필요합니다.', 400);
    }
    let tossResponse;
    if (paymentKey.startsWith('bp_') || customerKey) {
      tossResponse = await TossAPI.confirmBrandPay(paymentKey, orderIdString, amount, customerKey);
    } else {
      tossResponse = await TossAPI.confirmPayment(paymentKey, orderIdString, amount);
    }

    logger.info('[PaymentService] 토스 결제 승인 완료:', tossResponse.paymentKey);

    try {
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

        await ledgerService.recordIncome({
          storeId: orderData.store_id, orderId: orderData.id, paymentId: updatedPayment.id,
          amount: tossResponse.totalAmount, method: tossResponse.method,
          description: `결제 승인: ${orderData.order_number}`
        }, tx);

        await this._upsertCustomer(
          orderData.store_id, orderData.customer_phone, orderData.customer_name,
          tossResponse.customerKey || orderData.toss_user_key, tossResponse.totalAmount, tx
        );

        const earnPoints = await pointService.calculateEarnPoints(
          tossResponse.totalAmount, orderData.store_id,
          { phone: orderData.customer_phone }
        );
        let pointResult = null;
        if (earnPoints > 0 && orderData.customer_phone) {
          pointResult = await pointService.earn(
            orderData.id, updatedPayment.id, orderData.store_id, orderData.order_number,
            orderData.customer_phone, earnPoints, tx
          );
        }

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

      const { order, totalPaidAmount } = result;

      if (this.io) {
        this._emitSplitUpdate(order.table_id, order, totalPaidAmount, totalPaidAmount >= order.total_amount, tossResponse.customerKey || order.customer_phone);

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

      return { success: true, payment: tossResponse, point: result.pointResult };
    } catch (e) {
      logger.error(e);
      throw e;
    }
  }

  // ═════════════════════════════════════════════════════════════════
  // [결제 취소 처리]
  // ═════════════════════════════════════════════════════════════════
  async processCancellation(orderId, cancelReason) {
    const payment = await prisma.payments.findFirst({
      where: { order_id: parseInt(orderId), status: 'DONE' },
      orderBy: { created_at: 'desc' }
    });

    // 멱등성: 이미 취소된 결제는 재처리 없이 반환
    const alreadyCanceled = await prisma.payments.findFirst({
      where: { order_id: parseInt(orderId), status: { in: ['CANCELED', 'CANCELLED'] } }
    });
    if (alreadyCanceled) {
      logger.info('[PaymentService] 중복 취소 요청 무시 (멱등성)');
      return { success: true, message: '이미 취소 처리된 결제입니다.' };
    }

    if (!payment) {
      throw new Error('취소할 유효한 결제 내역이 없습니다.');
    }

    // 토스 취소 API 호출
    await TossAPI.cancelPayment(payment.payment_key, cancelReason || '시스템 취소');
    logger.info('[PaymentService] 토스 결제 취소 완료:', payment.payment_key);

    // DB 상태 업데이트 (트랜잭션)
    await prisma.$transaction(async (tx) => {
      await tx.payments.update({
        where: { payment_key: payment.payment_key },
        data: {
          status: 'CANCELED',
          cancelled_at: new Date(),
          cancel_reason: cancelReason,
          updated_at: new Date()
        }
      });

      await pointService.revertOnCancel(payment.id, tx);

      await ledgerService.recordRefund({
        storeId: payment.store_id, orderId: payment.order_id, paymentId: payment.id,
        amount: payment.amount, method: payment.method,
        description: `환불: ${cancelReason}`
      }, tx);

      await tx.orders.update({
        where: { id: payment.order_id },
        data: {
          payment_status: 'refunded',
          status: 'cancelled',
          updated_at: new Date()
        }
      });
    });

    // 재고 복구 (별도 트랜잭션, 취소 실패해도 결제 취소는 유지)
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
