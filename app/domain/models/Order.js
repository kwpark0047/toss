class Order {
  constructor(data) {
    this.id = data.id;
    this.storeId = data.store_id;
    this.orderNumber = data.order_number;
    this.customerPhone = data.customer_phone;
    this.customerName = data.customer_name;
    this.totalAmount = data.total_amount;
    this.status = data.status;
    this.method = data.method;
    this.paymentStatus = data.payment_status;
    this.tossUserKey = data.toss_user_key;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.completedAt = data.completed_at;
    this.items = data.order_items || [];
  }

  get isPaid() {
    return this.status === 'paid' || this.paymentStatus === 'paid';
  }

  get isPending() {
    return this.status === 'pending';
  }

  get isCancelled() {
    return this.status === 'cancelled';
  }

  canBeCancelled() {
    return this.isPending || this.status === 'confirmed';
  }

  calculateTotal() {
    return this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  toJSON() {
    return {
      id: this.id,
      store_id: this.storeId,
      order_number: this.orderNumber,
      customer_phone: this.customerPhone,
      customer_name: this.customerName,
      total_amount: this.totalAmount,
      status: this.status,
      method: this.method,
      payment_status: this.paymentStatus,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
      completed_at: this.completedAt,
      items: this.items
    };
  }
}

module.exports = Order;
