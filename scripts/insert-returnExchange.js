// 주문 반품/교환
  async returnExchange(id, data, userId, userRole) {
    const orderId = parseInt(id);
    const order = await Order.findById(orderId);
    if (!order) throw new AppError('주문을 찾을 수 없습니다', 404);

    if (userRole !== 'super_admin') {
      const { getStoreRole } = require('../middleware/storeAuth');
      const role = await getStoreRole(userId, order.store_id);
      const allowed = ['owner', 'manager', 'staff', 'kitchen'];
      if (!role || !allowed.includes(role))
        throw new AppError('해당 매장에 대한 권한이 없습니다.', 403);
    }

    const { type, items, retrieveType, retrieveAddress, retrieveContact } = data;

    // 주문 상태 검증
    if (!['completed', 'delivered'].includes(order.status)) {
      throw new AppError('완료된 주문만 반품/교환 가능합니다.', 400);
    }

    // 반품/교환 기록 생성
    const returnExchange = await prisma.returnExchange.create({
      data: {
        order_id: orderId,
        type: type || 'return',
        status: 'requested',
        reason: data.reason,
        items: { create: items.map(item => ({
          order_item_id: item.orderItemId,
          quantity: item.quantity,
          reason: item.reason,
          exchange_product_id: item.exchangeProductId,
        }))},
        retrieve_type: retrieveType,
        retrieve_address: retrieveAddress,
        retrieve_contact: retrieveContact,
        requested_by: userId,
      },
    });

    // 주문 상태 업데이트
    await Order.updateStatus(orderId, type === 'exchange' ? 'exchange_requested' : 'return_requested');

    // 알림 발송
    this._sendOrderAlimtalk(order, type === 'exchange' ? 'exchange_requested' : 'return_requested').catch((e) => logger.error(e));

    if (this.io) {
      this.io.to(`store - ${order.store_id}`).emit('order-updated', {
        order_id: orderId,
        status: type === 'exchange' ? 'exchange_requested' : 'return_requested',
        store_id: order.store_id,
      });
    }

    return { success: true, message: type === 'exchange' ? '교환이 접수되었습니다' : '반품이 접수되었습니다', returnExchange };
  }

  // ── 프라이빗 헬퍼 ──────────────────────────────────────────