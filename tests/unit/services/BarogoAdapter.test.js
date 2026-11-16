const { createBarogoStagingAdapter } = require('../../../services/delivery/barogoAdapter');
const { getAdapter } = require('../../../services/delivery/adapters');
const crypto = require('crypto');
const creds = {
  values: {
    api_key: 'sandbox-key',
    order_agency_id: 'wemarket',
    order_agency_store_id: 'shop-3',
    callback_header: 'x-test-auth',
    callback_token: 'long-test-token-1234567890',
  },
};
test('운영 등록 어댑터는 환경변수와 관계없이 비활성이다', () => {
  process.env.BAROGO_ENABLED = 'true';
  expect(getAdapter('barogo').ready).toBe(false);
  delete process.env.BAROGO_ENABLED;
});
test('잘못된 주문은 HTTP 요청 전에 거절한다', async () => {
  const transport = jest.fn();
  const adapter = createBarogoStagingAdapter({ transport });
  await expect(
    adapter.requestDispatch({
      credentials: creds,
      order: { order_type: 'delivery', payment_status: 'pending' },
      idempotencyKey: 'delivery-dispatch:1',
    })
  ).rejects.toThrow();
  expect(transport).not.toHaveBeenCalled();
});
test('명시적으로 등록할 콜백 헤더 값을 상수시간 비교하고 HMAC으로 가정하지 않는다', () => {
  const adapter = createBarogoStagingAdapter();
  expect(
    adapter.verifyWebhook({
      credentials: creds,
      headers: { 'x-test-auth': creds.values.callback_token },
    })
  ).toBe(true);
  expect(adapter.verifyWebhook({ credentials: creds, headers: { 'x-test-auth': 'bad' } })).toBe(
    false
  );
  expect(
    adapter.verifyWebhook({
      credentials: creds,
      headers: { 'x-delivery-signature': crypto.createHash('sha256').update('abc').digest('hex') },
    })
  ).toBe(false);
});
test('콜백은 제휴사·매장과 경로 종류를 검증하고 배차 해제를 재배차 대기로 변환한다', () => {
  const adapter = createBarogoStagingAdapter();
  const body = {
    orderAgencyId: 'wemarket',
    orderAgencyStoreId: 'shop-3',
    orderAgencyOrderId: 'delivery-dispatch:5',
    deliveryStatus: 'ALLOCATION_CANCELED',
    changedAt: 1800000000000,
  };
  expect(
    adapter.parseWebhook({ credentials: creds, body, callbackKind: 'delivery' })
  ).toMatchObject({ status: 'requested', reassignment: true, changedAt: 1800000000000 });
  expect(() => adapter.parseWebhook({ credentials: creds, body, callbackKind: 'order' })).toThrow();
  expect(() =>
    adapter.parseWebhook({
      credentials: creds,
      body: { ...body, orderAgencyStoreId: 'other' },
      callbackKind: 'delivery',
    })
  ).toThrow();
});
