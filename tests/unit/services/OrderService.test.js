jest.mock('../../../config/prisma', () => ({
  $transaction: jest.fn(),
  stores: {
    findUnique: jest.fn(),
  },
  tables: {
    findUnique: jest.fn(),
  },
  order_items: {
    findMany: jest.fn(),
  },
  store_customers: {
    findFirst: jest.fn(),
  },
  store_point_settings: {
    findUnique: jest.fn(),
  },
  user_points: {
    findFirst: jest.fn(),
  },
  point_transactions: {
    create: jest.fn(),
    findFirst: jest.fn().mockResolvedValue(null),
  },
  products: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  orders: {
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    update: jest.fn(),
  },
}));
jest.mock('../../../repositories/Order', () => ({
  create: jest.fn(),
  findById: jest.fn(),
  updateStatus: jest.fn(),
}));
jest.mock('../../../repositories/Coupon', () => ({
  findUserCoupon: jest.fn(),
  useCoupon: jest.fn(),
}));
jest.mock('../../../repositories/Table', () => ({
  findByStoreAndTable: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
}));
jest.mock('../../../repositories/Product', () => ({
  findById: jest.fn(),
}));
jest.mock('../../../repositories/Store', () => ({
  findById: jest.fn(),
}));
jest.mock('../../../services/notificationService', () => ({
  notifyNewOrderDB: jest.fn().mockResolvedValue({}),
  notifyOrderStatus: jest.fn(),
  notifyOrderStatusDB: jest.fn().mockResolvedValue({}),
  notifyLowStockDB: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../../services/webhookDispatcher', () => ({
  emitEvent: jest.fn(),
}));
jest.mock('../../../services/printService', () => ({
  createKitchenJob: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../../services/AlimtalkService', () => ({
  sendOrderConfirmed: jest.fn().mockResolvedValue({}),
  sendFoodReady: jest.fn().mockResolvedValue({}),
  sendOrderCancelled: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../../utils/phoneEncryption', () => ({
  encryptPhone: jest.fn((p) => `enc_${p}`),
  decryptPhone: jest.fn((s) => (s ? s.replace('enc_', '') : null)),
  normalizePhone: jest.fn((p) => p || ''),
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
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
jest.mock('../../../controllers/sseController', () => ({
  notifyOrderStatusChange: jest.fn(),
}));

const OrderService = require('../../../services/OrderService');
const Order = require('../../../repositories/Order');
const Coupon = require('../../../repositories/Coupon');
const Table = require('../../../repositories/Table');
const Product = require('../../../repositories/Product');
const Store = require('../../../repositories/Store');
const prisma = require('../../../config/prisma');

describe('OrderService', () => {
  let svc;
  const mockIo = { emit: jest.fn(), to: jest.fn(() => ({ emit: jest.fn() })) };

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new OrderService(mockIo);
    Product.findById.mockResolvedValue({
      id: 100,
      store_id: 1,
      name: '테스트상품',
      price: 3000,
      is_sold_out: false,
      is_active: true,
      stock_quantity: 100,
      options: null,
    });
  });

  describe('createOrder — 지오펜싱', () => {
    beforeEach(() => {
      Store.findById.mockResolvedValue({
        id: 1,
        name: '테스트매장',
        latitude: 37.5665,
        longitude: 126.978,
      });
    });

    test('매장 반경 500m 이내면 주문 성공', async () => {
      // 약 100m 거리
      Table.findByStoreAndTable.mockResolvedValue({ id: 10, table_number: '1' });
      Product.findById.mockResolvedValue({
        id: 100,
        store_id: 1,
        name: '아메리카노',
        price: 4500,
        is_sold_out: false,
        is_active: true,
        stock_quantity: 100,
      });
      Order.create.mockResolvedValue({
        id: 1,
        order_number: 'ORD-001',
        store_id: 1,
        table_id: 10,
        total_amount: 4500,
        status: 'pending',
        order_items: [],
      });

      const result = await svc.createOrder({
        store_id: '1',
        table_id: '1',
        table_number: '1',
        items: [{ product_id: 100, quantity: 1 }],
        total_amount: 4500,
        phone: '01012345678',
        latitude: 37.567,
        longitude: 126.9785,
      });
      expect(result.id).toBe(1);
    });

    test('매장 반경 500m 밖이면 403 에러', async () => {
      await expect(
        svc.createOrder({
          store_id: '1',
          table_id: '1',
          items: [{ product_id: 100, quantity: 1 }],
          total_amount: 4500,
          latitude: 37.7,
          longitude: 127.0,
        })
      ).rejects.toThrow('매장 반경 500m 밖에서는 주문할 수 없습니다.');
    });

    test('테이블 ID 없으면 지오펜싱 검증 스킵', async () => {
      Order.create.mockResolvedValue({
        id: 2,
        order_number: 'ORD-002',
        store_id: 1,
        table_id: null,
        total_amount: 3000,
        status: 'pending',
        order_items: [],
      });
      const result = await svc.createOrder({
        store_id: '1',
        items: [{ product_id: 100, quantity: 1 }],
        total_amount: 3000,
      });
      expect(result.id).toBe(2);
    });

    test('위도/경도 없으면 지오펜싱 검증 스킵', async () => {
      Order.create.mockResolvedValue({
        id: 3,
        order_number: 'ORD-003',
        store_id: 1,
        table_id: 10,
        total_amount: 3000,
        status: 'pending',
        order_items: [],
      });
      Table.findById.mockResolvedValue({ id: 10, table_number: '1', store_id: 1 });
      const result = await svc.createOrder({
        store_id: '1',
        table_id: '10',
        items: [{ product_id: 100, quantity: 1 }],
        total_amount: 3000,
      });
      expect(result.id).toBe(3);
    });
  });

  describe('createOrder — 쿠폰 검증', () => {
    beforeEach(() => {
      Store.findById.mockResolvedValue({ id: 1, name: '테스트매장' });
      Table.findByStoreAndTable.mockResolvedValue(null);
      Product.findById.mockResolvedValue({
        id: 100,
        store_id: 1,
        name: '라떼',
        price: 10000,
        is_sold_out: false,
        is_active: true,
        stock_quantity: 50,
      });
      Order.create.mockResolvedValue({
        id: 4,
        order_number: 'ORD-004',
        store_id: 1,
        total_amount: 10000,
        discount_amount: 2000,
        status: 'pending',
        order_items: [],
      });
    });

    test(' FIXED 쿠폰 적용 시 정액 할인', async () => {
      Coupon.findUserCoupon.mockResolvedValue({
        id: 1,
        customer_phone: '01012345678',
        status: 'UNUSED',
        coupons: { type: 'FIXED', amount: 2000, min_order_amount: 5000 },
      });
      await svc.createOrder({
        store_id: '1',
        user_coupon_id: 1,
        phone: '01012345678',
        items: [{ product_id: 100, quantity: 1 }],
        total_amount: 10000,
      });
      expect(Coupon.useCoupon).not.toHaveBeenCalled();
    });

    test('PERCENT 쿠폰 적용 시 정률 할인', async () => {
      Coupon.findUserCoupon.mockResolvedValue({
        id: 2,
        customer_phone: '01012345678',
        status: 'UNUSED',
        coupons: { type: 'PERCENT', amount: 10, min_order_amount: 0 },
      });
      await svc.createOrder({
        store_id: '1',
        user_coupon_id: 2,
        phone: '01012345678',
        items: [{ product_id: 100, quantity: 1 }],
        total_amount: 10000,
      });
      expect(Coupon.useCoupon).not.toHaveBeenCalled();
    });

    test('사용 완료된 쿠폰이면 400 에러', async () => {
      Coupon.findUserCoupon.mockResolvedValue({
        id: 3,
        customer_phone: '01012345678',
        status: 'USED',
        coupons: { type: 'FIXED', amount: 1000, min_order_amount: 0 },
      });
      await expect(
        svc.createOrder({
          store_id: '1',
          user_coupon_id: 3,
          phone: '01012345678',
          items: [{ product_id: 100, quantity: 1 }],
          total_amount: 10000,
        })
      ).rejects.toThrow('유효하지 않은 쿠폰입니다.');
    });

    test('최소 주문 미달 시 400 에러', async () => {
      Coupon.findUserCoupon.mockResolvedValue({
        id: 4,
        customer_phone: '01012345678',
        status: 'UNUSED',
        coupons: { type: 'FIXED', amount: 1000, min_order_amount: 20000 },
      });
      await expect(
        svc.createOrder({
          store_id: '1',
          user_coupon_id: 4,
          phone: '01012345678',
          items: [{ product_id: 100, quantity: 1 }],
          total_amount: 10000,
        })
      ).rejects.toThrow('최소 20,000원 이상');
    });
  });

  describe('createOrder — 재고 검증', () => {
    beforeEach(() => {
      Store.findById.mockResolvedValue({ id: 1, name: '테스트매장' });
    });

    test('품절 상품이 있으면 409 에러', async () => {
      Product.findById.mockResolvedValue({
        id: 200,
        store_id: 1,
        name: '만두',
        price: 5000,
        is_sold_out: true,
        is_active: true,
        stock_quantity: 0,
      });
      await expect(
        svc.createOrder({
          store_id: '1',
          items: [{ product_id: 200, quantity: 1 }],
          total_amount: 5000,
        })
      ).rejects.toThrow('품절');
    });

    test('재고 부족 시 409 에러', async () => {
      Product.findById.mockResolvedValue({
        id: 201,
        store_id: 1,
        name: '떡볶이',
        price: 1600,
        is_sold_out: false,
        is_active: true,
        stock_quantity: 2,
      });
      await expect(
        svc.createOrder({
          store_id: '1',
          items: [{ product_id: 201, quantity: 5 }],
          total_amount: 8000,
        })
      ).rejects.toThrow('재고 부족');
    });
  });

  describe('createOrder — 매장 미존재', () => {
    test('매장 없으면 404 에러', async () => {
      Store.findById.mockResolvedValue(null);
      await expect(
        svc.createOrder({
          store_id: '999',
          total_amount: 5000,
        })
      ).rejects.toThrow('매장을 찾을 수 없습니다.');
    });
  });

  describe('updateStatus', () => {
    beforeEach(() => {
      Order.findById.mockResolvedValue({
        id: 1,
        status: 'pending',
        store_id: 1,
        table_id: 10,
        customer_phone: 'enc_01012345678',
        order_number: 'ORD-001',
      });
      Order.updateStatus.mockResolvedValue({
        id: 1,
        status: 'confirmed',
        store_id: 1,
        table_id: 10,
        customer_phone: 'enc_01012345678',
        order_number: 'ORD-001',
      });
      prisma.order_items.findMany.mockResolvedValue([{ product_id: 100, quantity: 2 }]);
      prisma.products.findUnique.mockResolvedValue({
        id: 100,
        name: '아메리카노',
        store_id: 1,
        stock_quantity: 50,
        low_stock_threshold: 5,
      });
      prisma.tables.findUnique.mockResolvedValue({ table_number: '1' });
      prisma.$transaction.mockImplementation(async (fn) =>
        fn({
          $queryRaw: jest.fn().mockResolvedValue([
            {
              id: 100,
              name: '아메리카노',
              store_id: 1,
              stock_quantity: 50,
              low_stock_threshold: 5,
            },
          ]),
          products: {
            findUnique: jest.fn().mockResolvedValue({
              id: 100,
              name: '아메리카노',
              store_id: 1,
              stock_quantity: 50,
              low_stock_threshold: 5,
            }),
            update: jest.fn().mockResolvedValue({}),
          },
          stock_history: {
            create: jest.fn().mockResolvedValue({}),
            findFirst: jest.fn().mockResolvedValue(null),
          },
        })
      );
      prisma.stores.findUnique.mockResolvedValue({ name: '테스트매장' });
    });

    test('pending → confirmed 시 재고 차감', async () => {
      prisma.tables.findUnique.mockResolvedValue({ table_number: '1' });
      await svc.updateStatus(1, 'confirmed');
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    test('confirmed → completed 시 테이블 상태 변경', async () => {
      Order.findById.mockResolvedValue({
        id: 1,
        status: 'confirmed',
        store_id: 1,
        table_id: 10,
        customer_phone: null,
        order_number: 'ORD-001',
      });
      Order.updateStatus.mockResolvedValue({
        id: 1,
        status: 'completed',
        store_id: 1,
        table_id: 10,
        customer_phone: null,
        order_number: 'ORD-001',
      });
      await svc.updateStatus(1, 'completed');
      expect(Table.update).toHaveBeenCalledWith(10, { status: 'dirty' });
    });
  });

  describe('cancelOrder', () => {
    test('이미 취소된 주문은 성공 반환', async () => {
      Order.findById.mockResolvedValue({ id: 1, status: 'cancelled', store_id: 1 });
      const result = await svc.cancelOrder(1, 'user1', 'super_admin');
      expect(result.success).toBe(true);
      expect(result.message).toContain('이미 취소된 주문');
    });

    test('super_admin이면 권한 검증 스킵', async () => {
      Order.findById.mockResolvedValue({ id: 2, status: 'pending', store_id: 1 });
      Order.updateStatus.mockResolvedValue({ id: 2, status: 'cancelled' });
      const result = await svc.cancelOrder(2, 'admin1', 'super_admin');
      expect(result.success).toBe(true);
    });

    test('KDS 수락 후(pending 아님) 취소 시 재고 복구', async () => {
      Order.findById.mockResolvedValue({ id: 3, status: 'confirmed', store_id: 1 });
      Order.updateStatus.mockResolvedValue({ id: 3, status: 'cancelled' });
      prisma.order_items.findMany.mockResolvedValue([{ product_id: 100, quantity: 2 }]);
      prisma.products.findMany.mockResolvedValue([{ id: 100, store_id: 1, stock_quantity: 48 }]);
      prisma.$transaction.mockImplementation(async (fn) =>
        fn({
          products: {
            update: jest.fn().mockResolvedValue({ id: 100, store_id: 1, stock_quantity: 50 }),
          },
          stock_history: {
            create: jest.fn().mockResolvedValue({}),
          },
        })
      );
      await svc.cancelOrder(3, 'admin1', 'super_admin');
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    test('pending 상태 취소 시 재고 복구 스킵', async () => {
      Order.findById.mockResolvedValue({ id: 4, status: 'pending', store_id: 1 });
      Order.updateStatus.mockResolvedValue({ id: 4, status: 'cancelled' });
      const result = await svc.cancelOrder(4, 'admin1', 'super_admin');
      expect(result.success).toBe(true);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('_processLoyaltyPoints', () => {
    const mockTx = () => ({
      store_customers: {
        findFirst: jest.fn().mockResolvedValue({ id: 1, visit_count: 5, total_spent: 20000 }),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      user_points: {
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      point_transactions: {
        create: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    });

    test('전화번호 없으면 스킵', async () => {
      await svc._processLoyaltyPoints({ customer_phone: null, store_id: 1 });
      expect(prisma.store_customers.findFirst).not.toHaveBeenCalled();
    });

    test('포인트 설정 비활성화 시 스킵', async () => {
      prisma.store_point_settings.findUnique.mockResolvedValue({ is_enabled: false });
      const tx = mockTx();
      prisma.$transaction.mockImplementation(async (fn) => fn(tx));
      await svc._processLoyaltyPoints({
        customer_phone: 'enc_01012345678',
        store_id: 1,
        total_amount: 10000,
        id: 1,
        order_number: 'ORD-001',
      });
      expect(tx.user_points.findFirst).not.toHaveBeenCalled();
    });

    test('최소 주문 미달 시 스킵', async () => {
      prisma.store_point_settings.findUnique.mockResolvedValue({
        is_enabled: true,
        min_earn_amount: 10000,
        earn_rate: 5,
      });
      const tx = mockTx();
      prisma.$transaction.mockImplementation(async (fn) => fn(tx));
      await svc._processLoyaltyPoints({
        customer_phone: 'enc_01012345678',
        store_id: 1,
        total_amount: 5000,
        id: 1,
        order_number: 'ORD-002',
      });
      expect(tx.user_points.findFirst).not.toHaveBeenCalled();
    });
  });
});
