const crypto = require('crypto');
const { AppError } = require('../../utils/errorHandler');

// Official public guide, checked 2026-11-16. Staging only until partner approval.
const STAGING = 'https://staging-api-interlocker.gorelas.com';
const invalid = () => new AppError('바로고 요청 정보가 올바르지 않습니다.', 400);
function text(value, max, min = 1) {
  if (
    typeof value !== 'string' ||
    value.trim().length < min ||
    value.length > max ||
    /[\r\n]/.test(value) ||
    value.includes(String.fromCharCode(0))
  )
    throw invalid();
  return value;
}
function money(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw invalid();
  return value;
}
function validateOrder(body, now) {
  if (
    !body ||
    body.orderType !== 'FOR_DELIVERY' ||
    body.isReservation !== false ||
    typeof body.isUntact !== 'boolean' ||
    body.deliveryExecutionType !== undefined
  )
    throw invalid();
  const allowed = new Set([
    'orderType',
    'orderAgencyId',
    'orderAgencyOrderId',
    'orderAgencyStoreId',
    'totalPayPrice',
    'actualPayPrice',
    'prepaidPrice',
    'paymentCashPrice',
    'paymentCardPrice',
    'orderProducts',
    'receiverPhone',
    'receiverName',
    'storeOrderMemo',
    'ordererOrderMemo',
    'isReservation',
    'pickupWishAt',
    'isUntact',
    'dropRoadAddress',
    'dropAddressDetail',
  ]);
  if (Object.keys(body).some((key) => !allowed.has(key))) throw invalid();
  text(body.orderAgencyId, 30);
  text(body.orderAgencyOrderId, 50);
  text(body.orderAgencyStoreId, 100);
  text(body.receiverPhone, 12, 8);
  if (!/^\d{8,12}$/.test(body.receiverPhone)) throw invalid();
  text(body.dropRoadAddress, 100);
  text(body.dropAddressDetail, 100);
  [
    'totalPayPrice',
    'actualPayPrice',
    'prepaidPrice',
    'paymentCashPrice',
    'paymentCardPrice',
  ].forEach((key) => money(body[key]));
  if (
    body.totalPayPrice < body.actualPayPrice ||
    body.prepaidPrice + body.paymentCashPrice + body.paymentCardPrice !== body.actualPayPrice ||
    !Number.isSafeInteger(body.pickupWishAt) ||
    body.pickupWishAt < now ||
    body.pickupWishAt > now + 90 * 60000
  )
    throw invalid();
  if (
    !Array.isArray(body.orderProducts) ||
    !body.orderProducts.length ||
    body.orderProducts.length > 200
  )
    throw invalid();
  const orderProducts = body.orderProducts.map((product) => {
    // Initial scope: food/delivery tip without options, reservations or alcohol.
    if (
      !product ||
      !['FOOD', 'DELIVERY_TIP', 'SUMMARY'].includes(product.type) ||
      product.options !== undefined
    )
      throw invalid();
    text(product.name, 100);
    money(product.totalPrice);
    money(product.unitPrice);
    if (
      !Number.isSafeInteger(product.quantity) ||
      product.quantity <= 0 ||
      product.totalPrice !== product.unitPrice * product.quantity
    )
      throw invalid();
    return {
      type: product.type,
      name: product.name,
      totalPrice: product.totalPrice,
      unitPrice: product.unitPrice,
      quantity: product.quantity,
    };
  });
  if (orderProducts.reduce((sum, product) => sum + product.totalPrice, 0) !== body.totalPayPrice)
    throw invalid();
  const clean = Object.fromEntries(
    [
      'orderType',
      'orderAgencyId',
      'orderAgencyOrderId',
      'orderAgencyStoreId',
      'totalPayPrice',
      'actualPayPrice',
      'prepaidPrice',
      'paymentCashPrice',
      'paymentCardPrice',
      'receiverPhone',
      'isReservation',
      'pickupWishAt',
      'isUntact',
      'dropRoadAddress',
      'dropAddressDetail',
    ].map((key) => [key, body[key]])
  );
  clean.orderProducts = orderProducts;
  for (const [key, max] of [
    ['receiverName', 30],
    ['storeOrderMemo', 250],
    ['ordererOrderMemo', 250],
  ]) {
    if (body[key] !== undefined) clean[key] = text(body[key], max);
  }
  return clean;
}

function createBarogoClient({
  apiKey,
  environment = 'staging',
  transport = globalThis.fetch,
  now = Date.now,
} = {}) {
  text(apiKey, 4096);
  if (environment !== 'staging' || typeof transport !== 'function') throw invalid();
  async function call(method, path, body, mutation = false) {
    let response;
    let envelope;
    try {
      response = await transport(`${STAGING}${path}`, {
        method,
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
      });
      envelope = await response.json();
    } catch {
      // Never retry mutations here; durable claim owner must reconcile via GET.
      throw new AppError(
        '바로고 응답을 확인하지 못했습니다. 재접수 전 결과 조회가 필요합니다.',
        502
      );
    }
    if (!response.ok || envelope?.statusCode !== 200)
      throw new AppError('바로고 API 응답 오류입니다.', 502);
    if (mutation && envelope?.data?.isSuccess === false)
      throw new AppError('바로고 요청이 거절되었습니다.', 409);
    if (!envelope?.data || (mutation && envelope.data.isSuccess !== true))
      throw new AppError('바로고 응답 형식이 올바르지 않습니다.', 502);
    return envelope.data;
  }
  function scope({ orderAgencyId, orderAgencyOrderId }) {
    text(orderAgencyId, 30);
    text(orderAgencyOrderId, 50);
    return `/api/orders/${encodeURIComponent(orderAgencyOrderId)}?${new URLSearchParams({ orderAgencyId })}`;
  }
  function assertOrder(order, expected) {
    if (!order || order.orderAgencyOrderId !== expected || typeof order.status !== 'string')
      throw new AppError('바로고 주문 응답이 일치하지 않습니다.', 502);
    return order;
  }
  return {
    async submitOrder(body) {
      const clean = validateOrder(body, now());
      const data = await call('POST', '/api/orders', clean, true);
      return assertOrder(data.order, clean.orderAgencyOrderId);
    },
    async getOrder(ids) {
      const order = await call('GET', scope(ids));
      return assertOrder(order, ids.orderAgencyOrderId);
    },
    async cancelOrder({ orderAgencyOrderId, cancelReason }) {
      text(orderAgencyOrderId, 50);
      text(cancelReason, 250);
      const data = await call(
        'PUT',
        `/api/orders/${encodeURIComponent(orderAgencyOrderId)}/status/cancel`,
        { time: now(), cancelType: 'CANCEL_BY_STORE', cancelReason },
        true
      );
      const order = assertOrder(data.order, orderAgencyOrderId);
      if (order.status !== 'CANCELED') throw new AppError('바로고 취소 결과가 미확정입니다.', 502);
      return order;
    },
  };
}

// Pure parser only: caller MUST authenticate the webhook before using its result.
// Production ingress remains disabled until the registered callback auth is confirmed.
function parseStatusCallback(body, expected) {
  if (
    !body ||
    !expected ||
    !expected.orderAgencyId ||
    !expected.orderAgencyStoreId ||
    body.orderAgencyId !== expected.orderAgencyId ||
    body.orderAgencyStoreId !== expected.orderAgencyStoreId
  )
    throw invalid();
  text(body.orderAgencyOrderId, 50);
  if (!Number.isSafeInteger(body.changedAt) || body.changedAt <= 0) throw invalid();
  let status;
  if (body.orderStatus !== undefined) {
    if (body.deliveryStatus !== undefined) throw invalid();
    status = { FINISHED: 'delivered', CANCELED: 'canceled' }[body.orderStatus];
  } else {
    status = {
      ALLOCATED: 'assigned',
      ALLOCATION_CANCELED: 'requested',
      ALLOCATION_CHANGED: 'assigned',
      ARRIVED: 'assigned',
      PICKUP_FINISHED: 'picked_up',
    }[body.deliveryStatus];
  }
  if (!['requested', 'assigned', 'picked_up', 'delivered', 'canceled'].includes(status))
    throw invalid();
  const eventId = crypto
    .createHash('sha256')
    .update(
      JSON.stringify([
        body.orderAgencyId,
        body.orderAgencyStoreId,
        body.orderAgencyOrderId,
        body.orderStatus ? 'order' : 'delivery',
        body.orderStatus || body.deliveryStatus,
        body.changedAt,
      ])
    )
    .digest('hex');
  return {
    eventId,
    externalId: body.orderAgencyOrderId,
    status,
    changedAt: body.changedAt,
    reassignment: body.deliveryStatus === 'ALLOCATION_CANCELED',
    riderPhone:
      typeof body.driverPhone === 'string' && /^\d{8,12}$/.test(body.driverPhone)
        ? body.driverPhone
        : null,
  };
}

module.exports = { createBarogoClient, parseStatusCallback, validateOrder };
