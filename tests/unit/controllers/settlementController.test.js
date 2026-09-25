jest.mock('../../../repositories/Settlement', () => ({
  findByStore: jest.fn(),
  create: jest.fn(),
  getSummary: jest.fn(),
}));

jest.mock('../../../config/prisma', () => ({
  stores: { findUnique: jest.fn() },
  users: { findMany: jest.fn() },
  settlements: { findUnique: jest.fn(), delete: jest.fn() },
}));

jest.mock('../../../utils/notifications', () => ({
  sendSettlementNotification: jest.fn(),
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

jest.mock('../../../repositories/Store', () => ({
  findById: jest.fn(),
}));

const Settlement = require('../../../repositories/Settlement');
const settlementController = require('../../../controllers/settlementController');

const mockRes = () => {
  const res = {};
  res.success = jest.fn().mockReturnValue(res);
  return res;
};
const mockNext = jest.fn();

describe('settlementController.getSettlementSummary', () => {
  beforeEach(() => jest.clearAllMocks());

  test('리포지토리 요약을 그대로 성공 응답으로 반환한다', async () => {
    const summary = {
      statusCounts: { PENDING: 2, COMPLETED: 1, PAID: 1, CANCELLED: 0 },
      totalCount: 4,
      totalNet: 55000,
      pendingNet: 30000,
      latest: { id: 7 },
    };
    Settlement.getSummary.mockResolvedValue(summary);
    const res = mockRes();

    await settlementController.getSettlementSummary({ params: { storeId: '3' } }, res, mockNext);

    expect(Settlement.getSummary).toHaveBeenCalledWith('3');
    expect(res.success).toHaveBeenCalledWith(summary);
  });

  test('리포지토리 오류는 next로 전달된다', async () => {
    const err = new Error('DB 장애');
    Settlement.getSummary.mockRejectedValue(err);
    const res = mockRes();

    await settlementController.getSettlementSummary({ params: { storeId: '3' } }, res, mockNext);
    // catchAsync는 Promise.resolve(...).catch(next) 형태로 반환값이 없어
    // 마이크로태스크가 실행될 시간을 확보한다.
    await new Promise((resolve) => setImmediate(resolve));

    expect(res.success).not.toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalledWith(err);
  });
});