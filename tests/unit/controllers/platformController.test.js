jest.mock('../../../config/prisma', () => ({
  stores: {
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  store_customers: { count: jest.fn() },
  orders: { count: jest.fn() },
  user_points: { aggregate: jest.fn() },
}));
jest.mock('../../../utils/logger', () => ({ warn: jest.fn(), info: jest.fn() }));
jest.mock('../../../repositories/Store', () => ({ update: jest.fn() }));
jest.mock('../../../services/StoreInfoEnhancementService', () => ({
  generateCompletionReport: jest.fn(),
  enhanceStoreInfo: jest.fn(),
  autoCompleteStoreInfo: jest.fn(),
}));

const prisma = require('../../../config/prisma');
const Store = require('../../../repositories/Store');
const service = require('../../../services/StoreInfoEnhancementService');
const controller = require('../../../controllers/platformController');

const makeRes = (overrides = {}) => {
  const mock = {
    status: jest.fn(() => mock),
    json: jest.fn(),
    success: jest.fn(),
    updated: jest.fn(),
    ...overrides,
  };
  return mock;
};

describe('platformController.getStores (완성도 스코어)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('infoScore/infoLevel를 각 매장에 계산해 반환한다', async () => {
    prisma.stores.count.mockResolvedValue(1);
    prisma.stores.findMany.mockResolvedValue([
      {
        id: 1,
        name: '테스트매장',
        address: '서울시',
        is_active: true,
        business_type: '치킨',
        phone: '010-1234-5678',
        created_at: new Date(),
        plan: 'pro',
        latitude: 37.5,
        longitude: 127.0,
        description: '설명',
        business_number: '123-45-67890',
        ceo_name: '김대표',
        business_address: '서울시 강남구',
        open_time: '10:00',
        close_time: '22:00',
        _count: { orders: 3, store_customers: 5 },
      },
    ]);

    const res = makeRes();
    controller.getStores({ query: {} }, res, jest.fn());

    await new Promise((resolve) => setImmediate(resolve));

    expect(res.success).toHaveBeenCalledTimes(1);
    const { stores } = res.success.mock.calls[0][0];
    expect(stores[0].infoScore).toBe(100);
    expect(stores[0].infoLevel).toBe('good');
  });

  test('누락 필드가 많으면 poor 레벨이 된다', async () => {
    prisma.stores.count.mockResolvedValue(1);
    prisma.stores.findMany.mockResolvedValue([
      {
        id: 1,
        name: '미완성',
        address: null,
        is_active: true,
        business_type: null,
        phone: null,
        latitude: null,
        longitude: null,
        description: null,
        business_number: null,
        ceo_name: null,
        business_address: null,
        open_time: null,
        close_time: null,
        _count: { orders: 0, store_customers: 0 },
      },
    ]);

    const res = makeRes();
    controller.getStores({ query: {} }, res, jest.fn());

    await new Promise((resolve) => setImmediate(resolve));

    expect(res.success).toHaveBeenCalledTimes(1);
    const { stores } = res.success.mock.calls[0][0];
    expect(stores[0].infoScore).toBe(8);
    expect(stores[0].infoLevel).toBe('poor');
  });
});

describe('platformController.getEnrichmentCoverage', () => {
  beforeEach(() => jest.clearAllMocks());

  test('필드별 누락 수와 전체 점수를 반환한다', async () => {
    prisma.stores.count
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(50)
      .mockResolvedValueOnce(50)
      .mockResolvedValueOnce(20)
      .mockResolvedValueOnce(30)
      .mockResolvedValueOnce(40)
      .mockResolvedValueOnce(40)
      .mockResolvedValueOnce(40);

    const res = makeRes();
    controller.getEnrichmentCoverage({}, res, jest.fn());

    await new Promise((resolve) => setImmediate(resolve));

    expect(res.success).toHaveBeenCalledTimes(1);
    const payload = res.success.mock.calls[0][0];
    expect(payload.totalStores).toBe(100);
    expect(payload.coverage.phone.missing).toBe(10);
    expect(payload.coverage.business_type.missing).toBe(5);
    expect(payload.coverage.latitude.missing).toBe(50);
    expect(payload.coverage.longitude.missing).toBe(50);
    expect(payload.overallScore).toBe(68);
  });
});

describe('platformController.getStoreCompletion', () => {
  beforeEach(() => jest.clearAllMocks());

  test('매장이 없으면 404를 반환한다', async () => {
    prisma.stores.findUnique.mockResolvedValue(null);
    const res = makeRes();

    controller.getStoreCompletion({ params: { id: '999' } }, res, jest.fn());

    await new Promise((resolve) => setImmediate(resolve));
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('완성도 리포트를 반환한다', async () => {
    prisma.stores.findUnique.mockResolvedValue({ id: 1, name: '매장' });
    service.generateCompletionReport.mockResolvedValue({ completionScore: 75, storeId: 1 });

    const res = makeRes();
    controller.getStoreCompletion({ params: { id: '1' } }, res, jest.fn());

    await new Promise((resolve) => setImmediate(resolve));

    expect(service.generateCompletionReport).toHaveBeenCalledWith(1);
    expect(res.success).toHaveBeenCalledWith({ completionScore: 75, storeId: 1 });
  });
});

describe('platformController.runStoreEnhance', () => {
  beforeEach(() => jest.clearAllMocks());

  test('autoSave=true 시 자동 저장 경로를 호출한다', async () => {
    prisma.stores.findUnique.mockResolvedValue({ id: 1, name: '매장' });
    service.autoCompleteStoreInfo.mockResolvedValue({ saved: true, newCompletion: 90 });

    const res = makeRes();
    controller.runStoreEnhance(
      { params: { id: '1' }, query: { autoSave: 'true' } },
      res,
      jest.fn()
    );

    await new Promise((resolve) => setImmediate(resolve));

    expect(service.autoCompleteStoreInfo).toHaveBeenCalledWith(1, { autoSave: true });
    expect(res.success).toHaveBeenCalled();
    const args = res.success.mock.calls[0][0];
    expect(args.saved).toBe(true);
  });

  test('autoSave=false 시 제안만 생성한다', async () => {
    prisma.stores.findUnique.mockResolvedValue({ id: 1, name: '매장' });
    service.enhanceStoreInfo.mockResolvedValue({
      originalCompletion: 40,
      newCompletion: 70,
      enhancements: { business_type: '치킨' },
    });

    const res = makeRes();
    controller.runStoreEnhance({ params: { id: '1' }, query: {} }, res, jest.fn());

    await new Promise((resolve) => setImmediate(resolve));

    expect(service.enhanceStoreInfo).toHaveBeenCalledWith(1);
    expect(res.success).toHaveBeenCalled();
    const args = res.success.mock.calls[0][0];
    expect(args.newCompletion).toBe(70);
  });

  test('서비스 실패 시 502를 반환한다', async () => {
    prisma.stores.findUnique.mockResolvedValue({ id: 1, name: '매장' });
    service.enhanceStoreInfo.mockRejectedValue(new Error('AI 다운'));

    const res = makeRes();
    controller.runStoreEnhance({ params: { id: '1' }, query: {} }, res, jest.fn());

    await new Promise((resolve) => setImmediate(resolve));

    expect(res.status).toHaveBeenCalledWith(502);
  });
});

describe('platformController.applyStoreEnhance', () => {
  beforeEach(() => jest.clearAllMocks());

  test('허용 필드만 필터링해 업데이트한다', async () => {
    Store.update.mockResolvedValue({ id: 1, business_type: '카페' });

    const res = makeRes();
    controller.applyStoreEnhance(
      {
        params: { id: '1' },
        body: { enhancements: { business_type: '카페', description: '새 설명', evil_field: 'x' } },
      },
      res,
      jest.fn()
    );

    await new Promise((resolve) => setImmediate(resolve));

    expect(Store.update).toHaveBeenCalledWith(1, { business_type: '카페', description: '새 설명' });
    const args = res.success.mock.calls[0][0];
    expect(args.applied).toEqual(['business_type', 'description']);
  });

  test('빈 본문이면 400을 반환한다', async () => {
    const res = makeRes();
    controller.applyStoreEnhance({ params: { id: '1' }, body: {} }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('허용 필드가 하나도 없으면 400을 반환한다', async () => {
    const res = makeRes();
    controller.applyStoreEnhance(
      { params: { id: '1' }, body: { enhancements: { evil_field: 'x' } } },
      res,
      jest.fn()
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
