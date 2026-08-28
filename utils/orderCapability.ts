import jwt from 'jsonwebtoken';

function getSecret(): string {
  return (
    process.env.ORDER_CAPABILITY_SECRET || process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET
  );
}

export function createOrderCapability(order: { id: number; store_id: number }): string {
  const secret = getSecret();
  if (!secret) throw new Error('Order capability secret is not configured');
  return jwt.sign(
    { type: 'order_capability', orderId: order.id, storeId: order.store_id },
    secret,
    { expiresIn: '2h' }
  );
}

export function verifyOrderCapability(token: string): { type: string; orderId: number; storeId: number } | null {
  const secret = getSecret();
  if (!secret || !token) return null;
  try {
    const payload = jwt.verify(token, secret);
    return payload.type === 'order_capability' ? payload : null;
  } catch {
    return null;
  }
}

export function createCustomerHistoryCapability({ phone, toss_user_key }: { phone?: string; toss_user_key?: string }): string | null {
  const secret = getSecret();
  if (!secret) throw new Error('Order capability secret is not configured');
  if (!phone && !toss_user_key) return null;
  return jwt.sign(
    {
      type: 'customer_history_capability',
      phone: phone || null,
      toss_user_key: toss_user_key || null,
    },
    secret,
    { expiresIn: '30d' }
  );
}

export function verifyCustomerHistoryCapability(token: string): { type: string; phone: string | null; toss_user_key: string | null } | null {
  const secret = getSecret();
  if (!secret || !token) return null;
  try {
    const payload = jwt.verify(token, secret);
    return payload.type === 'customer_history_capability' ? payload : null;
  } catch {
    return null;
  }
}

export function createReservationCapability(reservation: { id: number; store_id: number; customer_phone: string }): string {
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

export function verifyReservationCapability(token: string): { type: string; id: number; storeId: number; customer_phone: string } | null {
  const secret = getSecret();
  if (!secret || !token) return null;
  try {
    const payload = jwt.verify(token, secret);
    return payload.type === 'reservation_capability' ? payload : null;
  } catch {
    return null;
  }
}

export function createWalletCapability(identifier: { phone: string; toss_user_key?: string; store_id?: number }): string {
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

export function createWaitingCapability(waiting: { id: number; store_id: number; customer_phone: string }): string {
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

export function verifyWaitingCapability(token: string): { type: string; id: number; storeId: number; customer_phone: string } | null {
  const secret = getSecret();
  if (!secret || !token) return null;
  try {
    const payload = jwt.verify(token, secret);
    return payload.type === 'waiting_capability' ? payload : null;
  } catch {
    return null;
  }
}

export function verifyWalletCapability(token: string): { type: string; customer_phone: string; toss_user_key: string | null; store_id: number | null } | null {
  const secret = getSecret();
  if (!secret || !token) return null;
  try {
    const payload = jwt.verify(token, secret);
    return payload.type === 'wallet_capability' ? payload : null;
  } catch {
    return null;
  }
}

function getSecret(): string {
  return (
    process.env.ORDER_CAPABILITY_SECRET || process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET
  );
}

export {
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
  verifyWalletCapability,
};