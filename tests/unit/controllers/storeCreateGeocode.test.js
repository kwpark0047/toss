const mockPrisma = { stores: { updateMany: jest.fn() } };
jest.mock('../../../config/prisma', () => mockPrisma);
jest.mock('../../../repositories/Store', () => ({}));
const mockService = { createStoreWithMatching: jest.fn(), flushStoreCache: jest.fn() };
jest.mock('../../../services/StoreService', () => jest.fn().mockImplementation(() => mockService));
const mockGeocode = { isConfigured: jest.fn(() => true), geocode: jest.fn() };
jest.mock('../../../services/geocodeService', () => mockGeocode);

const storeController = require('../../../controllers/storeController');

const flush = () => new Promise((r) => setImmediate(r));
const makeRes = () => ({ created: jest.fn(), success: jest.fn() });

describe('신규 매장 생성 후 백그라운드 지오코딩', () => {
  beforeEach(() => jest.clearAllMocks());

  test('주소가 있고 좌표가 없으면 응답 후 좌표를 채운다 (비어 있을 때만)', async () => {
    mockService.createStoreWithMatching.mockResolvedValue({ store: { id: 5, address: '서울 중구 세종대로 110', latitude: null } });
    mockGeocode.geocode.mockResolvedValue({ lat: 37.566317, lng: 126.977829 });
    mockPrisma.stores.updateMany.mockResolvedValue({ count: 1 });
    const res = makeRes();

    await storeController.createStore({ body: { name: 'a' }, user: { id: 1 } }, res);
    expect(res.created).toHaveBeenCalled();
    await flush();

    expect(mockPrisma.stores.updateMany).toHaveBeenCalledWith({
      where: { id: 5, latitude: null, longitude: null },
      data: { latitude: 37.566317, longitude: 126.977829 },
    });
    expect(mockService.flushStoreCache).toHaveBeenCalledWith(5);
  });

  test('이미 좌표가 있거나 주소가 없으면 호출하지 않는다', async () => {
    mockService.createStoreWithMatching.mockResolvedValueOnce({ store: { id: 6, address: '서울', latitude: 37.5 } });
    await storeController.createStore({ body: {}, user: { id: 1 } }, makeRes());
    mockService.createStoreWithMatching.mockResolvedValueOnce({ store: { id: 7, address: null, latitude: null } });
    await storeController.createStore({ body: {}, user: { id: 1 } }, makeRes());
    await flush();
    expect(mockGeocode.geocode).not.toHaveBeenCalled();
  });

  test('지오코딩 실패는 생성 응답에 영향을 주지 않는다', async () => {
    mockService.createStoreWithMatching.mockResolvedValue({ store: { id: 8, address: '서울 a로 1', latitude: null } });
    mockGeocode.geocode.mockRejectedValue(new Error('provider down'));
    const res = makeRes();
    await storeController.createStore({ body: {}, user: { id: 1 } }, res);
    await flush();
    expect(res.created).toHaveBeenCalled();
    expect(mockPrisma.stores.updateMany).not.toHaveBeenCalled();
  });
});
