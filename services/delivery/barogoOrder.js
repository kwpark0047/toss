const { AppError } = require('../../utils/errorHandler');
const { decryptPhone } = require('../../utils/phoneEncryption');
const { normalizeDeliveryReservation } = require('./barogoSchedule');
const invalid = () =>
  new AppError('바로고 배차에 필요한 주소·결제·상품 정보를 확인해 주세요.', 400);
const amount = (value) => {
  if (!Number.isSafeInteger(value) || value < 0) throw invalid();
  return value;
};
function normalizeDeliveryAddress(data) {
  const empty = { delivery_road_address: null, delivery_address_detail: null };
  if (data.order_type !== 'delivery') return { ...empty, delivery_address: null };
  const hasParts = data.delivery_road_address != null || data.delivery_address_detail != null;
  if (!hasParts) return { ...empty, delivery_address: data.delivery_address?.trim() || null };
  for (const key of ['delivery_road_address', 'delivery_address_detail']) {
    if (
      typeof data[key] !== 'string' ||
      !data[key].trim() ||
      data[key].trim().length > 100 ||
      /[\r\n]/.test(data[key])
    )
      throw invalid();
  }
  const road = data.delivery_road_address.trim();
  const detail = data.delivery_address_detail.trim();
  return {
    delivery_road_address: road,
    delivery_address_detail: detail,
    delivery_address: `${road} ${detail}`,
  };
}
function buildBarogoOrder({ order, config, idempotencyKey, now = Date.now() }) {
  if (
    order?.order_type !== 'delivery' ||
    order.payment_status !== 'paid' ||
    !order.delivery_road_address ||
    !order.delivery_address_detail
  )
    throw invalid();
  const actual = amount(order.total_amount);
  if (
    actual <= 0 ||
    !Array.isArray(order.payments) ||
    order.payments
      .filter((p) => p.status === 'DONE')
      .reduce((sum, p) => sum + amount(p.amount), 0) !== actual
  )
    throw invalid();
  const fee = amount(order.delivery_fee ?? 0);
  if (!Array.isArray(order.order_items) || !order.order_items.length) throw invalid();
  const products = order.order_items.map((item) => {
    let options;
    try {
      options = typeof item.options === 'string' ? JSON.parse(item.options) : item.options;
    } catch {
      throw invalid();
    }
    if (options != null && (!Array.isArray(options) || options.length > 100)) throw invalid();
    const mappedOptions = (options || []).map((option) => {
      if (
        !option ||
        typeof option.choiceName !== 'string' ||
        !option.choiceName.trim() ||
        (option.groupName !== undefined && typeof option.groupName !== 'string') ||
        (option.quantity !== undefined && option.quantity !== 1) ||
        !Number.isSafeInteger(option.priceAdjustment)
      )
        throw invalid();
      const name = option.groupName
        ? `${option.groupName}: ${option.choiceName}`
        : option.choiceName;
      if (typeof name !== 'string' || name.length > 100 || /[\r\n]/.test(name)) throw invalid();
      return { name, unitPrice: option.priceAdjustment, quantity: 1 };
    });
    const optionUnitTotal = mappedOptions.reduce((sum, option) => {
      const total = sum + option.unitPrice;
      if (!Number.isSafeInteger(total)) throw invalid();
      return total;
    }, 0);
    const basePrice = item.price - optionUnitTotal;
    if (!Number.isSafeInteger(optionUnitTotal) || !Number.isSafeInteger(basePrice) || basePrice < 0)
      throw invalid();
    if (amount(item.price) * amount(item.quantity) !== amount(item.subtotal) || !item.quantity)
      throw invalid();
    return {
      type: 'FOOD',
      name: item.product_name,
      totalPrice: item.subtotal,
      unitPrice: basePrice,
      quantity: item.quantity,
      ...(mappedOptions.length ? { options: mappedOptions } : {}),
    };
  });
  if (fee)
    products.push({
      type: 'DELIVERY_TIP',
      name: '배달팁',
      totalPrice: fee,
      unitPrice: fee,
      quantity: 1,
    });
  const total = products.reduce((sum, item) => sum + item.totalPrice, 0);
  const reservation = normalizeDeliveryReservation(order, now);
  if (
    !Number.isSafeInteger(total) ||
    actual > total ||
    (!reservation &&
      (!Number.isInteger(config?.pickupMinutes) ||
        config.pickupMinutes < 1 ||
        config.pickupMinutes > 90))
  )
    throw invalid();
  const phone = decryptPhone(order.customer_phone);
  if (typeof phone !== 'string' || !/^\d{8,12}$/.test(phone)) throw invalid();
  return {
    orderType: 'FOR_DELIVERY',
    orderAgencyId: config.orderAgencyId,
    orderAgencyStoreId: config.orderAgencyStoreId,
    orderAgencyOrderId: idempotencyKey,
    totalPayPrice: total,
    actualPayPrice: actual,
    prepaidPrice: actual,
    paymentCashPrice: 0,
    paymentCardPrice: 0,
    orderProducts: products,
    receiverPhone: phone,
    isReservation: Boolean(reservation),
    ...(reservation || { pickupWishAt: now + config.pickupMinutes * 60000 }),
    isUntact: false,
    dropRoadAddress: order.delivery_road_address,
    dropAddressDetail: order.delivery_address_detail,
    ...(order.customer_name ? { receiverName: order.customer_name } : {}),
    ...(order.delivery_memo ? { ordererOrderMemo: order.delivery_memo } : {}),
  };
}
module.exports = { normalizeDeliveryAddress, buildBarogoOrder };
