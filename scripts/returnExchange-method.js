class TestOrderService {
  async returnExchange(id, data, userId, userRole) {
    const orderId = parseInt(id);
    const order = await Order.findById(orderId);
    if (!order) throw new Error('주문을 찾을 수 없습니다');

    if (userRole !== 'super_admin') {
      const { getStoreRole } = require('../middleware/storeAuth');
      const role = await getStoreRole(userId, order.store_id);
      const allowed = ['owner', 'manager', 'staff', 'kitchen'];
      if (!role || !allowed.includes(role)) throw new Error('권한이 없습니다');
    }

    const { type, items, retrieveType, retrieveAddress, retrieveContact } = data;

    if (!['completed', 'delivered'].includes(order.status)) {
      throw new Error('완료된 주문만 가능');
    }

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

    await Order.updateStatus(orderId, type === 'exchange' ? 'exchange_requested' : 'return_requested');

    if (this.io) {
      this.io.to(`store - ${order.store_id}`).emit('order-updated', {
        order_id: orderId,
        status: type === 'exchange' ? 'exchange_requested' : 'return_requested',
        store_id: order.store_id,
      });
    }

    return { success: true, message: type === 'exchange' ? '교환 접수' : '반품 접수', returnExchange };
  }
}