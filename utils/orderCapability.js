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

module.exports = { createOrderCapability, verifyOrderCapability };
