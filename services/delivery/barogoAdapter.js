const crypto = require('crypto');
const { AppError } = require('../../utils/errorHandler');
const { createBarogoClient, parseStatusCallback, validateOrder } = require('./barogoClient');
const { buildBarogoOrder } = require('./barogoOrder');

// Explicit DI factory for offline/staging tests only. Never registered as a ready production adapter.
function createBarogoStagingAdapter({ transport, now = Date.now, pickupMinutes = 20 } = {}) {
  const config = (credentials) => ({
    orderAgencyId: credentials?.values?.order_agency_id,
    orderAgencyStoreId: credentials?.values?.order_agency_store_id,
    pickupMinutes,
  });
  const client = (credentials) =>
    createBarogoClient({ apiKey: credentials?.values?.api_key, transport, now });
  const prepareDispatch = ({ order, credentials, idempotencyKey }) => {
    client(credentials); // Validate credentials before claiming an external request.
    const body = buildBarogoOrder({
      order,
      config: config(credentials),
      idempotencyKey,
      now: now(),
    });
    return validateOrder(body, now());
  };
  return {
    key: 'barogo',
    label: '바로고 테스트',
    ready: true,
    needsOrderDetails: true,
    externalIdForClaim: (id) => `delivery-dispatch:${id}`,
    prepareDispatch,
    async requestDispatch(args) {
      const body = prepareDispatch(args);
      await client(args.credentials).submitOrder(body);
      // Do not infer delivery completion from an order acceptance response.
      return { externalId: body.orderAgencyOrderId, status: 'requested' };
    },
    async cancelDispatch({ credentials, dispatch, reason }) {
      await client(credentials).cancelOrder({
        orderAgencyOrderId: dispatch.external_id,
        cancelReason: reason,
      });
      return { status: 'canceled' };
    },
    verifyWebhook({ credentials, headers }) {
      const { callback_header: name, callback_token: token } = credentials?.values || {};
      // Explicitly configured test registration contract, not an assumed vendor signature.
      if (
        typeof name !== 'string' ||
        !/^[a-z0-9-]{1,64}$/.test(name) ||
        typeof token !== 'string' ||
        token.length < 20
      )
        return false;
      const given = headers?.[name];
      if (typeof given !== 'string') return false;
      const digest = (value) => crypto.createHash('sha256').update(value).digest();
      return crypto.timingSafeEqual(digest(given), digest(token));
    },
    parseWebhook({ body, credentials, callbackKind }) {
      if (
        !['delivery', 'order'].includes(callbackKind) ||
        (callbackKind === 'delivery'
          ? body?.orderStatus !== undefined || !body?.deliveryStatus
          : body?.deliveryStatus !== undefined || !body?.orderStatus)
      )
        throw new AppError('콜백 경로와 이벤트 종류가 일치하지 않습니다.', 400);
      return parseStatusCallback(body, config(credentials));
    },
  };
}
module.exports = { createBarogoStagingAdapter };
