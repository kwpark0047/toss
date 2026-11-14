// 주문 유형(매장 식사/포장/배달) 스위치와 직접 배달 주문 생성·진행 규칙
jest.mock('../../../config/prisma', () => ({
  stores: { findUnique: jest.fn() },
  tables: { findUnique: jest.fn() },
  orders: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), update: jest.fn() },
}));
jest.mock('../../../repositories/Order', () => ({ create: jest.fn(), findById: jest.fn() }));
jest.mock('../../../repositories/Table', () => ({
  findByStoreAndTable: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
}));
jest.mock('../../../repositories/Product', () => ({ findById: jest.fn() }));
jest.mock('../../../repositories/Store', () => ({ findById: jest.fn() }));
jest.mock('../../../repositories/Coupon', () => ({ findUserCoupon: jest.fn() }));
jest.mock('../../../repositories/OrderChannels', () => {
  const actual = jest.requireActual('../../../repositories/OrderChannels');
  return { ...actual, findByStoreId: jest.fn() };
});
jest.mock('../../../services/DeliveryService', () => ({ quote: jest.fn() }));
jest.mock('../../../utils/errorHandler', () => ({
  AppError: class AppError extends Error {
    constructor(msg, status) {
      super(msg);
      this.status = status;
    }
  },
}));
jest.mock('../../../utils/phoneEncryption', () => ({
  encryptPhone: jest.fn((p) => `enc_${p}`),
  decryptPhone: jest.fn(),
  normalizePhone: jest.fn((p) => p || ''),
}));
jest.mock('../../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../../../services/notificationService', () => ({
  notifyNewOrderDB: jest.fn().mockResolvedValue({}),
  notifyOrderStatus: jest.fn(),
  notifyOrderStatusDB: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../../services/webhookDispatcher', () => ({ emitEvent: jest.fn() }));
jest.mock('../../../services/printService', () => ({
  createKitchenJob: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../../services/AlimtalkService', () => ({}));

const Order = require('../../../repositories/Order');
const Product = require('../../../repositories/Product');
const Store = require('../../../repositories/Store');
const Table = require('../../../repositories/Table');
const OrderChannels = require('../../../repositories/OrderChannels');
const DeliveryService = require('../../../services/DeliveryService');
const prisma = require('../../../config/prisma');
const OrderService = require('../../../services/OrderService');

const channels = (over = {}) => ({ ...OrderChannels.DEFAULTS, ...over });
const onlineOnly = channels({ dine_in_enabled: false, delivery_enabled: true, delivery_fee: 3000 });
const items = [{ product_id: 100, quantity: 2 }];

describe('OrderService 주문 유형', () => {
  let svc;
  beforeEach(() => {
    jest.clearAllMocks();
    svc = new OrderService({ emit: jest.fn(), to: jest.fn(() => ({ emit: jest.fn() })) });
    Store.findById.mockResolvedValue({ id: 1, name: '매장', latitude: 37.5, longitude: 127 });
    Product.findById.mockResolvedValue({
      id: 100,
      store_id: 1,
      name: '도시락',
      price: 9000,
      is_sold_out: false,
      is_active: true,
      stock_quantity: null,
    });
    Order.create.mockImplementation(async (data) => ({
      id: 5,
      order_number: 'N',
      status: 'pending',
      order_items: [],
      ...data,
    }));
  });

  test('유형을 안 보내는 기존 클라이언트: 매장 식사를 받는 매장은 dine_in', async () => {
    OrderChannels.findByStoreId.mockResolvedValue(channels());
    await svc.createOrder({ store_id: 1, items, total_amount: 18000 });
    expect(Order.create).toHaveBeenCalledWith(
      expect.objectContaining({ order_type: 'dine_in', is_takeout: false })
    );
  });

  test('유형을 안 보내는 기존 클라이언트: 온라인 전용 매장은 포장', async () => {
    OrderChannels.findByStoreId.mockResolvedValue(onlineOnly);
    await svc.createOrder({ store_id: 1, items, total_amount: 18000, payment_method: 'toss' });
    expect(Order.create).toHaveBeenCalledWith(
      expect.objectContaining({ order_type: 'takeout', is_takeout: true })
    );
  });

  test('매장 식사를 끈 매장은 테이블 주문을 거절', async () => {
    OrderChannels.findByStoreId.mockResolvedValue(onlineOnly);
    await expect(
      svc.createOrder({
        store_id: 1,
        table_number: '3',
        items,
        total_amount: 18000,
        order_type: 'dine_in',
      })
    ).rejects.toThrow('매장 식사 주문을 받지 않습니다');
    expect(Table.findByStoreAndTable).not.toHaveBeenCalled();
  });

  test('포장·배달 주문에 테이블을 붙이면 거절', async () => {
    OrderChannels.findByStoreId.mockResolvedValue(channels());
    await expect(
      svc.createOrder({
        store_id: 1,
        table_number: '3',
        items,
        total_amount: 18000,
        order_type: 'takeout',
      })
    ).rejects.toThrow('테이블을 지정할 수 없습니다');
  });

  test('배달을 안 받는 매장의 배달 주문은 409', async () => {
    OrderChannels.findByStoreId.mockResolvedValue(channels());
    await expect(
      svc.createOrder({
        store_id: 1,
        items,
        total_amount: 18000,
        order_type: 'delivery',
        phone: '01011112222',
      })
    ).rejects.toMatchObject({ status: 409 });
  });

  test('배달은 현장 결제·전화번호 없는 주문을 거절', async () => {
    OrderChannels.findByStoreId.mockResolvedValue(onlineOnly);
    await expect(
      svc.createOrder({
        store_id: 1,
        items,
        total_amount: 18000,
        order_type: 'delivery',
        payment_method: 'cash',
        phone: '01011112222',
      })
    ).rejects.toThrow('온라인 결제');
    await expect(
      svc.createOrder({
        store_id: 1,
        items,
        total_amount: 18000,
        order_type: 'delivery',
        payment_method: 'toss',
      })
    ).rejects.toThrow('전화번호');
  });

  test('배달 권역 밖이면 견적 사유로 거절', async () => {
    OrderChannels.findByStoreId.mockResolvedValue(onlineOnly);
    DeliveryService.quote.mockResolvedValue({
      deliverable: false,
      reason: '배달 가능 거리(3km)를 벗어났습니다.',
    });
    await expect(
      svc.createOrder({
        store_id: 1,
        items,
        total_amount: 18000,
        order_type: 'delivery',
        payment_method: 'toss',
        phone: '01011112222',
        delivery_address: '먼 곳로 1',
      })
    ).rejects.toThrow('벗어났습니다');
  });

  test('배달 주문은 서버 합계로 견적을 받고 배달비를 더해 저장한다', async () => {
    OrderChannels.findByStoreId.mockResolvedValue(onlineOnly);
    DeliveryService.quote.mockResolvedValue({ deliverable: true, fee: 3000 });
    await svc.createOrder({
      store_id: 1,
      items,
      total_amount: 18000,
      order_type: 'delivery',
      payment_method: 'toss',
      phone: '01011112222',
      delivery_address: ' 서울 강남구 테헤란로 1 ',
      delivery_memo: '문 앞',
    });
    expect(DeliveryService.quote).toHaveBeenCalledWith(
      expect.objectContaining({ subtotal: 18000, address: ' 서울 강남구 테헤란로 1 ' })
    );
    expect(Order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        order_type: 'delivery',
        delivery_fee: 3000,
        delivery_address: '서울 강남구 테헤란로 1',
        delivery_memo: '문 앞',
        total_amount: 21000,
        table_id: null,
      })
    );
  });
});

describe('OrderService.updateDelivery', () => {
  let svc;
  beforeEach(() => {
    jest.clearAllMocks();
    svc = new OrderService(null);
    prisma.orders.updateMany.mockResolvedValue({ count: 1 });
  });

  test('배달 주문이 아니면 거절', async () => {
    Order.findById.mockResolvedValue({ id: 1, order_type: 'takeout', status: 'ready' });
    await expect(svc.updateDelivery(1, 'start')).rejects.toThrow('배달 주문이 아닙니다');
  });

  test('출발: 준비 완료로 맞춘 뒤 delivering 기록', async () => {
    Order.findById
      .mockResolvedValueOnce({
        id: 1,
        order_type: 'delivery',
        status: 'preparing',
        delivery_status: null,
      })
      .mockResolvedValue({
        id: 1,
        store_id: 1,
        order_type: 'delivery',
        status: 'ready',
        delivery_status: 'delivering',
      });
    const spy = jest.spyOn(svc, 'updateStatus').mockResolvedValue({});
    const out = await svc.updateDelivery(1, 'start', null);
    expect(spy).toHaveBeenCalledWith(1, 'ready', null, null);
    expect(prisma.orders.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1, delivery_status: null, status: 'ready' },
        data: expect.objectContaining({ delivery_status: 'delivering' }),
      })
    );
    expect(out.delivery_status).toBe('delivering');
  });

  test('완료: delivering일 때만 delivered로 바꾸고 주문 완료', async () => {
    Order.findById.mockResolvedValue({
      id: 1,
      store_id: 1,
      order_type: 'delivery',
      status: 'ready',
      delivery_status: 'delivering',
    });
    const spy = jest.spyOn(svc, 'updateStatus').mockResolvedValue({});
    await svc.updateDelivery(1, 'complete', null);
    expect(spy).toHaveBeenCalledWith(1, 'completed', null, null);
    prisma.orders.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(svc.updateDelivery(1, 'complete', null)).rejects.toMatchObject({ status: 409 });
  });

  test('이미 출발한 주문은 다시 출발할 수 없다', async () => {
    Order.findById.mockResolvedValue({
      id: 1,
      order_type: 'delivery',
      status: 'ready',
      delivery_status: 'delivering',
    });
    await expect(svc.updateDelivery(1, 'start')).rejects.toThrow('이미 배달을 출발');
  });
});
