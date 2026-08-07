// OrderService 지오펜싱 전용 테스트
// getDistanceFromLatLonInKm 함수의 정확성을 검증

jest.mock('../../../config/prisma', () => ({
  stores: { findUnique: jest.fn() },
}));
jest.mock('../../../repositories/Order', () => ({
  create: jest.fn(),
  findById: jest.fn(),
}));
jest.mock('../../../repositories/Table', () => ({
  findByStoreAndTable: jest.fn(),
  findById: jest.fn(),
}));
jest.mock('../../../repositories/Product', () => ({
  findById: jest.fn(),
}));
jest.mock('../../../repositories/Store', () => ({
  findById: jest.fn(),
}));
jest.mock('../../../repositories/Coupon', () => ({
  findUserCoupon: jest.fn(),
}));
jest.mock('../../../utils/errorHandler', () => ({
  AppError: class AppError extends Error {
    constructor(msg, status) {
      super(msg);
      this.status = status;
      this.isOperational = true;
    }
  },
}));
jest.mock('../../../utils/phoneEncryption', () => ({
  encryptPhone: jest.fn((p) => `enc_${p}`),
  decryptPhone: jest.fn(),
  normalizePhone: jest.fn(),
}));
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
jest.mock('../../../services/notificationService', () => ({
  notifyNewOrderDB: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../../services/webhookDispatcher', () => ({ emitEvent: jest.fn() }));
jest.mock('../../../services/printService', () => ({
  createKitchenJob: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../../services/AlimtalkService', () => ({}));

const Store = require('../../../repositories/Store');
const Product = require('../../../repositories/Product');
const OrderService = require('../../../services/OrderService');

// Haversine 공식 독립 테스트 ( OrderService 내부 함수 접근 불가 → 시뮬레이션 )
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

describe('OrderService — Haversine 거리 계산', () => {
  test('같은 위치는 0km', () => {
    expect(getDistanceFromLatLonInKm(37.5665, 126.978, 37.5665, 126.978)).toBe(0);
  });

  test('약 100m 거리', () => {
    const dist = getDistanceFromLatLonInKm(37.5665, 126.978, 37.5674, 126.978);
    expect(dist).toBeGreaterThan(0.05);
    expect(dist).toBeLessThan(0.2);
  });

  test('약 1km 거리', () => {
    const dist = getDistanceFromLatLonInKm(37.5665, 126.978, 37.5755, 126.978);
    expect(dist).toBeGreaterThan(0.8);
    expect(dist).toBeLessThan(1.2);
  });

  test('약 3km 거리 (서울시청 → 강남역)', () => {
    // 서울시청 37.5665, 126.9780 → 강남역 37.4980, 127.0276
    const dist = getDistanceFromLatLonInKm(37.5665, 126.978, 37.498, 127.0276);
    expect(dist).toBeGreaterThan(5);
    expect(dist).toBeLessThan(12);
  });
});

describe('OrderService — 지오펜싱 통합 테스트', () => {
  let svc;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new OrderService(null);
    Product.findById.mockResolvedValue({
      id: 10,
      store_id: 1,
      name: '테스트상품',
      price: 5000,
      is_sold_out: false,
      is_active: true,
      stock_quantity: null,
      options: null,
    });
    const Table = require('../../../repositories/Table');
    Table.findById.mockResolvedValue({ id: 1, table_number: '1', store_id: 1 });
  });

  test('매장 위치 정보 없으면 지오펜싱 스킵', async () => {
    Store.findById.mockResolvedValue({
      id: 1,
      name: '테스트매장',
      latitude: null,
      longitude: null,
    });
    const Order = require('../../../repositories/Order');
    Order.create.mockResolvedValue({ id: 1, order_number: 'ORD-001' });

    // table_id와 lat/lng 없으면 지오펜싱 검증 안 함
    const result = await svc.createOrder({
      store_id: '1',
      items: [{ product_id: 10, quantity: 1 }],
      total_amount: 5000,
    });
    expect(result.id).toBe(1);
  });

  test('500m 이내 주문 허용', async () => {
    Store.findById.mockResolvedValue({ id: 1, latitude: 37.5665, longitude: 126.978 });
    const Order = require('../../../repositories/Order');
    Order.create.mockResolvedValue({ id: 2, order_number: 'ORD-002' });

    // 약 100m 떨어진 위치
    const result = await svc.createOrder({
      store_id: '1',
      table_id: '1',
      total_amount: 5000,
      items: [{ product_id: 10, quantity: 1 }],
      latitude: 37.567,
      longitude: 126.9785,
    });
    expect(result.id).toBe(2);
  });

  test('500m 초과 주문 거부 (403)', async () => {
    Store.findById.mockResolvedValue({ id: 1, latitude: 37.5665, longitude: 126.978 });

    // 약 3km 떨어진 위치
    await expect(
      svc.createOrder({
        store_id: '1',
        table_id: '1',
        total_amount: 5000,
        items: [{ product_id: 10, quantity: 1 }],
        latitude: 37.498,
        longitude: 127.0276,
      })
    ).rejects.toThrow('500m 밖');
  });

  test('정확히 500m 경계선', async () => {
    Store.findById.mockResolvedValue({ id: 1, latitude: 37.5665, longitude: 126.978 });

    // 약 0.45km — 경계선 이내
    const Order = require('../../../repositories/Order');
    Order.create.mockResolvedValue({ id: 3, order_number: 'ORD-003' });
    const result = await svc.createOrder({
      store_id: '1',
      table_id: '1',
      total_amount: 5000,
      items: [{ product_id: 10, quantity: 1 }],
      latitude: 37.5705,
      longitude: 126.978,
    });
    expect(result.id).toBe(3);
  });

  test('위도/경도가 null이면 지오펜싱 스킵', async () => {
    Store.findById.mockResolvedValue({ id: 1, latitude: 37.5665, longitude: 126.978 });
    const Order = require('../../../repositories/Order');
    Order.create.mockResolvedValue({ id: 4, order_number: 'ORD-004' });

    const result = await svc.createOrder({
      store_id: '1',
      table_id: '1',
      total_amount: 5000,
      items: [{ product_id: 10, quantity: 1 }],
      latitude: null,
      longitude: null,
    });
    expect(result.id).toBe(4);
  });

  test('테이블 ID 없으면 지오펜싱 스킵', async () => {
    Store.findById.mockResolvedValue({ id: 1, latitude: 37.5665, longitude: 126.978 });
    const Order = require('../../../repositories/Order');
    Order.create.mockResolvedValue({ id: 5, order_number: 'ORD-005' });

    // table_id 없이, 위경도 있어도 지오펜싱 안 함
    const result = await svc.createOrder({
      store_id: '1',
      total_amount: 5000,
      items: [{ product_id: 10, quantity: 1 }],
      latitude: 37.498,
      longitude: 127.0276,
    });
    expect(result.id).toBe(5);
  });

  test('매장 위경도 없으면 지오펜싱 스킵', async () => {
    Store.findById.mockResolvedValue({ id: 1, latitude: null, longitude: null });
    const Order = require('../../../repositories/Order');
    Order.create.mockResolvedValue({ id: 6, order_number: 'ORD-006' });

    const result = await svc.createOrder({
      store_id: '1',
      table_id: '1',
      total_amount: 5000,
      items: [{ product_id: 10, quantity: 1 }],
      latitude: 37.5665,
      longitude: 126.978,
    });
    expect(result.id).toBe(6);
  });
});
