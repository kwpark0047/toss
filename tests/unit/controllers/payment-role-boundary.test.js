jest.mock('../../../config/prisma', () => ({
  orders: { findUnique: jest.fn().mockResolvedValue({ store_id: 3 }) },
  stores: { findUnique: jest.fn() },
  staff: { findFirst: jest.fn() },
}));
jest.mock('../../../repositories/Payment', () => ({}));
jest.mock('../../../repositories/Order', () => ({}));
jest.mock('../../../utils/toss', () => ({}));
jest.mock('../../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn() }));
jest.mock('../../../services/PaymentService', () =>
  jest.fn(() => ({
    confirmOfflinePayment: jest.fn().mockResolvedValue({ success: true }),
    processCancellation: jest.fn().mockResolvedValue({ success: true }),
  }))
);
const db = require('../../../config/prisma'),
  controller = require('../../../controllers/paymentController');
test.each([
  ['owner', true, true],
  ['manager', true, true],
  ['staff', true, false],
  ['kitchen', false, false],
])('%s cash/refund capability', async (role, collect, refund) => {
  db.stores.findUnique.mockResolvedValue({ user_id: role === 'owner' ? 1 : 99 });
  db.staff.findFirst.mockResolvedValue({ role });
  for (const [handler, allowed] of [
    ['confirmCash', collect],
    ['cancelByOrderId', refund],
  ]) {
    const res = { success: jest.fn(), json: jest.fn() },
      next = jest.fn();
    await controller[handler](
      {
        params: { orderId: '9' },
        body: {},
        user: { id: 1, role: 'staff' },
        app: { get: () => null },
      },
      res,
      next
    );
    if (allowed) expect(next).not.toHaveBeenCalled();
    else expect(next.mock.calls[0][0].statusCode).toBe(403);
  }
});
