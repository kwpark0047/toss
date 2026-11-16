const {
  createBarogoClient,
  parseStatusCallback,
} = require('../../../services/delivery/barogoClient');

const NOW = 1800000000000;
const payload = () => ({
  orderType: 'FOR_DELIVERY',
  orderAgencyId: 'wemarket',
  orderAgencyOrderId: 'delivery-dispatch:123',
  orderAgencyStoreId: 'store-3',
  totalPayPrice: 12000,
  actualPayPrice: 10000,
  prepaidPrice: 10000,
  paymentCashPrice: 0,
  paymentCardPrice: 0,
  orderProducts: [
    { type: 'FOOD', name: '시험 상품', totalPrice: 12000, unitPrice: 12000, quantity: 1 },
  ],
  receiverPhone: '01000000000',
  isReservation: false,
  pickupWishAt: NOW + 600000,
  isUntact: false,
  dropRoadAddress: '서울특별시 강남구 시험로 1',
  dropAddressDetail: '101호',
});
let transport;
let client;
beforeEach(() => {
  transport = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      statusCode: 200,
      data: {
        isSuccess: true,
        order: { orderAgencyOrderId: 'delivery-dispatch:123', status: 'CREATED' },
      },
    }),
  });
  client = createBarogoClient({ apiKey: 'sandbox-key', transport, now: () => NOW });
});
test('접수는 공식 staging 도메인·Bearer·안정적인 주문 ID를 사용한다', async () => {
  await client.submitOrder(payload());
  const [url, options] = transport.mock.calls[0];
  expect(url).toBe('https://staging-api-interlocker.gorelas.com/api/orders');
  expect(options.headers.Authorization).toBe('Bearer sandbox-key');
  expect(JSON.parse(options.body)).toEqual(payload());
  expect(options.redirect).toBe('error');
});
test('운영 및 임의 환경·빈 키는 거절한다', () => {
  for (const environment of ['production', 'http://localhost', 'unknown'])
    expect(() => createBarogoClient({ apiKey: 'key', environment })).toThrow();
  expect(() => createBarogoClient({ apiKey: '' })).toThrow();
});
test.each([
  ['상세주소', { dropAddressDetail: '' }],
  ['금액 구분', { prepaidPrice: 1 }],
  ['주문 상품', { orderProducts: [] }],
  ['전화', { receiverPhone: 'bad' }],
  ['픽업 시간', { pickupWishAt: NOW - 1 }],
  ['예약 미지원', { isReservation: true }],
  ['금액 타입', { totalPayPrice: '12000' }],
  ['자율 수행 미지원', { deliveryExecutionType: 'AUTONOMY' }],
])('%s 오류는 외부 호출 전에 차단한다', async (_name, change) => {
  await expect(client.submitOrder({ ...payload(), ...change })).rejects.toThrow();
  expect(transport).not.toHaveBeenCalled();
});
test('결과 조회는 주문 제휴사 범위를 함께 보낸다', async () => {
  transport.mockResolvedValue({
    ok: true,
    json: async () => ({
      statusCode: 200,
      data: { orderAgencyOrderId: 'delivery-dispatch:123', status: 'CREATED' },
    }),
  });
  await client.getOrder({ orderAgencyId: 'wemarket', orderAgencyOrderId: 'delivery-dispatch:123' });
  expect(transport.mock.calls[0][0]).toContain(
    '/api/orders/delivery-dispatch%3A123?orderAgencyId=wemarket'
  );
});
test('취소는 공식 PUT·시각·취소 유형으로 요청한다', async () => {
  transport.mockResolvedValue({
    ok: true,
    json: async () => ({
      statusCode: 200,
      data: {
        isSuccess: true,
        order: { orderAgencyOrderId: 'delivery-dispatch:123', status: 'CANCELED' },
      },
    }),
  });
  await client.cancelOrder({
    orderAgencyOrderId: 'delivery-dispatch:123',
    cancelReason: '상점 요청',
  });
  expect(transport.mock.calls[0][1]).toMatchObject({
    method: 'PUT',
    body: JSON.stringify({ time: NOW, cancelType: 'CANCEL_BY_STORE', cancelReason: '상점 요청' }),
  });
});
test('거절 응답은 고객정보·키를 포함하지 않는 오류로 변환한다', async () => {
  transport.mockResolvedValue({
    ok: true,
    json: async () => ({
      statusCode: 200,
      data: { isSuccess: false, reason: 'sandbox-key 01000000000' },
    }),
  });
  await expect(client.submitOrder(payload())).rejects.toThrow('바로고 요청이 거절되었습니다');
});
test('응답 유실은 재전송 없이 호출자에게 전달한다', async () => {
  transport.mockRejectedValue(new Error('timeout sandbox-key'));
  await expect(client.submitOrder(payload())).rejects.toThrow('바로고 응답을 확인하지 못했습니다');
  expect(transport).toHaveBeenCalledTimes(1);
});
test('잘못된 성공 응답은 거절한다', async () => {
  transport.mockResolvedValue({
    ok: true,
    json: async () => ({ statusCode: 200, data: { isSuccess: true } }),
  });
  await expect(client.submitOrder(payload())).rejects.toThrow();
});
const event = {
  orderAgencyId: 'wemarket',
  orderAgencyStoreId: 'store-3',
  orderAgencyOrderId: 'delivery-dispatch:123',
  changedAt: NOW,
};
test.each([
  ['ALLOCATED', 'assigned'],
  ['ALLOCATION_CHANGED', 'assigned'],
  ['ARRIVED', 'assigned'],
  ['PICKUP_FINISHED', 'picked_up'],
])('배달 콜백 %s 변환', (deliveryStatus, status) => {
  const parsed = parseStatusCallback(
    { ...event, deliveryStatus },
    { orderAgencyId: 'wemarket', orderAgencyStoreId: 'store-3' }
  );
  expect(parsed).toMatchObject({ externalId: event.orderAgencyOrderId, status });
  expect(parsed.eventId).toBe(
    parseStatusCallback(
      { ...event, deliveryStatus },
      { orderAgencyId: 'wemarket', orderAgencyStoreId: 'store-3' }
    ).eventId
  );
});
test('완료/취소는 주문 상태 콜백으로만 확정한다', () => {
  const scope = { orderAgencyId: 'wemarket', orderAgencyStoreId: 'store-3' };
  expect(
    parseStatusCallback(
      { ...event, orderStatus: 'FINISHED', deliveries: [{ deliveryStatus: 'DROP_FINISHED' }] },
      scope
    ).status
  ).toBe('delivered');
  expect(
    parseStatusCallback({ ...event, orderStatus: 'CANCELED', deliveries: [] }, scope).status
  ).toBe('canceled');
  expect(() => parseStatusCallback({ ...event, deliveryStatus: 'DROP_FINISHED' }, scope)).toThrow();
});
test('다른 매장/제휴사·미지원 이벤트는 거절한다', () => {
  expect(() =>
    parseStatusCallback(
      { ...event, deliveryStatus: 'ALLOCATED' },
      { orderAgencyId: 'other', orderAgencyStoreId: 'store-3' }
    )
  ).toThrow();
  expect(() =>
    parseStatusCallback(
      { ...event, deliveryStatus: 'UNKNOWN' },
      { orderAgencyId: 'wemarket', orderAgencyStoreId: 'store-3' }
    )
  ).toThrow();
  expect(() =>
    parseStatusCallback(
      { ...event, deliveryStatus: 'constructor' },
      { orderAgencyId: 'wemarket', orderAgencyStoreId: 'store-3' }
    )
  ).toThrow();
});
test('HTTP 오류와 잘못된 JSON은 재시도 없이 차단한다', async () => {
  transport.mockResolvedValue({ ok: false, json: async () => ({ statusCode: 401 }) });
  await expect(client.submitOrder(payload())).rejects.toThrow('API 응답 오류');
  transport.mockResolvedValue({
    ok: true,
    json: async () => {
      throw new Error('bad json');
    },
  });
  await expect(client.submitOrder(payload())).rejects.toThrow('응답을 확인하지 못했습니다');
  expect(transport).toHaveBeenCalledTimes(2);
});
test('응답 주문 ID 불일치와 접수 성공을 취소 성공으로 오인하지 않는다', async () => {
  await expect(
    client.cancelOrder({ orderAgencyOrderId: 'delivery-dispatch:123', cancelReason: '시험' })
  ).rejects.toThrow('취소 결과가 미확정');
  await expect(client.submitOrder({ ...payload(), orderAgencyOrderId: 'other' })).rejects.toThrow(
    '주문 응답이 일치하지 않습니다'
  );
});
test('문서화되지 않은 옵션을 조용히 누락하여 접수하지 않는다', async () => {
  await expect(client.submitOrder({ ...payload(), hasAlcoholicBeverage: true })).rejects.toThrow();
  expect(transport).not.toHaveBeenCalled();
});
