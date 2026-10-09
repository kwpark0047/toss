import jwt from 'jsonwebtoken';

function getSecret(): string {
  return (
    process.env.ORDER_CAPABILITY_SECRET || process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET
  );
}

const isPayload = (payload: string | jwt.JwtPayload): payload is jwt.JwtPayload =>
  typeof payload === 'object' && payload !== null;

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
    return isPayload(payload) && payload.type === 'order_capability'
      ? payload as { type: string; orderId: number; storeId: number }
      : null;
  } catch {
    return null;
  }
}

export function createCustomerHistoryCapability({ store_id, order_ids }: { store_id: number; order_ids: number[] }): string | null {
  const secret = getSecret();
  if (!secret) throw new Error('Order capability secret is not configured');
  if (!Number.isSafeInteger(store_id) || store_id <= 0 || !Array.isArray(order_ids) ||
      !order_ids.length || order_ids.length > 30 || order_ids.some(id => !Number.isSafeInteger(id) || id <= 0)) return null;
  return jwt.sign(
    {
      type: 'customer_history_capability',
      version: 2, storeId: store_id, orderIds: [...new Set(order_ids)],
    },
    secret,
    { expiresIn: '30d', algorithm: 'HS256' }
  );
}

export function verifyCustomerHistoryCapability(token: string): { type: string; version: number; storeId: number; orderIds: number[] } | null {
  const secret = getSecret();
  if (!secret || !token) return null;
  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
    return isPayload(payload) && payload.type === 'customer_history_capability' && payload.version === 2 &&
      Number.isSafeInteger(payload.storeId) && payload.storeId > 0 && Array.isArray(payload.orderIds) &&
      payload.orderIds.length > 0 && payload.orderIds.length <= 30 &&
      payload.orderIds.every(id => Number.isSafeInteger(id) && id > 0)
      ? payload as { type: string; version: number; storeId: number; orderIds: number[] }
      : null;
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
    return isPayload(payload) && payload.type === 'reservation_capability'
      ? payload as { type: string; id: number; storeId: number; customer_phone: string }
      : null;
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
    return isPayload(payload) && payload.type === 'waiting_capability'
      ? payload as { type: string; id: number; storeId: number; customer_phone: string }
      : null;
  } catch {
    return null;
  }
}

export function verifyWalletCapability(token: string): { type: string; customer_phone: string; toss_user_key: string | null; store_id: number | null } | null {
  const secret = getSecret();
  if (!secret || !token) return null;
  try {
    const payload = jwt.verify(token, secret);
    return isPayload(payload) && payload.type === 'wallet_capability'
      ? payload as { type: string; customer_phone: string; toss_user_key: string | null; store_id: number | null }
      : null;
  } catch {
    return null;
  }
}
