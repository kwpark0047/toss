jest.mock('../../../config/prisma', () => ({ ledger: { findMany: jest.fn() } }));
const prisma = require('../../../config/prisma');
const Ledger = require('../../../repositories/Ledger');
test('refund summary normalizes each legacy negative and new positive event, not their net sum', async () => {
  prisma.ledger.findMany.mockResolvedValue([
    { type: 'INCOME', amount: 10000 },
    { type: 'REFUND', amount: -2000 },
    { type: 'REFUND', amount: 8000 },
  ]);
  expect(await Ledger.getSummary(3, '2026-10-01', '2026-10-08')).toMatchObject({
    total_income: 10000,
    total_refund: 10000,
  });
});
