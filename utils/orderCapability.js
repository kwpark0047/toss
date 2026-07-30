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

function createReservationCapability(reservation) {
  const secret = getSecret();
  if (!secret) throw new Error('Order capability secret is not configured');
  return jwt.sign(
    {
      type: 'reservation_capability',
      id: reservation.id,
      storeId: reservation.store_id,
      customer_phone: reservation.customer_phone,
      iat: Math.floor(Date.now() / 1000)
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
      iat: Math.floor(Date.now() / 1000)
    },
    secret,
    { expiresIn: '1h' }
  );
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
  createOrderCapability, verifyOrderCapability,
  createReservationCapability, verifyReservationCapability,
  createWalletCapability, verifyWalletCapability,
};
