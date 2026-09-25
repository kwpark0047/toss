jest.mock('../../../config/prisma', () => ({
  stores: {
    findMany: jest.fn(),
  },
  store_settlement_config: {
    findMany: jest.fn(),
  },
}));

jest.mock('../../../repositories/Settlement', () => ({
  create: jest.fn(),
}));

jest.mock('../../../services/notificationService', () => ({
  notifySettlementDB: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../../utils/kstTime', () => ({
  KST_OFFSET_MS: 9 * 60 * 60 * 1000,
  kstNow: jest.fn(() => new Date('2026-09-25T00:00:00.000Z')),
}));

const prisma = require('../../../config/prisma');
const Settlement = require('../../../repositories/Settlement');
const notificationService = require('../../../services/notificationService');
const { getLastCyclePeriod, runCycle } = require('../../../services/settlementAutomationService');

const FIXED_NOW = new Date('2026-09-25T00:00:00.000Z');
const KST = 9 * 60 * 60 * 1000;

describe('settlementAutomationService.getLastCyclePeriod', () => {
  test('MONTHLY는 정확히 직전 달력월 [1일 00:00, 말일 23:59:59.999] KST를 반환한다', () => {
    const { period_start, period_end } = getLastCyclePeriod(FIXED_NOW, 'MONTHLY');

    expect(period_start).toBe(new Date(Date.UTC(2026, 7, 1) - KST).toISOString());
    expect(new Date(period_start).getTime()).toBe(Date.UTC(2026, 7, 1, 0, 0, 0, 0) - KST);
    expect(new Date(period_end).getTime()).toBe(Date.UTC(2026, 8, 1, 0, 0, 0, 0) - KST - 1);
  });

  test('DAILY는 정확히 어제 00:00 ~ 23:59:59.999 KST를 반환한다', () => {
    const { period_start, period_end } = getLastCyclePeriod(FIXED_NOW, 'DAILY');

    const startOfTodayKst = Date.UTC(2026, 8, 25) - KST;
    expect(new Date(period_start).getTime()).toBe(startOfTodayKst - 24 * 60 * 60 * 1000);
    expect(new Date(period_end).getTime()).toBe(startOfTodayKst - 1);
  });

  test('WEEKLY는 정확히 직전 월~일 주간을 반환한다', () => {
    // 2026-09-25(금) KST 기준 직전 주: 2026-09-14(월) ~ 2026-09-20(일) KST
    const { period_start, period_end } = getLastCyclePeriod(FIXED_NOW, 'WEEKLY');

    const thisWeekStartKst = Date.UTC(2026, 8, 21, 0, 0, 0, 0) - KST; // 이번 주 월요일 (09-21)
    expect(new Date(period_start).getTime()).toBe(thisWeekStartKst - 7 * 24 * 60 * 60 * 1000);
    expect(new Date(period_end).getTime()).toBe(thisWeekStartKst - 1);
  });

  test('기본 주기는 MONTHLY, KST_OFFSET_MS를 반영한다', () => {
    const { period_start } = getLastCyclePeriod(FIXED_NOW);
    expect(period_start).toBe(getLastCyclePeriod(FIXED_NOW, 'MONTHLY').period_start);
    expect(new Date(period_start).getTime()).toBe(Date.UTC(2026, 7, 1) - KST);
  });
});

describe('settlementAutomationService.runCycle', () => {
  beforeEach(() => jest.clearAllMocks());

  const stores = [{ id: 1 }, { id: 2 }, { id: 3 }];

  test('활성 매장 수집 → 주기별 정산 생성 → 신규 생성분만 알림 발송', async () => {
    prisma.stores.findMany.mockResolvedValue(stores);
    prisma.store_settlement_config.findMany.mockResolvedValue([
      { store_id: 1, settlement_cycle: 'MONTHLY' },
      { store_id: 2, settlement_cycle: 'DAILY' },
      { store_id: 3, settlement_cycle: 'WEEKLY' },
    ]);
    Settlement.create.mockResolvedValue({ id: 101, store_id: 1, _calc: {} });
    notificationService.notifySettlementDB.mockResolvedValue({ id: 1001 });

    const result = await runCycle(FIXED_NOW);

    expect(prisma.stores.findMany).toHaveBeenCalledWith({
      where: { is_active: true },
      select: { id: true },
    });
    expect(Settlement.create).toHaveBeenCalledTimes(stores.length);
    expect(Settlement.create).toHaveBeenCalledWith({
      store_id: 1,
      period_start: expect.any(String),
      period_end: expect.any(String),
    });
    expect(notificationService.notifySettlementDB).toHaveBeenCalledTimes(stores.length);
    expect(result).toEqual({ created: stores.length, skipped: 0 });
  });

  test('이미 생성된 정산(반환값에 _calc 없음)은 스킵하고 알림을 보내지 않는다', async () => {
    prisma.stores.findMany.mockResolvedValue(stores);
    prisma.store_settlement_config.findMany.mockResolvedValue([]);
    Settlement.create.mockResolvedValue({ id: 50, store_id: 1 });

    const result = await runCycle(FIXED_NOW);

    expect(Settlement.create).toHaveBeenCalledTimes(stores.length);
    expect(notificationService.notifySettlementDB).not.toHaveBeenCalled();
    expect(result).toEqual({ created: 0, skipped: stores.length });
  });

  test('MANUAL 주기 매장은 자동 생성을 건너뛴다', async () => {
    prisma.stores.findMany.mockResolvedValue(stores);
    prisma.store_settlement_config.findMany.mockResolvedValue([
      { store_id: 1, settlement_cycle: 'MANUAL' },
    ]);
    Settlement.create.mockResolvedValue({ id: 1, store_id: 1, _calc: {} });

    const result = await runCycle(FIXED_NOW);

    expect(Settlement.create).toHaveBeenCalledTimes(stores.length - 1);
    expect(notificationService.notifySettlementDB).toHaveBeenCalledTimes(stores.length - 1);
    expect(result).toEqual({ created: stores.length - 1, skipped: 1 });
  });

  test('설정이 없는 매장은 기본 MONTHLY로 처리한다', async () => {
    prisma.stores.findMany.mockResolvedValue([{ id: 1 }]);
    prisma.store_settlement_config.findMany.mockResolvedValue([]);
    Settlement.create.mockResolvedValue({ id: 1, store_id: 1, _calc: {} });

    await runCycle(FIXED_NOW);

    expect(prisma.stores.findMany).toHaveBeenCalled();
    expect(Settlement.create).toHaveBeenCalledWith({
      store_id: 1,
      period_start: getLastCyclePeriod(FIXED_NOW, 'MONTHLY').period_start,
      period_end: getLastCyclePeriod(FIXED_NOW, 'MONTHLY').period_end,
    });
  });

  test('생성 실패(기간 중복 등) 매장은 스킵하고 나머지를 계속 처리한다', async () => {
    prisma.stores.findMany.mockResolvedValue(stores);
    prisma.store_settlement_config.findMany.mockResolvedValue([]);
    Settlement.create
      .mockRejectedValueOnce(new Error('이미 처리된 기간과 정산 기간이 겹칩니다.'))
      .mockResolvedValueOnce({ id: 1, store_id: 2, _calc: {} })
      .mockResolvedValueOnce({ id: 2, store_id: 3 });

    const result = await runCycle(FIXED_NOW);

    expect(Settlement.create).toHaveBeenCalledTimes(stores.length);
    expect(notificationService.notifySettlementDB).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ created: 1, skipped: 2 });
  });

  test('활성 매장이 없으면 바로 빈 결과를 반환한다', async () => {
    prisma.stores.findMany.mockResolvedValue([]);

    const result = await runCycle(FIXED_NOW);

    expect(prisma.store_settlement_config.findMany).not.toHaveBeenCalled();
    expect(Settlement.create).not.toHaveBeenCalled();
    expect(result).toEqual({ created: 0, skipped: 0 });
  });
});