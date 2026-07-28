const TossAPI = require('../utils/toss');
const notificationUtils = require('../utils/notifications');
const prisma = require('../config/prisma');
const logger = require('../utils/logger');
const pointService = require('./PointsService');
const ledgerService = require('./LedgerService');
const alerting = require('../utils/alerting');
const { AppError } = require('../utils/errorHandler');

/**
 * PG가 승인한 금액과 서버가 기대한 금액이 어긋났을 때 발생.
 * 트랜잭션을 롤백시키고 상위에서 PG 자동 취소를 유발한다.
 */
class PaymentAmountMismatchError extends AppError {
  constructor(expected, actual, orderNumber) {
    super('결제 승인 금액이 주문 금액과 일치하지 않아 결제를 취소했습니다.', 409);
    this.name = 'PaymentAmountMismatchError';
    this.expected = Number(expected);
    this.actual = Number(actual);
    this.orderNumber = orderNumber;
  }
}

function maskCardNumber(cardNumber) {
  if (!cardNumber) return null;
  const digits = cardNumber.replace(/\D/g, '');
  const lastFour = digits.slice(-4);
  return `****-****-****-${lastFour}`;
}

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
    const randomStr = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');
    return `${dateStr}-${randomStr}`;
  }

  // ── 헬퍼: 단골 고객 정보 갱신 (StoreCustomer.upsertCustomer 위임 — tier 계산 + 캠페인 포함) ──
  async _upsertCustomer(storeId, phone, customerName, tossUserKey, amount, tx) {
    if (!phone) return;
    const StoreCustomer = require('../repositories/StoreCustomer');
    await StoreCustomer.upsertCustomer(
      {
        store_id: storeId,
        customer_phone: phone,
        customer_name: customerName,
        toss_user_key: tossUserKey,
        amount,
      },
      tx
    );
  }

  // ── 헬퍼: WebSocket 알림 전송 ────────────────────────────────
  _emitNewOrder(storeId, order) {
    if (!this.io) return;
    this.io.to(`store - ${storeId}`).emit('new-order', order);
  }

  _emitPaymentSuccess(storeId, orderId, orderNumber, amount) {
    if (!this.io) return;
    this.io.to(`store - ${storeId}`).emit('payment-success', {
      order_id: orderId,
      order_number: orderNumber,
      amount,
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
      payer,
    });
  }

  // ═════════════════════════════════════════════════════════════════
  // [현장/즉시 결제 처리 (cash, point, store_card, transfer)]
  // ═════════════════════════════════════════════════════════════════
  async processDirectPayment(paymentData) {
    const {
      store_id,
      items,
      total_amount,
      payment_method,
      point_amount = 0,
      phone,
      toss_user_key,
      customer_name,
    } = paymentData;

    const result = await prisma.$transaction(async (tx) => {
      if (!items || items.length === 0) throw new AppError('주문 상품이 없습니다.', 400);

      for (const item of items) {
        const product = await tx.products.findUnique({ where: { id: item.product_id } });
        if (!product || product.store_id !== parseInt(store_id)) {
          throw new AppError(`상품 정보를 찾을 수 없습니다: ${item.product_name}`, 400);
        }
        if (product.is_sold_out)
          throw new AppError(`품절된 상품이 포함되어 있습니다: ${product.name}`, 409);
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
            create: items.map((item) => ({
              product_id: item.product_id,
              product_name: item.product_name,
              quantity: item.quantity,
              price: item.price,
              subtotal: item.price * item.quantity,
              options: item.options ? JSON.stringify(item.options) : null,
              user_phone: item.user_phone || phone || null,
            })),
          },
        },
        include: { order_items: true },
      });

      // 결제 기록 생성
      const orderName =
        items.length > 1
          ? `${items[0].product_name} 외 ${items.length - 1}건`
          : items[0].product_name;

      const payment = await tx.payments.create({
        data: {
          order_id: order.id,
          store_id: parseInt(store_id),
          order_name: orderName,
          amount: parseInt(total_amount),
          method: payment_method.toUpperCase(),
          status: payment_method === 'cash' || payment_method === 'point' ? 'DONE' : 'READY',
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      // 즉시완료 결제 후처리
      const IMMEDIATE_METHODS = ['cash', 'point', 'store_card', 'transfer'];
      if (IMMEDIATE_METHODS.includes(payment_method)) {
        if (point_amount > 0) {
          await pointService.use(
            order.id,
            payment.id,
            parseInt(store_id),
            orderNumber,
            { phone, toss_user_key },
            point_amount,
            tx
          );
        }

        const earnPoints = await pointService.calculateEarnPoints(total_amount, store_id, {
          phone,
          toss_user_key,
        });
        if (earnPoints > 0) {
          await pointService.earn(
            order.id,
            payment.id,
            parseInt(store_id),
            orderNumber,
            phone,
            earnPoints,
            tx
          );
        }

        await ledgerService.recordIncome(
          {
            storeId: parseInt(store_id),
            orderId: order.id,
            paymentId: payment.id,
            amount: parseInt(total_amount),
            method: payment_method.toUpperCase(),
            description: `결제 완료: ${orderNumber}`,
          },
          tx
        );

        await tx.orders.update({
          where: { id: order.id },
          data: {
            method: payment_method.toUpperCase(),
            payment_status: 'paid',
            status: 'paid',
            updated_at: new Date(),
            completed_at: new Date(),
          },
        });

        await this._upsertCustomer(
          parseInt(store_id),
          phone,
          customer_name,
          toss_user_key,
          parseInt(total_amount),
          tx
        );
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
      order_id: result.order.id,
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
          payments: { where: { status: 'DONE' } },
        },
      });
      if (!order) throw new Error('주문을 찾을 수 없습니다.');

      const currentPaid = order.payments.reduce((s, p) => s + p.amount, 0);
      const remaining = order.total_amount - currentPaid;
      const requestedAmount = parseInt(amount);

      if (requestedAmount > remaining) {
        throw new AppError(
          `결제 요청 금액(${requestedAmount.toLocaleString()}원)이 남은 금액(${remaining.toLocaleString()}원)을 초과합니다.`,
          400
        );
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
          approved_at: new Date(),
        },
      });

      await ledgerService.recordIncome(
        {
          storeId: order.store_id,
          orderId: order.id,
          paymentId: payment.id,
          amount: requestedAmount,
          method: (payment_method || 'CARD').toUpperCase(),
          description: `분할결제: #${order.order_number} (${payer_phone || '익명'})`,
        },
        tx
      );

      const totalPaid = currentPaid + requestedAmount;
      const isFullyPaid = totalPaid >= order.total_amount;

      await tx.orders.update({
        where: { id: order.id },
        data: {
          payment_status: isFullyPaid ? 'paid' : 'partial',
          split_status: isFullyPaid ? 'COMPLETED' : 'PARTIAL',
          status: isFullyPaid ? 'paid' : undefined,
          updated_at: new Date(),
        },
      });

      if (payer_phone) {
        await this._upsertCustomer(
          order.store_id,
          payer_phone,
          payer_phone,
          null,
          requestedAmount,
          tx
        );
      }

      return { payment, order, totalPaid, isFullyPaid };
    });

    this._emitSplitUpdate(
      txResult.order.table_id,
      txResult.order,
      txResult.totalPaid,
      txResult.isFullyPaid,
      payer_phone
    );
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
        : `분할 결제 중 — ${txResult.totalPaid.toLocaleString()}원 / ${txResult.order.total_amount.toLocaleString()}원`,
    };
  }

  // ═════════════════════════════════════════════════════════════════
  // [결제 승인 처리]
  // ═════════════════════════════════════════════════════════════════
  /**
   * 승인 대상 READY 결제 레코드를 조회하고, 클라이언트가 보낸 금액이
   * 서버가 생성한 READY 레코드 금액과 일치하는지 **토스 호출 전에** 검증한다.
   * (금액 변조 요청이 PG까지 도달하는 것 자체를 차단)
   */
  async _assertRequestedAmount(orderIdString, amount) {
    const requested = Number(amount);
    if (!Number.isInteger(requested) || requested <= 0) {
      throw new AppError('결제 금액이 올바르지 않습니다.', 400);
    }

    const orderData = await prisma.orders.findUnique({ where: { order_number: orderIdString } });
    if (!orderData) return { requested, order: null, pendingPayment: null };

    const pendingPayment = await prisma.payments.findFirst({
      where: { order_id: orderData.id, status: 'READY' },
    });
    if (!pendingPayment) return { requested, order: orderData, pendingPayment: null };

    if (Number(pendingPayment.amount) !== requested) {
      logger.error(
        `[PaymentService] 결제 금액 변조 의심 — order=${orderIdString} ` +
          `expected=${pendingPayment.amount} requested=${requested}`
      );
      alerting
        .send({
          level: 'critical',
          title: '결제 금액 불일치 차단',
          message: `주문 ${orderIdString}: READY ${pendingPayment.amount}원 ≠ 요청 ${requested}원`,
          meta: { orderNumber: orderIdString, expected: pendingPayment.amount, requested },
        })
        .catch(() => {});
      throw new AppError('결제 금액이 주문 정보와 일치하지 않습니다.', 400);
    }

    return { requested, order: orderData, pendingPayment };
  }

  async processApproval(paymentKey, orderIdString, amount, customerKey) {
    if (!paymentKey || typeof paymentKey !== 'string') {
      throw new AppError('결제 키(paymentKey)가 필요합니다.', 400);
    }

    // [1차 방어] PG 호출 전 서버 기준 금액과 대조 (변조 요청 조기 차단)
    await this._assertRequestedAmount(orderIdString, amount);

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
          where: { order_number: orderIdString },
        });
        if (!orderData) throw new Error(`주문번호(${orderIdString})를 찾을 수 없습니다.`);

        const pendingPayment = await tx.payments.findFirst({
          where: { order_id: orderData.id, status: 'READY' },
        });

        if (!pendingPayment) {
          const donePayment = await tx.payments.findFirst({
            where: { order_id: orderData.id, status: 'DONE', payment_key: paymentKey },
          });
          if (donePayment) return { alreadyDone: true };
          throw new Error('결제 대기 중인(READY) 레코드를 찾을 수 없습니다.');
        }

        // [2차 방어 — 최종 권위] PG가 실제로 승인한 금액과 READY 금액을 대조한다.
        // 여기서 어긋나면 승인은 났지만 장부에 반영하면 안 되므로 트랜잭션을 되돌리고
        // 상위에서 자동 취소를 시도한다.
        const approvedAmount = Number(tossResponse.totalAmount);
        if (!Number.isFinite(approvedAmount) || approvedAmount !== Number(pendingPayment.amount)) {
          throw new PaymentAmountMismatchError(
            pendingPayment.amount,
            tossResponse.totalAmount,
            orderIdString
          );
        }

        const updatedPayment = await tx.payments.update({
          where: { id: pendingPayment.id },
          data: {
            payment_key: paymentKey,
            method: tossResponse.method,
            status: 'DONE',
            // PG가 승인한 실제 금액으로 동기화 (집계·정산의 단일 진실)
            amount: approvedAmount,
            approved_at: tossResponse.approvedAt ? new Date(tossResponse.approvedAt) : new Date(),
            receipt_url: tossResponse.receipt?.url,
            card_company: tossResponse.card?.company,
            card_number: maskCardNumber(tossResponse.card?.number),
            installment_months: tossResponse.card?.installmentMonths || 0,
            easy_pay_provider: tossResponse.easyPay?.provider,
            raw_response: JSON.stringify(tossResponse),
            updated_at: new Date(),
          },
        });

        await ledgerService.recordIncome(
          {
            storeId: orderData.store_id,
            orderId: orderData.id,
            paymentId: updatedPayment.id,
            amount: tossResponse.totalAmount,
            method: tossResponse.method,
            description: `결제 승인: ${orderData.order_number}`,
          },
          tx
        );

        await this._upsertCustomer(
          orderData.store_id,
          orderData.customer_phone,
          orderData.customer_name,
          tossResponse.customerKey || orderData.toss_user_key,
          tossResponse.totalAmount,
          tx
        );

        const earnPoints = await pointService.calculateEarnPoints(
          tossResponse.totalAmount,
          orderData.store_id,
          { phone: orderData.customer_phone }
        );
        let pointResult = null;
        if (earnPoints > 0 && orderData.customer_phone) {
          pointResult = await pointService.earn(
            orderData.id,
            updatedPayment.id,
            orderData.store_id,
            orderData.order_number,
            orderData.customer_phone,
            earnPoints,
            tx
          );
        }

        const aggregates = await tx.payments.aggregate({
          where: { order_id: orderData.id, status: 'DONE' },
          _sum: { amount: true },
        });
        const totalPaidAmount = aggregates._sum.amount || 0;
        const isFullyPaid = totalPaidAmount >= orderData.total_amount;

        await tx.orders.update({
          where: { id: orderData.id },
          data: {
            method: tossResponse.method,
            payment_status: isFullyPaid ? 'paid' : 'partial',
            split_status: orderData.is_split_payment
              ? isFullyPaid
                ? 'COMPLETED'
                : 'PARTIAL'
              : undefined,
            status: isFullyPaid ? 'paid' : undefined,
            updated_at: new Date(),
          },
        });

        return { updatedPayment, order: orderData, totalPaidAmount, pointResult };
      });

      if (result.alreadyDone) {
        return { success: true, payment: tossResponse, message: '이미 처리된 결제' };
      }

      const { order, totalPaidAmount } = result;

      if (this.io) {
        this._emitSplitUpdate(
          order.table_id,
          order,
          totalPaidAmount,
          totalPaidAmount >= order.total_amount,
          tossResponse.customerKey || order.customer_phone
        );

        const store = await prisma.stores.findUnique({
          where: { id: order.store_id },
          include: { users: true },
        });
        const managerTokens = store?.users?.map((u) => u.fcm_token).filter((t) => t) || [];

        notificationUtils.sendNewOrderNotification(
          this.io,
          {
            ...order,
            total_amount: tossResponse.totalAmount,
            message: `결제 완료: ${order.order_number}번 주문 (${tossResponse.totalAmount.toLocaleString()}원)`,
          },
          managerTokens
        );

        if (store.owner_phone) {
          notificationUtils.sendAlimTalk(store.owner_phone, 'PAYMENT_COMPLETE', {
            storeName: store.name,
            amount: tossResponse.totalAmount,
            orderNumber: order.order_number,
          });
        }
      }

      // 실시간 매출 변동성 수치 감사 및 위기 비상경보 엔진 비동기 백그라운드 가동 (결제 처리 레이턴시 영향 원천 차단)
      const AnomalyDetectionService = require('./AnomalyDetectionService');
      setImmediate(async () => {
        try {
          await AnomalyDetectionService.checkSalesAnomaly(order.store_id, this.io);
        } catch (err) {
          logger.error(`[PaymentService Anomaly Audit] Failure: ${err.message}`);
        }
      });

      return { success: true, payment: tossResponse, point: result.pointResult };
    } catch (e) {
      // 금액 불일치: PG에서는 승인이 났으나 장부 반영을 거부한 상태 →
      // 고객 돈이 묶이지 않도록 즉시 자동 취소를 시도하고 critical 알림을 보낸다.
      if (e instanceof PaymentAmountMismatchError) {
        logger.error(
          `[PaymentService] 승인 금액 불일치 — order=${e.orderNumber} ` +
            `expected=${e.expected} approved=${e.actual} → 자동 취소 시도`
        );
        let autoCanceled = false;
        try {
          await TossAPI.cancelPayment(paymentKey, '승인 금액 불일치 자동 취소');
          autoCanceled = true;
          logger.warn(`[PaymentService] 금액 불일치 결제 자동 취소 완료: ${paymentKey}`);
        } catch (cancelErr) {
          logger.error(`[PaymentService] 자동 취소 실패 (수동 처리 필요): ${cancelErr.message}`);
        }
        alerting
          .send({
            level: 'critical',
            title: autoCanceled
              ? '결제 금액 불일치 — 자동 취소됨'
              : '결제 금액 불일치 — 자동 취소 실패(수동 확인 필요)',
            message: `주문 ${e.orderNumber} / 기대 ${e.expected}원 / 실제 승인 ${e.actual}원 / paymentKey=${paymentKey}`,
            meta: {
              orderNumber: e.orderNumber,
              expected: e.expected,
              actual: e.actual,
              paymentKey,
              autoCanceled,
            },
          })
          .catch(() => {});
      }
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
      orderBy: { created_at: 'desc' },
    });

    // 멱등성: 이미 취소된 결제는 재처리 없이 반환
    const alreadyCanceled = await prisma.payments.findFirst({
      where: { order_id: parseInt(orderId), status: { in: ['CANCELED', 'CANCELLED'] } },
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
          updated_at: new Date(),
        },
      });

      await pointService.revertOnCancel(payment.id, tx);

      await ledgerService.recordRefund(
        {
          storeId: payment.store_id,
          orderId: payment.order_id,
          paymentId: payment.id,
          amount: payment.amount,
          method: payment.method,
          description: `환불: ${cancelReason}`,
        },
        tx
      );

      await tx.orders.update({
        where: { id: payment.order_id },
        data: {
          payment_status: 'refunded',
          status: 'cancelled',
          updated_at: new Date(),
        },
      });
    });

    // 재고 복구 (별도 트랜잭션, 취소 실패해도 결제 취소는 유지)
    try {
      const items = await prisma.order_items.findMany({
        where: { order_id: payment.order_id },
        select: { product_id: true, quantity: true },
      });
      for (const item of items) {
        if (!item.product_id) continue;
        const product = await prisma.products.findUnique({
          where: { id: item.product_id },
          select: { id: true, store_id: true, stock_quantity: true },
        });
        if (!product || product.stock_quantity === null) continue;

        const restoredQty = product.stock_quantity + item.quantity;
        await prisma.products.update({
          where: { id: item.product_id },
          data: { stock_quantity: restoredQty, is_sold_out: false },
        });
        await prisma.stock_history.create({
          data: {
            product_id: item.product_id,
            store_id: product.store_id,
            change: item.quantity,
            qty_after: restoredQty,
            reason: 'CANCEL',
            order_id: payment.order_id,
          },
        });
        logger.info(
          `[PaymentService] 재고 복구: product_id=${item.product_id}, +${item.quantity}개`
        );
      }
    } catch (e) {
      logger.warn('[PaymentService] 재고 복구 실패 (취소는 완료):', e.message);
    }

    return { success: true, message: '결제 취소 및 환불 처리가 완료되었습니다.' };
  }

  // ═════════════════════════════════════════════════════════════════
  // [결제 준비]
  // ═════════════════════════════════════════════════════════════════
  async preparePayment({ order_id, store_id, order_name, amount, method, checkout_url }) {
    let targetStoreId = store_id;
    let targetAmount = amount;

    if ((!targetStoreId || !targetAmount) && order_id) {
      const order = await prisma.orders.findUnique({ where: { id: parseInt(order_id) } });
      if (order) {
        if (!targetStoreId) targetStoreId = order.store_id;
        if (!targetAmount) targetAmount = order.total_amount;
      }
    }

    if (!targetStoreId) throw new AppError('매장 ID가 필요합니다.', 400);
    if (!targetAmount) throw new AppError('금액이 필요합니다.', 400);

    const payment = await prisma.payments.create({
      data: {
        order_id: order_id ? parseInt(order_id) : null,
        store_id: parseInt(targetStoreId),
        order_name: order_name || `주문 #${order_id}`,
        amount: parseInt(targetAmount),
        method: method || 'CARD',
        status: 'READY',
        checkout_url: checkout_url || null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    return { paymentId: payment.id };
  }

  // ═════════════════════════════════════════════════════════════════
  // [부분 환불 처리]
  // ═════════════════════════════════════════════════════════════════
  async processPartialCancel(orderId, cancelAmount, cancelReason) {
    const amount = Number(cancelAmount);
    if (!amount || amount <= 0) throw new AppError('환불 금액이 올바르지 않습니다.', 400);

    const payments = await prisma.payments.findMany({
      where: { order_id: parseInt(orderId) },
    });
    const payment = payments.find((p) => p.status === 'DONE');
    if (!payment) throw new AppError('취소 가능한 결제 내역이 없습니다.', 404);

    if (amount > payment.amount) {
      throw new AppError(
        `환불 금액(${amount.toLocaleString()}원)이 결제 금액(${payment.amount.toLocaleString()}원)을 초과합니다.`,
        400
      );
    }

    const tossResponse = await TossAPI.cancelPayment(
      payment.payment_key,
      cancelReason || '부분 환불',
      amount
    );
    logger.info(`[PaymentService] 부분 환불 완료: orderId=${orderId}, amount=${amount}`);

    await prisma.ledger.create({
      data: {
        store_id: payment.store_id,
        order_id: payment.order_id,
        payment_id: payment.id,
        type: 'REFUND',
        category: 'PARTIAL_CANCEL',
        amount: -amount,
        method: payment.method,
        description: `부분 환불: ${cancelReason || '부분 환불'} (${amount.toLocaleString()}원)`,
        created_at: new Date(),
      },
    });

    return { refundedAmount: amount, tossResponse };
  }

  // ═════════════════════════════════════════════════════════════════
  // [Toss 웹훅 처리]
  // ═════════════════════════════════════════════════════════════════
  async handleTossWebhook(event) {
    const eventType = event?.eventType;
    const data = event?.data;

    if (eventType !== 'PAYMENT_STATUS_CHANGED' || data?.status !== 'DONE') return;

    const { paymentKey, orderId: tossOrderId } = data;
    const order = await prisma.orders.findFirst({ where: { order_number: tossOrderId } });

    if (!order) {
      logger.warn(`[Webhook/Toss] 망취소 감지: paymentKey=${paymentKey}, orderId=${tossOrderId}`);
      try {
        await TossAPI.cancelPayment(paymentKey, '토스측 오류: 주문 미생성으로 인한 자동 취소');
        logger.info(`[Webhook/Toss] 망취소 완료: ${paymentKey}`);
      } catch (e) {
        logger.error(`[Webhook/Toss] 망취소 API 실패: ${e.message}`);
      }
    } else {
      try {
        logger.info(`[Webhook/Toss] 결제 승인 처리 (Webhook): orderId=${tossOrderId}`);
        const result = await this.processApproval(
          paymentKey,
          tossOrderId,
          data.totalAmount,
          data.customerKey
        );
        if (result.alreadyDone) {
          logger.info(`[Webhook/Toss] 이미 처리된 결제: orderId=${tossOrderId}`);
        } else {
          logger.info(`[Webhook/Toss] 결제 승인 완료: orderId=${tossOrderId}`);
        }
      } catch (e) {
        logger.error(`[Webhook/Toss] processApproval 실패: ${e.message}`);
      }
    }
  }

  // ═════════════════════════════════════════════════════════════════
  // [매장카드 결제 확인]
  // ═════════════════════════════════════════════════════════════════
  async confirmStoreCard(orderId, terminalReceiptNo) {
    const order = await prisma.orders.findUnique({ where: { id: parseInt(orderId) } });
    if (!order) throw new AppError('주문을 찾을 수 없습니다.', 404);
    if (order.payment_status === 'paid') return { alreadyPaid: true };

    const { decryptPhone } = require('../utils/phoneEncryption');
    const plainPhone = order.customer_phone ? decryptPhone(order.customer_phone) : null;

    await prisma.$transaction(async (tx) => {
      await tx.payments.updateMany({
        where: { order_id: parseInt(orderId), method: { in: ['STORE_CARD', 'store_card'] } },
        data: {
          status: 'DONE',
          approved_at: new Date(),
          transfer_reference: terminalReceiptNo || null,
        },
      });
      await tx.orders.update({
        where: { id: parseInt(orderId) },
        data: { payment_status: 'paid', updated_at: new Date() },
      });
      await tx.ledger.create({
        data: {
          store_id: order.store_id,
          order_id: parseInt(orderId),
          type: 'INCOME',
          category: 'SALE',
          amount: order.total_amount,
          method: 'STORE_CARD',
          description: `매장카드 확인: #${order.order_number}${terminalReceiptNo ? ` (영수증${terminalReceiptNo})` : ''}`,
          created_at: new Date(),
        },
      });
      if (plainPhone) {
        await this._upsertCustomer(
          order.store_id,
          plainPhone,
          order.customer_name,
          null,
          order.total_amount,
          tx
        );
      }
    });

    if (this.io) {
      this.io
        .to(`store - ${order.store_id}`)
        .emit('payment-confirmed', { order_id: parseInt(orderId), method: 'store_card' });
    }

    return { store_id: order.store_id, order_id: parseInt(orderId) };
  }

  // ═════════════════════════════════════════════════════════════════
  // [계좌이체 확인]
  // ═════════════════════════════════════════════════════════════════
  async confirmTransfer(orderId, transferReference, depositorName) {
    const order = await prisma.orders.findUnique({ where: { id: parseInt(orderId) } });
    if (!order) throw new AppError('주문을 찾을 수 없습니다.', 404);
    if (order.payment_status === 'paid') return { alreadyPaid: true };

    const { decryptPhone } = require('../utils/phoneEncryption');
    const plainPhone = order.customer_phone ? decryptPhone(order.customer_phone) : null;

    await prisma.$transaction(async (tx) => {
      await tx.payments.updateMany({
        where: { order_id: parseInt(orderId), method: { in: ['TRANSFER', 'transfer'] } },
        data: {
          status: 'DONE',
          transfer_confirmed: true,
          transfer_confirmed_at: new Date(),
          transfer_reference: transferReference || null,
          approved_at: new Date(),
        },
      });
      await tx.orders.update({
        where: { id: parseInt(orderId) },
        data: { payment_status: 'paid', updated_at: new Date() },
      });
      await tx.ledger.create({
        data: {
          store_id: order.store_id,
          order_id: parseInt(orderId),
          type: 'INCOME',
          category: 'SALE',
          amount: order.total_amount,
          method: 'TRANSFER',
          description: `계좌이체 확인: #${order.order_number}${depositorName ? ` (입금자: ${depositorName})` : ''}`,
          created_at: new Date(),
        },
      });
      if (plainPhone) {
        await this._upsertCustomer(
          order.store_id,
          plainPhone,
          order.customer_name,
          null,
          order.total_amount,
          tx
        );
      }
    });

    if (this.io) {
      this.io
        .to(`store - ${order.store_id}`)
        .emit('payment-confirmed', { order_id: parseInt(orderId), method: 'transfer' });
    }

    return { store_id: order.store_id, order_id: parseInt(orderId) };
  }

  // ═════════════════════════════════════════════════════════════════
  // [분할 결제 설정]
  // ═════════════════════════════════════════════════════════════════
  async setupSplitPayment(orderId, splitType, numPeople) {
    const order = await prisma.orders.findUnique({
      where: { id: parseInt(orderId) },
      include: { order_items: true },
    });
    if (!order) throw new AppError('주문이 존재하지 않습니다.', 404);

    const splitData = {
      order_id: order.id,
      total_amount: order.total_amount,
      split_type: splitType,
      items: [],
    };

    if (splitType === 'EQUAL') {
      const amountPerPerson = Math.floor(order.total_amount / numPeople);
      const lastPersonExtra = order.total_amount % numPeople;
      for (let i = 0; i < numPeople; i++) {
        splitData.items.push({
          index: i + 1,
          amount: i === numPeople - 1 ? amountPerPerson + lastPersonExtra : amountPerPerson,
          status: 'PENDING',
        });
      }
    } else if (splitType === 'ITEM') {
      splitData.items = order.order_items.map((item) => ({
        id: item.id,
        name: item.product_name,
        amount: item.subtotal,
        status: 'PENDING',
      }));
    }

    await prisma.orders.update({
      where: { id: order.id },
      data: { is_split_payment: true, split_type: splitType, split_status: 'PENDING' },
    });

    return splitData;
  }

  // ═════════════════════════════════════════════════════════════════
  // [분할 결제 상태 조회]
  // ═════════════════════════════════════════════════════════════════
  async getSplitStatus(orderId) {
    const order = await prisma.orders.findUnique({
      where: { id: parseInt(orderId) },
      include: {
        payments: {
          where: { status: 'DONE' },
          select: { amount: true, payer_phone: true, method: true, approved_at: true },
        },
      },
    });
    if (!order) throw new AppError('주문을 찾을 수 없습니다.', 404);

    const totalPaid = order.payments.reduce((sum, p) => sum + p.amount, 0);
    const remaining = Math.max(0, order.total_amount - totalPaid);

    return {
      order_id: order.id,
      order_number: order.order_number,
      total_amount: order.total_amount,
      total_paid: totalPaid,
      remaining_amount: remaining,
      is_completed: remaining === 0,
      payments: order.payments,
    };
  }

  // ═════════════════════════════════════════════════════════════════
  // [증빙 업로드 처리]
  // ═════════════════════════════════════════════════════════════════
  async processProofUpload(paymentId, proofUrl) {
    await prisma.payments.update({
      where: { id: parseInt(paymentId) },
      data: { proof_image_url: proofUrl, updated_at: new Date() },
    });

    const payment = await prisma.payments.findUnique({ where: { id: parseInt(paymentId) } });
    if (payment && this.io) {
      this.io.to(`store - ${payment.store_id}`).emit('payment-proof-uploaded', {
        payment_id: paymentId,
        order_id: payment.order_id,
        proof_url: proofUrl,
        timestamp: new Date().toISOString(),
      });
    }

    return { proof_url: proofUrl };
  }
}

module.exports = PaymentService;
module.exports.PaymentAmountMismatchError = PaymentAmountMismatchError;
