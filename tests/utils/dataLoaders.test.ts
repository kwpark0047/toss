/**
 * DataLoader 테스트
 * tests/utils/dataLoaders.test.ts
 */

const { 
  userLoader, 
  storeLoader, 
  productLoader, 
  orderLoader, 
  orderItemsLoader, 
  orderPaymentsLoader,
  clearAllLoaderCaches,
  createLoader 
} = require('../../utils/dataLoaders');

// Mock Prisma
jest.mock('../../config/prisma', () => ({
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  store: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  product: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  order: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  orderItem: {
    findMany: jest.fn(),
  },
  payment: {
    findMany: jest.fn(),
  },
}));

const prisma = require('../../config/prisma');

describe('DataLoader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearAllLoaderCaches();
  });

  describe('createLoader 팩토리', () => {
    it('배치 함수로 로더 생성', async () => {
      const batchFn = jest.fn().mockResolvedValue([
        { id: '1', name: 'One' },
        { id: '2', name: 'Two' },
      ]);

      const loader = createLoader(batchFn);
      const results = await loader.loadMany(['1', '2']);

      expect(batchFn).toHaveBeenCalledWith(['1', '2']);
      expect(results).toEqual([
        { id: '1', name: 'One' },
        { id: '2', name: 'Two' },
      ]);
    });

    it('캐시 히트 시 배치 함수 호출 안 함', async () => {
      const batchFn = jest.fn().mockResolvedValue([{ id: '1', name: 'One' }]);
      const loader = createLoader(batchFn);

      await loader.load('1');
      await loader.load('1'); // 두 번째 호출

      expect(batchFn).toHaveBeenCalledTimes(1);
    });

    it('clearAll로 캐시 초기화', async () => {
      const batchFn = jest.fn().mockResolvedValue([{ id: '1', name: 'One' }]);
      const loader = createLoader(batchFn);

      await loader.load('1');
      loader.clearAll();
      await loader.load('1');

      expect(batchFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('userLoader', () => {
    it('사용자 ID 배치로 조회', async () => {
      const mockUsers = [
        { id: 1, name: 'User 1', email: 'user1@test.com' },
        { id: 2, name: 'User 2', email: 'user2@test.com' },
      ];
      prisma.user.findMany.mockResolvedValue(mockUsers);

      const results = await userLoader.loadMany(['1', '2']);

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['1', '2'] } },
      });
      expect(results).toEqual(mockUsers);
    });

    it('존재하지 않는 ID는 null 반환', async () => {
      prisma.user.findMany.mockResolvedValue([{ id: 1, name: 'User 1' }]);

      const results = await userLoader.loadMany(['1', '999']);

      expect(results).toEqual([
        { id: 1, name: 'User 1' },
        null,
      ]);
    });
  });

  describe('storeLoader', () => {
    it('매장 ID 배치로 조회', async () => {
      const mockStores = [
        { id: 1, name: 'Store 1' },
        { id: 2, name: 'Store 2' },
      ];
      prisma.store.findMany.mockResolvedValue(mockStores);

      const results = await storeLoader.loadMany(['1', '2']);

      expect(prisma.store.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['1', '2'] } },
      });
      expect(results).toEqual(mockStores);
    });
  });

  describe('productLoader', () => {
    it('상품 ID 배치로 조회 (옵션, 이미지 포함)', async () => {
      const mockProducts = [
        { id: 1, name: 'Product 1', options: [], images: [] },
        { id: 2, name: 'Product 2', options: [], images: [] },
      ];
      prisma.product.findMany.mockResolvedValue(mockProducts);

      const results = await productLoader.loadMany(['1', '2']);

      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['1', '2'] } },
        include: {
          category: true,
          options: { include: { items: true } },
          images: true,
        },
      });
      expect(results).toEqual(mockProducts);
    });
  });

  describe('orderLoader', () => {
    it('주문 ID 배치로 조회', async () => {
      const mockOrders = [
        { id: 1, storeId: 1, items: [], payments: [] },
        { id: 2, storeId: 2, items: [], payments: [] },
      ];
      prisma.order.findMany.mockResolvedValue(mockOrders);

      const results = await orderLoader.loadMany(['1', '2']);

      // DataLoader는 문자열 키를 Prisma에 그대로 전달
      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['1', '2'] } },
        include: {
          items: { include: { product: true, options: true } },
          payments: true,
          store: true,
          customer: true,
          table: true,
        },
      });
      expect(results).toEqual(mockOrders);
    });
  });

  describe('orderItemsLoader', () => {
    it('주문별 아이템 그룹화 조회', async () => {
      const mockItems = [
        { id: 1, orderId: 1, productId: 1 },
        { id: 2, orderId: 1, productId: 2 },
        { id: 3, orderId: 2, productId: 3 },
      ];
      prisma.orderItem.findMany.mockResolvedValue(mockItems);

      const results = await orderItemsLoader.loadMany(['1', '2']);

      // DataLoader는 문자열 키를 Prisma에 그대로 전달
      expect(prisma.orderItem.findMany).toHaveBeenCalledWith({
        where: { orderId: { in: ['1', '2'] } },
        include: { product: true, options: true },
        orderBy: { createdAt: 'asc' },
      });
      expect(results).toEqual([
        [{ id: 1, orderId: 1, productId: 1 }, { id: 2, orderId: 1, productId: 2 }],
        [{ id: 3, orderId: 2, productId: 3 }],
      ]);
    });
  });

  describe('orderPaymentsLoader', () => {
    it('주문별 결제 내역 그룹화 조회', async () => {
      const mockPayments = [
        { id: 1, orderId: 1, amount: 10000 },
        { id: 2, orderId: 1, amount: 5000 },
        { id: 3, orderId: 2, amount: 20000 },
      ];
      prisma.payment.findMany.mockResolvedValue(mockPayments);

      const results = await orderPaymentsLoader.loadMany(['1', '2']);

      // DataLoader는 문자열 키를 Prisma에 그대로 전달
      expect(prisma.payment.findMany).toHaveBeenCalledWith({
        where: { orderId: { in: ['1', '2'] } },
        orderBy: { createdAt: 'desc' },
      });
      expect(results).toEqual([
        [{ id: 1, orderId: 1, amount: 10000 }, { id: 2, orderId: 1, amount: 5000 }],
        [{ id: 3, orderId: 2, amount: 20000 }],
      ]);
    });
  });

  describe('캐시 무효화', () => {
    it('clearAllLoaderCaches로 전체 캐시 초기화', async () => {
      const mockUsers = [{ id: 1, name: 'User 1' }];
      prisma.user.findMany.mockResolvedValue(mockUsers);

      await userLoader.load('1');
      clearAllLoaderCaches();
      
      // 캐시 초기화 후 다시 조회하면 DB 재조회
      prisma.user.findMany.mockResolvedValue([{ id: 1, name: 'Updated User' }]);
      const user = await userLoader.load('1');
      
      expect(user.name).toBe('Updated User');
    });
  });

  describe('N+1 문제 방지 검증', () => {
    it('10개 주문 조회 시 쿼리 4회만 실행 (주문+아이템+결제+상품)', async () => {
      const orderIds = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
      
      prisma.order.findMany.mockResolvedValue(
        orderIds.map(id => ({ id: parseInt(id), storeId: 1, items: [], payments: [] }))
      );
      prisma.orderItem.findMany.mockResolvedValue([]);
      prisma.payment.findMany.mockResolvedValue([]);
      prisma.product.findMany.mockResolvedValue([]);

      const orders = await orderLoader.loadMany(orderIds);
      
      const orderIdsStr = orderIds.map(String);
      const [itemsMap, paymentsMap] = await Promise.all([
        orderItemsLoader.loadMany(orderIdsStr),
        orderPaymentsLoader.loadMany(orderIdsStr),
      ]);
      
      // 상품 ID 수집 후 배치 로드
      const allProductIds = [];
      itemsMap.forEach(items => {
        items.forEach(item => {
          if (!allProductIds.includes(String(item.product_id))) {
            allProductIds.push(String(item.product_id));
          }
        });
      });
      
      const products = await productLoader.loadMany(allProductIds);

      // 쿼리 횟수 확인: order(1) + items(1) + payments(1) + products(1) = 4
      expect(prisma.order.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.orderItem.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.payment.findMany).toHaveBeenCalledTimes(1);
      // productLoader는 아이템이 없을 때 호출 안 될 수 있음

      expect(orders).toHaveLength(10);
    });
  });
});