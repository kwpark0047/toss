jest.mock('../../../utils/logger', () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../../../config/prisma', () => ({
  store_order_pace: { findUnique: jest.fn(), upsert: jest.fn() },
}));

const prisma = require('../../../config/prisma');
const OrderPaceSettings = require('../../../repositories/OrderPaceSettings');

describe('OrderPaceSettings', () => {
  const now = new Date('2026-11-02T12:00:00Z');
  beforeEach(() => jest.clearAllMocks());

  describe('sanitize', () => {
    test('허용된 추가 대기 시간과 일시정지 분만 받는다', () => {
      expect(OrderPaceSettings.sanitize({ extra_wait_minutes: 20 }, now)).toEqual({ data: { extra_wait_minutes: 20 } });
      expect(OrderPaceSettings.sanitize({ pause_minutes: 30 }, now)).toEqual({
        data: { orders_paused_until: new Date('2026-11-02T12:30:00Z') },
      });
      expect(OrderPaceSettings.sanitize({ pause_minutes: 0 }, now)).toEqual({ data: { orders_paused_until: null } });
    });

    test('범위를 벗어난 값과 빈 요청은 거부한다', () => {
      expect(OrderPaceSettings.sanitize({ extra_wait_minutes: 45 }, now).error).toBeDefined();
      expect(OrderPaceSettings.sanitize({ extra_wait_minutes: '10' }, now).error).toBeDefined();
      expect(OrderPaceSettings.sanitize({ pause_minutes: 600 }, now).error).toBeDefined();
      expect(OrderPaceSettings.sanitize({}, now).error).toBeDefined();
    });
  });

  test('일시정지 시각이 지나면 자동으로 재개된 것으로 본다', () => {
    expect(OrderPaceSettings.toPublic({ extra_wait_minutes: 10, orders_paused_until: '2026-11-02T12:10:00Z' }, now))
      .toEqual({ extra_wait_minutes: 10, orders_paused: true, orders_paused_until: '2026-11-02T12:10:00.000Z' });
    expect(OrderPaceSettings.toPublic({ extra_wait_minutes: 10, orders_paused_until: '2026-11-02T11:50:00Z' }, now))
      .toEqual({ extra_wait_minutes: 10, orders_paused: false, orders_paused_until: null });
    expect(OrderPaceSettings.toPublic(null, now)).toEqual({ extra_wait_minutes: 0, orders_paused: false, orders_paused_until: null });
  });

  test('조회 실패 시 주문을 막지 않도록 기본값을 돌려준다', async () => {
    prisma.store_order_pace.findUnique.mockRejectedValue(new Error('relation "store_order_pace" does not exist'));
    await expect(OrderPaceSettings.findByStoreIdSafe(1)).resolves.toEqual({
      extra_wait_minutes: 0,
      orders_paused: false,
      orders_paused_until: null,
    });
  });
});
