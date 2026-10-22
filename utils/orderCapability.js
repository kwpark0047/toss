const jwt = require('jsonwebtoken');

function getSecret() {
  return (
    process.env.ORDER_CAPABILITY_SECRET || process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET
  );
}

function createOrderCapability(order) {
  const secret = getSecret();
  if (!secret) throw new Error('Order capability secret is not configured');
  return jwt.sign(
    { type: 'order_capability', orderId: order.id, storeId: order.store_id },
    secret,
    { expiresIn: '2h' }
  );
}

function verifyOrderCapability(token) {
  const secret = getSecret();
  if (!secret || !token) return null;
  try {
    const payload = jwt.verify(token, secret);
    return payload.type === 'order_capability' ? payload : null;
  } catch {
    return null;
  }
}

function createCustomerHistoryCapability({ store_id, order_ids }) {
  const secret = getSecret();
  if (!secret) throw new Error('Order capability secret is not configured');
  if (
    !Number.isSafeInteger(store_id) ||
    store_id <= 0 ||
    !Array.isArray(order_ids) ||
    !order_ids.length ||
    order_ids.length > 30 ||
    order_ids.some((id) => !Number.isSafeInteger(id) || id <= 0)
  )
    return null;
  return jwt.sign(
    {
      type: 'customer_history_capability',
      version: 2,
      storeId: store_id,
      orderIds: [...new Set(order_ids)],
    },
    secret,
    { expiresIn: '30d', algorithm: 'HS256' }
  );
}

function verifyCustomerHistoryCapability(token) {
  const secret = getSecret();
  if (!secret || !token) return null;
  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
    return payload.type === 'customer_history_capability' &&
      payload.version === 2 &&
      Number.isSafeInteger(payload.storeId) &&
      payload.storeId > 0 &&
      Array.isArray(payload.orderIds) &&
      payload.orderIds.length > 0 &&
      payload.orderIds.length <= 30 &&
      payload.orderIds.every((id) => Number.isSafeInteger(id) && id > 0)
      ? payload
      : null;
  } catch {
    return null;
  }
}

function createReservationCapability(reservation) {
  const secret = getSecret();
  if (!secret) throw new Error('Order capability secret is not configured');
  return jwt.sign(
    {
      type: 'reservation_capability',
      id: reservation.id,
      storeId: reservation.store_id,
      customer_phone: reservation.customer_phone,
      iat: Math.floor(Date.now() / 1000),
    },
    secret,
    { expiresIn: '24h' }
  );
}

function verifyReservationCapability(token) {
  const secret = getSecret();
  if (!secret || !token) return null;
  try {
    const payload = jwt.verify(token, secret);
    return payload.type === 'reservation_capability' ? payload : null;
  } catch {
    return null;
  }
}

function createWalletCapability(identifier) {
  const secret = getSecret();
  if (!secret) throw new Error('Order capability secret is not configured');
  return jwt.sign(
    {
      type: 'wallet_capability',
      customer_phone: identifier.phone,
      toss_user_key: identifier.toss_user_key || null,
      store_id: identifier.store_id || null,
      iat: Math.floor(Date.now() / 1000),
    },
    secret,
    { expiresIn: '1h' }
  );
}

function createWaitingCapability(waiting) {
  const secret = getSecret();
  if (!secret) throw new Error('Order capability secret is not configured');
  return jwt.sign(
    {
      type: 'waiting_capability',
      id: waiting.id,
      storeId: waiting.store_id,
      customer_phone: waiting.customer_phone,
      iat: Math.floor(Date.now() / 1000),
    },
    secret,
    { expiresIn: '24h' }
  );
}

function verifyWaitingCapability(token) {
  const secret = getSecret();
  if (!secret || !token) return null;
  try {
    const payload = jwt.verify(token, secret);
    return payload.type === 'waiting_capability' ? payload : null;
  } catch {
    return null;
  }
}

// 전화번호 기반 주문 알림 소켓 채널 구독 권한 (번호만 알아서는 남의 알림을 받을 수 없게)
function createCustomerChannelCapability(phone) {
  const secret = getSecret();
  if (!secret) throw new Error('Order capability secret is not configured');
  return jwt.sign(
    {
      type: 'customer_channel_capability',
      customer_phone: String(phone).replace(/\D/g, ''),
      iat: Math.floor(Date.now() / 1000),
    },
    secret,
    { expiresIn: '30d' }
  );
}

function verifyCustomerChannelCapability(token) {
  const secret = getSecret();
  if (!secret || !token) return null;
  try {
    const payload = jwt.verify(token, secret);
    return payload.type === 'customer_channel_capability' ? payload : null;
  } catch {
    return null;
  }
}

function verifyWalletCapability(token) {
  const secret = getSecret();
  if (!secret || !token) return null;
  try {
    const payload = jwt.verify(token, secret);
    return payload.type === 'wallet_capability' ? payload : null;
  } catch {
    return null;
  }
}

module.exports = {
  createOrderCapability,
  verifyOrderCapability,
  createCustomerHistoryCapability,
  verifyCustomerHistoryCapability,
  createReservationCapability,
  verifyReservationCapability,
  createWalletCapability,
  verifyWalletCapability,
  createWaitingCapability,
  verifyWaitingCapability,
  createCustomerChannelCapability,
  verifyCustomerChannelCapability,
};
