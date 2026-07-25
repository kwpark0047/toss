class Payment {
  constructor(data) {
    this.id = data.id;
    this.order_id = data.order_id;
    this.store_id = data.store_id;
    this.order_number = data.order_number;
    this.method = data.method;
    this.amount = data.amount;
    this.status = data.status;
    this.card_number = data.card_number;
    this.card_company = data.card_company;
    this.toss_payment_key = data.toss_payment_key;
    this.toss_transaction_id = data.toss_transaction_id;
    this.paid_at = data.paid_at;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  static get STATUS() {
    return {
      PENDING: 'pending',
      APPROVED: 'approved',
      CANCELLED: 'cancelled',
      FAILED: 'failed',
      REFUNDED: 'refunded'
    };
  }

  isPaid() {
    return this.status === Payment.STATUS.APPROVED;
  }

  canCancel() {
    return this.status === Payment.STATUS.PENDING || this.status === Payment.STATUS.APPROVED;
  }

  maskCardNumber() {
    if (!this.card_number) return null;
    const digits = this.card_number.replace(/\D/g, '');
    const lastFour = digits.slice(-4);
    return `****-****-****-${lastFour}`;
  }
}

module.exports = Payment;
