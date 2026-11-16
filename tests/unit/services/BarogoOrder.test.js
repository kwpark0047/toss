const {
  normalizeDeliveryAddress,
  buildBarogoOrder,
} = require('../../../services/delivery/barogoOrder');
const { encryptPhone } = require('../../../utils/phoneEncryption');
const now = 1800000000000;
const order = () => ({
  id: 11,
  store_id: 3,
  order_type: 'delivery',
  payment_status: 'paid',
  customer_phone: encryptPhone('01000000000'),
  total_amount: 13000,
  delivery_fee: 3000,
  delivery_road_address: '서울 강남구 시험로 1',
  delivery_address_detail: '101호',
  order_items: [
    { product_name: '상품', price: 12000, subtotal: 12000, quantity: 1, options: null },
  ],
  payments: [{ status: 'DONE', amount: 13000 }],
});
const config = { orderAgencyId: 'wemarket', orderAgencyStoreId: 'shop-3', pickupMinutes: 20 };
test('구조화 주소는 표시 주소와 함께 정규화하고 레거시는 추측하지 않는다', () => {
  expect(
    normalizeDeliveryAddress({
      order_type: 'delivery',
      delivery_road_address: ' 도로 1 ',
      delivery_address_detail: ' 101호 ',
    })
  ).toMatchObject({
    delivery_address: '도로 1 101호',
    delivery_road_address: '도로 1',
    delivery_address_detail: '101호',
  });
  expect(
    normalizeDeliveryAddress({ order_type: 'delivery', delivery_address: '기존 통합 주소' })
      .delivery_road_address
  ).toBeNull();
  expect(() =>
    normalizeDeliveryAddress({ order_type: 'delivery', delivery_road_address: '도로 1' })
  ).toThrow();
});
test('할인 전 상품합계+배달팁, 할인 후 결제액, 복호화한 연락처를 매핑한다', () => {
  expect(
    buildBarogoOrder({ order: order(), config, idempotencyKey: 'delivery-dispatch:5', now })
  ).toMatchObject({
    orderAgencyOrderId: 'delivery-dispatch:5',
    totalPayPrice: 15000,
    actualPayPrice: 13000,
    prepaidPrice: 13000,
    paymentCashPrice: 0,
    paymentCardPrice: 0,
    receiverPhone: '01000000000',
    dropRoadAddress: '서울 강남구 시험로 1',
    dropAddressDetail: '101호',
    pickupWishAt: now + 20 * 60000,
    orderProducts: [
      { type: 'FOOD', name: '상품', unitPrice: 12000, totalPrice: 12000, quantity: 1 },
      { type: 'DELIVERY_TIP', name: '배달팁', unitPrice: 3000, totalPrice: 3000, quantity: 1 },
    ],
  });
});
test.each([
  { payment_status: 'pending' },
  { payments: [{ status: 'DONE', amount: 1 }] },
  { delivery_address_detail: null },
  { total_amount: 99999 },
  {
    order_items: [
      { product_name: '옵션', price: 1000, subtotal: 2000, quantity: 1, options: '[{}]' },
    ],
  },
])('불확실한 주소·결제·상품은 배차 전에 거절한다: %j', (patch) => {
  expect(() =>
    buildBarogoOrder({
      order: { ...order(), ...patch },
      config,
      idempotencyKey: 'delivery-dispatch:5',
      now,
    })
  ).toThrow();
});
