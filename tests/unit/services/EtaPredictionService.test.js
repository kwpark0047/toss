jest.mock('../../../utils/logger', () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../../../config/prisma', () => ({
  orders: { count: jest.fn() },
  products: { findMany: jest.fn() },
}));

const prisma = require('../../../config/prisma');
const EtaPredictionService = require('../../../services/EtaPredictionService');

describe('EtaPredictionService', () => {
  beforeEach(() => jest.clearAllMocks());

  test('싱글턴 인스턴스로 export 되어 바로 호출할 수 있다', () => {
    expect(typeof EtaPredictionService.calculateEta).toBe('function');
  });

  test('가장 오래 걸리는 메뉴 조리 시간 + 앞선 주문 + 추가 수량으로 계산한다', async () => {
    prisma.orders.count.mockResolvedValue(3);
    prisma.products.findMany.mockResolvedValue([{ cooking_time: 8 }, { cooking_time: 15 }]);

    const eta = await EtaPredictionService.calculateEta('7', [
      { product_id: 1, quantity: 2 },
      { product_id: 2, quantity: 1 },
    ]);

    // 15(최장 조리) + 3*2(앞선 주문) + (3-1)*1(추가 수량) = 23
    expect(eta).toMatchObject({ etaMinutes: 23, activeOrdersAhead: 3 });
    expect(prisma.products.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { store_id: 7, id: { in: [1, 2] } } })
    );
  });

  test('메뉴 정보가 없으면 기본 10분을 쓰고 5~90분 범위로 제한한다', async () => {
    prisma.orders.count.mockResolvedValue(0);
    expect((await EtaPredictionService.calculateEta(7, [])).etaMinutes).toBe(10);

    prisma.orders.count.mockResolvedValue(100);
    expect((await EtaPredictionService.calculateEta(7, [])).etaMinutes).toBe(90);
    expect(prisma.products.findMany).not.toHaveBeenCalled();
  });

  test('DB 오류 시 15분 기본값을 돌려준다', async () => {
    prisma.orders.count.mockRejectedValue(new Error('db down'));
    expect((await EtaPredictionService.calculateEta(7, [])).etaMinutes).toBe(15);
  });
});
