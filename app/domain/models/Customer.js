class Customer {
  constructor({ id, store_id, customer_phone, customer_name, visit_count, total_spent, tier, last_visit_at }) {
    this.id = id;
    this.storeId = store_id;
    this.phone = customer_phone;
    this.name = customer_name;
    this.visitCount = visit_count;
    this.totalSpent = total_spent;
    this.tier = tier;
    this.lastVisitAt = last_visit_at;
  }

  get maskedPhone() {
    const digits = (this.phone || '').replace(/\D/g, '');
    if (digits.length === 11) {
      return `${digits.slice(0, 3)}-****-${digits.slice(7)}`;
    }
    return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
  }

  get displayName() {
    return this.name || '(이름 미등록)';
  }

  toJSON() {
    return {
      id: this.id,
      storeId: this.storeId,
      phone: this.maskedPhone,
      name: this.displayName,
      visitCount: this.visitCount,
      totalSpent: this.totalSpent,
      tier: this.tier,
      lastVisitAt: this.lastVisitAt,
    };
  }
}

module.exports = Customer;
