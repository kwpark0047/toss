const { AppError } = require('../utils/errorHandler');

// History proof is bounded to explicit order IDs in exactly one store.
module.exports = async function retryPayment({ db, provider, prepare, orderId, proof }) {
  const id = Number(orderId);
  if (!Number.isSafeInteger(id) || id <= 0 || !proof?.orderIds?.includes(id))
    throw new AppError('주문 결제 권한이 없거나 만료되었습니다.', 403);
  return db.$transaction(
    async (tx) => {
      await tx.$queryRawUnsafe('SELECT id FROM orders WHERE id = $1 FOR UPDATE', id);
      const order = await tx.orders.findUnique({ where: { id } });
      if (!order || order.store_id !== proof.storeId)
        throw new AppError('주문 결제 권한이 없습니다.', 403);
      if (order.status !== 'pending' || order.payment_status !== 'pending')
        throw new AppError(
          '현재 상태에서는 결제를 다시 진행할 수 없습니다. 주문 내역을 확인해 주세요.',
          409
        );
      const payments = await tx.payments.findMany({ where: { order_id: id } });
      if (payments.some((p) => p.status !== 'READY' || p.method !== 'CARD'))
        throw new AppError('기존 결제 내역을 먼저 확인해야 합니다. 매장에 문의해 주세요.', 409);
      const current = payments.find((p) => p.status === 'READY');
      const merchantId = current?.toss_transaction_id || order.order_number;
      const remote = await provider.getPaymentByOrderId(merchantId);
      if (
        remote &&
        (remote.orderId !== merchantId ||
          remote.totalAmount !== Number(order.total_amount) ||
          !['READY', 'EXPIRED'].includes(remote.status) ||
          remote.approvedAt ||
          remote.cancels?.length ||
          remote.balanceAmount !== Number(order.total_amount))
      )
        throw new AppError(
          'PG 인증·결제 상태를 먼저 확인해야 합니다. 중복 결제를 방지하기 위해 재시도를 중단했습니다.',
          409
        );
      const ready = await prepare({ order_id: id, method: 'CARD' }, tx);
      // A terminal expired PG intent cannot authenticate again. Rotate only the PG
      // reference, never the business order or local payment. Persist before SDK use.
      if (remote?.status === 'EXPIRED') {
        const nextId = `${order.order_number}-R-${require('crypto').randomUUID().replace(/-/g, '')}`;
        await tx.payments.update({
          where: { id: ready.payment_id },
          data: { toss_transaction_id: nextId },
        });
        ready.order_number = nextId;
      } else ready.order_number = merchantId;
      return { ...ready, order_id: id, store_id: order.store_id };
    },
    { maxWait: 3000, timeout: 20000 }
  );
};

