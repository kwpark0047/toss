const { validateOrder } = require('../../../services/delivery/barogoClient');
const { buildBarogoOrder } = require('../../../services/delivery/barogoOrder');
const {
  normalizeDeliveryReservation,
  twoMonthsLaterKst,
} = require('../../../services/delivery/barogoSchedule');
const NOW = Date.parse('2027-01-31T01:00:00+09:00');
const minute = 60000;
const payload = () => ({
  orderType: 'FOR_DELIVERY',
  orderAgencyId: 'wemarket',
  orderAgencyStoreId: 'shop-3',
  orderAgencyOrderId: 'delivery-dispatch:1',
  totalPayPrice: 28000,
  actualPayPrice: 26000,
  prepaidPrice: 26000,
  paymentCashPrice: 0,
  paymentCardPrice: 0,
  orderProducts: [
    {
      type: 'FOOD',
      name: '시험 상품',
      totalPrice: 28000,
      unitPrice: 12000,
      quantity: 2,
      options: [{ name: '소스 추가', unitPrice: 1000, quantity: 2 }],
    },
  ],
  receiverPhone: '01000000000',
  isReservation: false,
  pickupWishAt: NOW + 20 * minute,
  isUntact: false,
  dropRoadAddress: '서울 강남구 시험로 1',
  dropAddressDetail: '101호',
});
const schedule = () => ({
  dropWishAt: NOW + 2 * 86400000,
  pickupWishAt: NOW + 2 * 86400000 - 30 * minute,
  reservedOrderDisplayTime: 60,
});
const order = () => ({
  order_type: 'delivery',
  payment_status: 'paid',
  total_amount: 26000,
  delivery_fee: 0,
  customer_phone: '01000000000',
  delivery_road_address: '서울 강남구 시험로 1',
  delivery_address_detail: '101호',
  payments: [{ status: 'DONE', amount: 26000 }],
  order_items: [
    {
      product_name: '시험 상품',
      price: 14000,
      subtotal: 28000,
      quantity: 2,
      options: JSON.stringify([{ groupName: '소스', choiceName: '추가', priceAdjustment: 2000 }]),
    },
  ],
});
const config = { orderAgencyId: 'wemarket', orderAgencyStoreId: 'shop-3', pickupMinutes: 20 };
test('공식 옵션 예제는 부모 수량에 옵션을 곱하고 옵션을 누락하지 않는다', () => {
  expect(validateOrder(payload(), NOW)).toEqual(payload());
});
test('서버 저장 단가는 옵션 포함이므로 기본 단가를 복원해 중복 청구를 막는다', () => {
  const result = buildBarogoOrder({
    order: order(),
    config,
    idempotencyKey: 'delivery-dispatch:1',
    now: NOW,
  });
  expect(result.orderProducts[0]).toEqual({
    type: 'FOOD',
    name: '시험 상품',
    unitPrice: 12000,
    totalPrice: 28000,
    quantity: 2,
    options: [{ name: '소스: 추가', unitPrice: 2000, quantity: 1 }],
  });
  expect(validateOrder(result, NOW)).toEqual(result);
});
test.each([0, -1000])('무료·할인 옵션 %s도 저장 금액 그대로 보존한다', (adjustment) => {
  const fixture = order();
  fixture.order_items[0].options = [{ choiceName: '선택', priceAdjustment: adjustment }];
  const product = buildBarogoOrder({
    order: fixture,
    config,
    idempotencyKey: 'delivery-dispatch:1',
    now: NOW,
  }).orderProducts[0];
  expect(product.unitPrice).toBe(14000 - adjustment);
  expect(product.options[0].unitPrice).toBe(adjustment);
  expect(validateOrder({ ...payload(), orderProducts: [product] }, NOW).orderProducts[0]).toEqual(
    product
  );
});
test.each([
  { priceAdjustment: '2000', choiceName: '추가' },
  { priceAdjustment: 15000, choiceName: '추가' },
  { priceAdjustment: NaN, choiceName: '추가' },
  { priceAdjustment: 1000, choiceName: '' },
  { priceAdjustment: 1000, choiceName: '추가', groupName: {} },
  { priceAdjustment: 1000, choiceName: '추가', quantity: 2 },
])('손상된 저장 옵션은 차단한다: %j', (option) => {
  const fixture = order();
  fixture.order_items[0].options = [option];
  expect(() =>
    buildBarogoOrder({ order: fixture, config, idempotencyKey: 'delivery-dispatch:1', now: NOW })
  ).toThrow();
});
test.each([
  { quantity: 0 },
  { quantity: 1.5 },
  { unitPrice: '1000' },
  { quantity: Number.MAX_SAFE_INTEGER },
  { name: '' },
  { name: 'x'.repeat(101) },
  { ignored: 'cannot silently omit' },
])('잘못된 전송 옵션은 차단한다: %j', (patch) => {
  const p = payload();
  p.orderProducts[0].options[0] = { ...p.orderProducts[0].options[0], ...patch };
  expect(() => validateOrder(p, NOW)).toThrow();
});
test('예약은 90분보다 먼 픽업도 허용하고 저장한 예약 시각을 그대로 전송한다', () => {
  const reservation = schedule();
  expect(validateOrder({ ...payload(), isReservation: true, ...reservation }, NOW)).toMatchObject(
    reservation
  );
  const fixture = { ...order(), delivery_reservation: reservation };
  expect(
    buildBarogoOrder({ order: fixture, config, idempotencyKey: 'delivery-dispatch:1', now: NOW })
  ).toMatchObject({ isReservation: true, ...reservation });
});
test('예약 필드가 없는 기존 주문은 즉시 주문을 유지한다', () => {
  expect(normalizeDeliveryReservation({ order_type: 'delivery' }, NOW)).toBeNull();
  expect(validateOrder(payload(), NOW).isReservation).toBe(false);
});
test('예약 정규화는 배달만 허용하고 원본을 복사하며 알 수 없는 필드를 거절한다', () => {
  const reservation = schedule();
  const result = normalizeDeliveryReservation(
    { order_type: 'delivery', delivery_reservation: reservation },
    NOW
  );
  expect(result).toEqual(reservation);
  expect(result).not.toBe(reservation);
  expect(() =>
    normalizeDeliveryReservation({ order_type: 'takeout', delivery_reservation: reservation }, NOW)
  ).toThrow();
  expect(() =>
    normalizeDeliveryReservation(
      { order_type: 'delivery', delivery_reservation: { ...reservation, extra: true } },
      NOW
    )
  ).toThrow();
});
test.each([20, 90])('라이더 노출 %s분 경계를 포함한다', (display) => {
  const reservation = { ...schedule(), reservedOrderDisplayTime: display };
  for (const pickupWishAt of [
    reservation.dropWishAt - display * minute,
    reservation.dropWishAt - 20 * minute,
  ]) {
    expect(
      validateOrder({ ...payload(), isReservation: true, ...reservation, pickupWishAt }, NOW)
        .pickupWishAt
    ).toBe(pickupWishAt);
  }
});
test('예약 90분 하한과 KST 달력상 2개월 상한을 포함한다', () => {
  for (const dropWishAt of [NOW + 90 * minute, Date.parse('2027-03-31T01:00:00+09:00')]) {
    const s = { dropWishAt, pickupWishAt: dropWishAt - 30 * minute, reservedOrderDisplayTime: 60 };
    expect(validateOrder({ ...payload(), isReservation: true, ...s }, NOW).dropWishAt).toBe(
      dropWishAt
    );
  }
});
test.each([
  { dropWishAt: NOW + 90 * minute - 1 },
  { dropWishAt: Date.parse('2027-03-31T01:00:00+09:00') + 1 },
  { reservedOrderDisplayTime: 19 },
  { reservedOrderDisplayTime: 91 },
  { reservedOrderDisplayTime: 20.5 },
  { pickupWishAt: NOW - 1 },
  { pickupWishAt: schedule().dropWishAt - 60 * minute - 1 },
  { pickupWishAt: schedule().dropWishAt - 20 * minute + 1 },
  { dropWishAt: '2027-02-01' },
])('예약 시간·유형 경계를 벗어나면 차단한다: %j', (patch) => {
  expect(() =>
    validateOrder({ ...payload(), isReservation: true, ...schedule(), ...patch }, NOW)
  ).toThrow();
});
test('즉시 주문에 예약 필드를 끼워 보내거나 예약 필수 필드를 빠뜨리면 차단한다', () => {
  expect(() => validateOrder({ ...payload(), ...schedule() }, NOW)).toThrow();
  expect(() => validateOrder({ ...payload(), isReservation: true }, NOW)).toThrow();
});
test.each([
  ['2026-12-31T23:59:59.999+09:00', '2027-02-28T23:59:59.999+09:00'],
  ['2023-12-31T01:00:00+09:00', '2024-02-29T01:00:00+09:00'],
  ['2027-07-31T01:00:00+09:00', '2027-09-30T01:00:00+09:00'],
])('KST 달력상 두 달의 말일을 보정한다: %s', (from, expected) => {
  expect(twoMonthsLaterKst(Date.parse(from))).toBe(Date.parse(expected));
});
test('정상 예약도 배차 시점에 접수 시간창을 벗어나면 외부 호출하지 않는다', async () => {
  const { createBarogoStagingAdapter } = require('../../../services/delivery/barogoAdapter');
  let clock = NOW;
  const transport = jest.fn();
  const adapter = createBarogoStagingAdapter({ transport, now: () => clock });
  const fixture = {
    ...order(),
    delivery_reservation: {
      dropWishAt: NOW + 120 * minute,
      pickupWishAt: NOW + 90 * minute,
      reservedOrderDisplayTime: 60,
    },
  };
  const args = {
    order: fixture,
    credentials: {
      values: { api_key: 'test-key', order_agency_id: 'wemarket', order_agency_store_id: 'shop-3' },
    },
    idempotencyKey: 'delivery-dispatch:1',
  };
  expect(adapter.prepareDispatch(args).isReservation).toBe(true);
  clock += 31 * minute;
  await expect(adapter.requestDispatch(args)).rejects.toThrow();
  expect(transport).not.toHaveBeenCalled();
});
