jest.mock('../../../config/prisma', () => ({
  payments: { findUnique: jest.fn() },
}));

jest.mock('../../../utils/orderCapability', () => ({
  verifyOrderCapability: jest.fn(),
}));

const prisma = require('../../../config/prisma');
const { verifyOrderCapability } = require('../../../utils/orderCapability');
const paymentOrderCapability = require('../../../middleware/paymentOrderCapability');

describe('paymentOrderCapability', () => {
  const response = () => {
    const res = { status: jest.fn(), json: jest.fn() };
    res.status.mockReturnValue(res);
    return res;
  };

  beforeEach(() => jest.clearAllMocks());

  test('allows a capability bound to the payment order', async () => {
    const req = {
      params: { orderId: '7' },
      get: jest.fn().mockReturnValue('capability'),
    };
    const res = response();
    const next = jest.fn();
    verifyOrderCapability.mockReturnValue({ orderId: 42 });
    prisma.payments.findUnique.mockResolvedValue({ order_id: 42 });

    await paymentOrderCapability(req, res, next);

    expect(prisma.payments.findUnique).toHaveBeenCalledWith({
      where: { id: 7 },
      select: { order_id: true },
    });
    expect(next).toHaveBeenCalledWith();
  });

  test('rejects a capability for another order', async () => {
    const req = {
      params: { orderId: '7' },
      get: jest.fn().mockReturnValue('capability'),
    };
    const res = response();
    const next = jest.fn();
    verifyOrderCapability.mockReturnValue({ orderId: 99 });
    prisma.payments.findUnique.mockResolvedValue({ order_id: 42 });

    await paymentOrderCapability(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects missing or invalid capabilities before database access', async () => {
    const req = { params: { orderId: 'invalid' }, get: jest.fn() };
    const res = response();
    const next = jest.fn();
    verifyOrderCapability.mockReturnValue(null);

    await paymentOrderCapability(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(prisma.payments.findUnique).not.toHaveBeenCalled();
  });
});
