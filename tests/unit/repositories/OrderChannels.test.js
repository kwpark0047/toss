jest.mock('../../../config/prisma', () => ({
  store_order_channels: { findUnique: jest.fn(), findMany: jest.fn(), upsert: jest.fn() },
  store_addons: { findUnique: jest.fn() },
}));
jest.mock('../../../utils/logger', () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn() }));

const prisma = require('../../../config/prisma');
const OrderChannels = require('../../../repositories/OrderChannels');

describe('OrderChannels.sanitize', () => {
  test('허용 필드만 남기고 동네 목록을 정리한다', () => {
    const { data, error } = OrderChannels.sanitize({
      dine_in_enabled: false,
      delivery_areas: [' 역삼동 ', '', '역삼동', '논현동'],
      delivery_radius_km: 2.34,
      unknown: 'x',
    });
    expect(error).toBeUndefined();
    expect(data).toEqual({
      dine_in_enabled: false,
      delivery_areas: ['역삼동', '논현동'],
      delivery_radius_km: 2.3,
    });
  });

  test.each([
    [{ takeout_enabled: 'yes' }],
    [{ delivery_radius_km: 0 }],
    [{ delivery_radius_km: 25 }],
    [{ delivery_fee: -1 }],
    [{ min_order_amount: 1.5 }],
    [{ delivery_est_minutes: 1 }],
    [{ delivery_area_mode: 'polygon' }],
    [{ delivery_fulfillment: 'drone' }],
    [{ agency_provider: 'Bad Provider!' }],
    [{ agency_auto_dispatch: 'yes' }],
    [{ pickup_guide: 'x'.repeat(201) }],
  ])('잘못된 값은 거절한다 %j', (body) => {
    expect(OrderChannels.sanitize(body).error).toBeTruthy();
  });
});

describe('OrderChannels.validateMerged', () => {
  const base = { ...OrderChannels.DEFAULTS };

  test('주문 유형을 모두 끌 수 없다', () => {
    const next = {
      ...base,
      dine_in_enabled: false,
      takeout_enabled: false,
      delivery_enabled: false,
    };
    expect(OrderChannels.validateMerged(next, { addonActive: true })).toMatch('하나 이상');
  });

  test('부가기능 없이 매장 식사 끄기·배달 켜기는 막는다', () => {
    expect(
      OrderChannels.validateMerged({ ...base, dine_in_enabled: false }, { addonActive: false })
    ).toMatch('부가기능');
    expect(
      OrderChannels.validateMerged({ ...base, delivery_enabled: true }, { addonActive: false })
    ).toMatch('부가기능');
    expect(
      OrderChannels.validateMerged({ ...base, takeout_enabled: false }, { addonActive: false })
    ).toBeNull();
  });

  test('배달대행을 고르면 대행사가 있어야 한다', () => {
    const next = {
      ...base,
      delivery_enabled: true,
      delivery_fulfillment: 'agency',
      agency_provider: null,
    };
    expect(OrderChannels.validateMerged(next, { addonActive: true })).toMatch('배달대행사');
    expect(
      OrderChannels.validateMerged({ ...next, agency_provider: 'barogo' }, { addonActive: true })
    ).toBeNull();
  });

  test('동네 권역은 동네가 하나 이상 있어야 한다', () => {
    const next = {
      ...base,
      delivery_enabled: true,
      delivery_area_mode: 'areas',
      delivery_areas: [],
    };
    expect(OrderChannels.validateMerged(next, { addonActive: true })).toMatch('동네');
  });
});

describe('OrderChannels 조회', () => {
  test('행이 없으면 기존 매장 기본값(매장 식사·포장 ON, 배달 OFF)', async () => {
    prisma.store_order_channels.findUnique.mockResolvedValue(null);
    const channels = await OrderChannels.findByStoreId(3);
    expect(OrderChannels.enabledTypes(channels)).toEqual(['dine_in', 'takeout']);
    expect(OrderChannels.isOnlineOnly(channels)).toBe(false);
  });

  test('테이블이 없어도 기본값으로 주문을 받는다 (fail-open)', async () => {
    prisma.store_order_channels.findUnique.mockRejectedValue(new Error('relation does not exist'));
    const channels = await OrderChannels.findByStoreId(3);
    expect(channels.dine_in_enabled).toBe(true);
  });

  test('만료되거나 해지된 부가기능은 꺼진 것으로 본다', async () => {
    prisma.store_addons.findUnique.mockResolvedValueOnce({ status: 'active', expires_at: null });
    await expect(OrderChannels.isAddonActive(3)).resolves.toBe(true);
    prisma.store_addons.findUnique.mockResolvedValueOnce({ status: 'canceled' });
    await expect(OrderChannels.isAddonActive(3)).resolves.toBe(false);
    prisma.store_addons.findUnique.mockResolvedValueOnce({
      status: 'active',
      expires_at: new Date(Date.now() - 1000),
    });
    await expect(OrderChannels.isAddonActive(3)).resolves.toBe(false);
  });
});
