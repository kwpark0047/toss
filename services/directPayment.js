const { AppError } = require('../utils/errorHandler');

async function requestDirectPayment(prisma, points, ledger, data, identity) {
  const orderId = Number(data.order_id);
  const method = String(data.payment_method || '').toLowerCase();
  const pointAmount = Number(data.point_amount || 0);
  if (method === 'point' && (!Number.isSafeInteger(pointAmount) || pointAmount <= 0)) {
    throw new AppError('포인트 결제는 양의 정수 포인트가 필요합니다.', 400);
  }
  if (
    !Number.isSafeInteger(orderId) ||
    orderId <= 0 ||
    !['cash', 'transfer', 'store_card', 'point'].includes(method)
  ) {
    throw new AppError('기존 주문 ID와 유효한 결제 수단이 필요합니다.', 400);
  }
  if (method === 'point' && !identity) throw new AppError('지갑 소유권 확인이 필요합니다.', 403);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM public.orders WHERE id = ${orderId} FOR UPDATE`;
    const order = await tx.orders.findUnique({ where: { id: orderId } });
    if (!order) throw new AppError('주문을 찾을 수 없습니다.', 404);
    if (order.status === 'cancelled') throw new AppError('취소된 주문입니다.', 409);
    if (data.store_id && Number(data.store_id) !== order.store_id)
      throw new AppError('매장이 일치하지 않습니다.', 403);
    const paid = await tx.payments.aggregate({
      where: { order_id: orderId, status: 'DONE' },
      _sum: { amount: true },
    });
    const remaining = Number(order.total_amount) - Number(paid._sum.amount || 0);
    if (remaining <= 0) throw new AppError('이미 결제된 주문입니다.', 409);
    if (data.total_amount !== undefined && Number(data.total_amount) !== remaining)
      throw new AppError('결제 금액이 주문 잔액과 다릅니다.', 400);
    if (method === 'point' && pointAmount !== remaining)
      throw new AppError('포인트는 결제 잔액 전액을 충당해야 합니다.', 400);
    const existing = await tx.payments.findFirst({ where: { order_id: orderId, status: 'READY' } });
    if (existing) {
      if (existing.method !== method.toUpperCase() || existing.amount !== remaining)
        throw new AppError('다른 결제가 진행 중입니다.', 409);
      return { ...existing, order_id: orderId, order_number: order.order_number };
    }
    const payment = await tx.payments.create({
      data: {
        order_id: orderId,
        store_id: order.store_id,
        order_name: `주문 #${order.order_number}`,
        amount: remaining,
        method: method.toUpperCase(),
        status: method === 'point' ? 'DONE' : 'READY',
        approved_at: method === 'point' ? new Date() : null,
      },
    });
    if (method === 'point') {
      await points.use(
        orderId,
        payment.id,
        order.store_id,
        order.order_number,
        identity,
        pointAmount,
        tx
      );
      await ledger.recordIncome(
        {
          storeId: order.store_id,
          orderId,
          paymentId: payment.id,
          amount: remaining,
          method: 'POINT',
          description: `포인트 결제: ${order.order_number}`,
        },
        tx
      );
      await tx.orders.update({
        where: { id: orderId },
        data: {
          payment_status: 'paid',
          status: order.status === 'pending' ? 'paid' : undefined,
          method: 'POINT',
        },
      });
    }
    return { ...payment, order_id: orderId, order_number: order.order_number };
  });
}
module.exports = { requestDirectPayment };
