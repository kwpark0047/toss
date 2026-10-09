const crypto = require('crypto');
const { AppError } = require('../utils/errorHandler');

// Durable intent -> PG effect -> atomic local settlement. Never infer failure from a timeout.
class RefundService {
  constructor({ db, provider, ledger, points, clock = () => new Date() }) {
    Object.assign(this, { db, provider, ledger, points, clock });
  }

  async refund(paymentId, { amount = null, key, reason = '고객 요청' }) {
    if (!key || (amount !== null && (!Number.isSafeInteger(amount) || amount <= 0)))
      throw new AppError('환불 금액 또는 작업 키가 올바르지 않습니다.', 400);
    const owner = crypto.randomUUID();
    const now = this.clock();
    const reserved = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM public.payments WHERE id = ${paymentId} FOR UPDATE`;
      const payment = await tx.payments.findUnique({ where: { id: paymentId } });
      if (!payment) throw new AppError('결제를 찾을 수 없습니다.', 404);
      const order = await tx.orders.findUnique({
        where: { id: payment.order_id },
        select: { store_id: true },
      });
      if (!order || order.store_id !== payment.store_id)
        throw new AppError('결제와 주문의 매장 범위가 일치하지 않습니다.', 409);
      const operationKey = `refund:${paymentId}:${key}`;
      let operation = await tx.refund_operations.findUnique({
        where: { operation_key: operationKey },
      });
      if (operation) {
        if (operation.store_id !== payment.store_id)
          throw new AppError('환불 작업의 매장 범위가 일치하지 않습니다.', 409);
        if (amount !== null && operation.amount !== amount)
          throw new AppError('동일 환불 키의 금액이 다릅니다.', 422);
        if (operation.status === 'confirmed') return { payment, operation, replay: true };
        if (operation.status === 'processing' && operation.lease_until > now)
          throw new AppError('환불 처리 중입니다. 같은 키로 상태를 다시 확인해 주세요.', 409);
      } else {
        const pending = await tx.refund_operations.findFirst({
          where: { payment_id: paymentId, status: { in: ['processing', 'unknown'] } },
        });
        if (pending) throw new AppError('이 결제의 이전 환불 결과 확인이 필요합니다.', 409);
        if (payment.status !== 'DONE') throw new AppError('취소 가능한 결제가 아닙니다.', 409);
        const refunds = await tx.ledger.findMany({
          where: { payment_id: paymentId, type: 'REFUND' },
          select: { amount: true },
        });
        // Legacy partial rows were negative. Normalize individually, not the mixed sum.
        const refunded = refunds.reduce((sum, row) => sum + Math.abs(row.amount), 0);
        const baseline = payment.amount - refunded;
        const requested = amount === null ? baseline : amount;
        if (!Number.isSafeInteger(requested) || requested <= 0 || requested > baseline)
          throw new AppError('남은 결제 금액을 초과하는 환불입니다.', 409);
        operation = await tx.refund_operations.create({
          data: {
            id: crypto.randomUUID(),
            operation_key: operationKey,
            payment_id: paymentId,
            store_id: payment.store_id,
            amount: requested,
            baseline_balance: baseline,
            reason: String(reason).slice(0, 500),
            status: 'unknown',
          },
        });
        if (
          requested === baseline &&
          (await tx.payments.count({ where: { order_id: payment.order_id, status: 'DONE' } })) === 1
        ) {
          await tx.inventory_compensations.upsert({
            where: { order_id: payment.order_id },
            create: { order_id: payment.order_id, store_id: payment.store_id, status: 'pending' },
            update: {},
          });
        }
      }
      const recovery = operation.status === 'unknown' && operation.attempts > 0;
      operation = await tx.refund_operations.update({
        where: { id: operation.id },
        data: {
          status: 'processing',
          owner,
          lease_until: new Date(now.getTime() + 120000),
          attempts: { increment: 1 },
        },
      });
      return { payment, operation, recovery };
    });
    const { payment, operation } = reserved;
    if (reserved.replay) return { refundedAmount: operation.amount, alreadyRefunded: true };
    try {
      let result = operation.provider_result;
      const balance = operation.baseline_balance - operation.amount;
      const snapshot = await this.provider.getPayment(payment.payment_key);
      // Never attribute an external/manual refund merely because its amount happens to match.
      const canReplay = operation.attempts > 1 || key.startsWith('partial:');
      if (
        snapshot.paymentKey !== payment.payment_key ||
        Number(snapshot.totalAmount) !== payment.amount ||
        (result && Number(snapshot.balanceAmount) !== balance) ||
        ![operation.baseline_balance, ...(canReplay || result ? [balance] : [])].includes(
          Number(snapshot.balanceAmount)
        )
      )
        throw new AppError('결제사 잔액과 로컬 환불 기록이 달라 대사가 필요합니다.', 409);
      // Preserve the provider key used before this migration: changing it after a
      // lost legacy response would turn a retry into another financial operation.
      const providerKey = key.startsWith('partial:')
        ? `partial-refund:${key.slice(8)}`
        : operation.operation_key;
      // Conservative recovery window: never risk reissuing an old unknown effect after PG key retention.
      if (
        !result &&
        operation.attempts > 1 &&
        this.clock() - operation.created_at > 24 * 60 * 60 * 1000
      )
        throw new AppError('미확정 환불의 자동 재시도 기간을 초과하여 대사가 필요합니다.', 409);
      if (!result)
        result = await this.provider.cancelPayment(
          payment.payment_key,
          operation.reason,
          operation.amount,
          providerKey
        );
      if (
        result.paymentKey !== payment.payment_key ||
        Number(result.totalAmount) !== payment.amount ||
        Number(result.balanceAmount) !== balance ||
        !['CANCELED', 'PARTIAL_CANCELED'].includes(result.status)
      )
        throw new AppError('결제사 환불 결과가 일치하지 않아 대사가 필요합니다.', 502);
      const saved = await this.db.refund_operations.updateMany({
        where: { id: operation.id, owner, status: 'processing' },
        data: {
          provider_result: {
            paymentKey: result.paymentKey,
            totalAmount: Number(result.totalAmount),
            balanceAmount: Number(result.balanceAmount),
            status: result.status,
          },
        },
      });
      if (saved.count !== 1) throw new AppError('환불 처리 소유권이 변경되었습니다.', 409);
      await this.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM public.orders WHERE id = ${payment.order_id} FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM public.payments WHERE id = ${payment.id} FOR UPDATE`;
        const current = await tx.refund_operations.findUnique({ where: { id: operation.id } });
        if (current.status === 'confirmed') return;
        if (current.owner !== owner || current.status !== 'processing')
          throw new AppError('환불 처리 소유권이 변경되었습니다.', 409);
        await this.ledger.recordRefund(
          {
            storeId: payment.store_id,
            orderId: payment.order_id,
            paymentId: payment.id,
            amount: operation.amount,
            method: payment.method,
            description: `환불: ${operation.reason}`,
            eventKey: operation.operation_key,
          },
          tx
        );
        await tx.payments.update({
          where: { id: payment.id },
          data: {
            status: balance === 0 ? 'CANCELED' : 'DONE',
            cancelled_at: balance === 0 ? this.clock() : undefined,
            cancel_reason: operation.reason,
            updated_at: this.clock(),
          },
        });
        if (balance === 0) await this.points.revertOnCancel(payment.id, tx);
        const remaining = await tx.payments.count({
          where: { order_id: payment.order_id, status: 'DONE' },
        });
        if (remaining === 0 && balance === 0) {
          await this.restoreInventory(tx, payment.order_id, payment.store_id);
          await tx.orders.update({
            where: { id: payment.order_id },
            data: {
              payment_status: 'refunded',
              status: 'cancelled',
              updated_at: this.clock(),
            },
          });
        }
        await tx.refund_operations.update({
          where: { id: operation.id },
          data: {
            status: 'confirmed',
            owner: null,
            lease_until: null,
            confirmed_at: this.clock(),
          },
        });
      });
      return { refundedAmount: operation.amount, tossResponse: result };
    } catch (error) {
      await this.db.refund_operations
        .updateMany({
          where: { id: operation.id, owner, status: 'processing' },
          data: { status: 'unknown', owner: null, lease_until: null },
        })
        .catch(() => {});
      throw error;
    }
  }

  async restoreInventory(tx, orderId, storeId) {
    // Order lock held by caller. Restore what was actually deducted, not uncommitted cart quantities.
    const job = await tx.inventory_compensations.upsert({
      where: { order_id: orderId },
      create: { order_id: orderId, store_id: storeId, status: 'pending' },
      update: {},
    });
    if (job.store_id !== storeId)
      throw new AppError('재고 보상 매장 범위가 일치하지 않습니다.', 409);
    if (job.status === 'completed') return;
    const deductions = await tx.stock_history.findMany({
      where: { order_id: orderId, store_id: storeId, reason: 'ORDER' },
    });
    const quantities = new Map();
    for (const row of deductions) {
      if (row.change < 0)
        quantities.set(row.product_id, (quantities.get(row.product_id) || 0) - row.change);
    }
    for (const [productId, quantity] of [...quantities].sort((a, b) => a[0] - b[0])) {
      if (
        await tx.stock_history.findFirst({
          where: { order_id: orderId, store_id: storeId, product_id: productId, reason: 'CANCEL' },
        })
      )
        continue;
      const product = await tx.products.findUnique({ where: { id: productId } });
      if (!product || product.store_id !== storeId)
        throw new AppError('재고 매장 범위가 일치하지 않습니다.', 409);
      if (product.stock_quantity === null) continue;
      const updated = await tx.products.update({
        where: { id: productId },
        data: { stock_quantity: { increment: quantity }, is_sold_out: false },
      });
      await tx.stock_history.create({
        data: {
          order_id: orderId,
          product_id: productId,
          store_id: storeId,
          change: quantity,
          qty_after: updated.stock_quantity,
          reason: 'CANCEL',
          compensation_key: `cancel:${storeId}:${orderId}:${productId}`,
        },
      });
    }
    await tx.inventory_compensations.update({
      where: { order_id: orderId },
      data: { status: 'completed', completed_at: this.clock() },
    });
  }

  // Explicit bounded recovery entry point. No automatic production worker is enabled here.
  async resumePendingRefunds({ storeId, limit = 25 }) {
    if (!Number.isSafeInteger(storeId) || storeId <= 0)
      throw new AppError('매장 범위가 필요합니다.', 400);
    const operations = await this.db.$transaction((tx) =>
      tx.refund_operations.findMany({
        where: {
          store_id: storeId,
          OR: [{ status: 'unknown' }, { status: 'processing', lease_until: { lte: this.clock() } }],
        },
        orderBy: { created_at: 'asc' },
        take: Math.min(Math.max(limit, 1), 100),
      })
    );
    const results = [];
    for (const op of operations) {
      const prefix = `refund:${op.payment_id}:`;
      if (!op.operation_key.startsWith(prefix)) {
        results.push({ paymentId: op.payment_id, status: 'reconciliation_required' });
        continue;
      }
      try {
        await this.refund(op.payment_id, {
          amount: op.amount,
          key: op.operation_key.slice(prefix.length),
          reason: op.reason,
        });
        results.push({ paymentId: op.payment_id, status: 'confirmed' });
      } catch (error) {
        results.push({
          paymentId: op.payment_id,
          status: 'unresolved',
          code: error.statusCode || 500,
        });
      }
    }
    return results;
  }
}
module.exports = RefundService;
