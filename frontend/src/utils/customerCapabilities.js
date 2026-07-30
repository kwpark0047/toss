const ORDER_PREFIX = 'wm_order_capability:';
const RESERVATION_PREFIX = 'wm_reservation_capability:';

const normalizePhone = (phone) => String(phone || '').replace(/\D/g, '');

export const saveOrderCapability = (order, customer = {}) => {
  if (!order?.id || !order?.order_capability) return;
  localStorage.setItem(`${ORDER_PREFIX}${order.id}`, JSON.stringify({
    token: order.order_capability,
    phone: normalizePhone(customer.customer_phone),
    tossUserKey: customer.toss_user_key || '',
    storeId: Number(order.store_id || customer.store_id),
  }));
};

export const getOrderCapability = (orderId) => {
  try {
    return JSON.parse(localStorage.getItem(`${ORDER_PREFIX}${orderId}`))?.token || null;
  } catch {
    return null;
  }
};

export const getCustomerOrderCapability = ({ phone, tossUserKey, storeId }) => {
  const normalizedPhone = normalizePhone(phone);
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(ORDER_PREFIX)) continue;
    try {
      const entry = JSON.parse(localStorage.getItem(key));
      const identityMatches = normalizedPhone
        ? entry.phone === normalizedPhone
        : entry.tossUserKey === (tossUserKey || '');
      if (identityMatches && (!storeId || entry.storeId === Number(storeId))) return entry.token;
    } catch { /* Ignore malformed local entries. */ }
  }
  return null;
};

export const saveReservationCapability = (reservation, phone) => {
  if (!reservation?.id || !reservation?.reservation_capability) return;
  localStorage.setItem(`${RESERVATION_PREFIX}${reservation.id}`, JSON.stringify({
    token: reservation.reservation_capability,
    phone: normalizePhone(phone),
  }));
};

export const getReservationCapability = (reservationId) => {
  try {
    return JSON.parse(localStorage.getItem(`${RESERVATION_PREFIX}${reservationId}`))?.token || null;
  } catch {
    return null;
  }
};

export const getReservationCapabilities = (phone) => {
  const normalizedPhone = normalizePhone(phone);
  const capabilities = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(RESERVATION_PREFIX)) continue;
    try {
      const entry = JSON.parse(localStorage.getItem(key));
      if (entry.phone === normalizedPhone) capabilities.push(entry.token);
    } catch { /* Ignore malformed local entries. */ }
  }
  return capabilities;
};
