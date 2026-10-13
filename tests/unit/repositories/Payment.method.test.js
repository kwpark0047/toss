jest.mock('../../../config/prisma', () => ({
  payments: { create: jest.fn((data) => Promise.resolve(data.data)) },
}));
jest.mock('../../../utils/phoneEncryption', () => ({ encryptPhone: jest.fn() }));
jest.mock('../../../utils/tokenEncryption', () => ({ encryptToken: jest.fn() }));
const Payment = require('../../../repositories/Payment');
test('preserves the provided payment method independently of status', async () => {
  const result = await Payment.create({
    order_id: 1,
    store_id: 1,
    amount: 1000,
    status: 'READY',
    method: 'CASH',
  });
  expect(result.method).toBe('CASH');
  expect(result.status).toBe('READY');
});
test('missing method remains unknown rather than fabricating a payment method', async () => {
  expect((await Payment.create({ order_id: 1, store_id: 1, amount: 1000 })).method).toBeNull();
});
