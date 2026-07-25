class CreateOrder {
  constructor(orderRepository) {
    this.orderRepository = orderRepository;
  }

  async execute(orderData) {
    const { store_id, items, total_amount, payment_method, phone, toss_user_key, customer_name } = orderData;

    if (!items || items.length === 0) {
      throw new Error('주문 상품이 없습니다.');
    }

    const orderNumber = this._generateOrderNumber();

    const order = await this.orderRepository.create({
      store_id: parseInt(store_id),
      order_number: orderNumber,
      customer_phone: phone || null,
      customer_name: customer_name || null,
      total_amount: parseFloat(total_amount),
      status: 'pending',
      method: payment_method === 'mixed' ? 'card' : payment_method,
      toss_user_key: toss_user_key || null,
      items: items.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.price * item.quantity,
        options: item.options ? JSON.stringify(item.options) : null,
        user_phone: item.user_phone || phone || null
      }))
    });

    return order;
  }

  _generateOrderNumber() {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomStr = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${dateStr}-${randomStr}`;
  }
}

module.exports = CreateOrder;
