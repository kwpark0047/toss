jest.mock('../../../config/prisma', () => ({
  stores: { update: jest.fn() },
  $transaction: jest.fn(),
}));
jest.mock('../../../utils/logger', () => ({ info: jest.fn() }));
jest.mock('../../../repositories/Store', () => ({}));
jest.mock('../../../services/StoreInfoEnhancementService', () => ({}));
const db = require('../../../config/prisma');
const controller = require('../../../controllers/platformController');
test('reject string false rather than activating a store', async () => {
  const next = jest.fn();
  await controller.toggleActive(
    { params: { id: '1' }, body: { is_active: 'false' } },
    { updated: jest.fn() },
    next
  );
  expect(next).toHaveBeenCalled();
  expect(db.stores.update).not.toHaveBeenCalled();
});
test('reject manual points without operation key before modifying wallet', async () => {
  const next = jest.fn();
  await controller.grantPoints(
    { params: { id: '1' }, body: { phone: '01012345678', amount: 5 }, get: () => undefined },
    { success: jest.fn() },
    next
  );
  expect(next.mock.calls[0][0].statusCode).toBe(400);
  expect(db.$transaction).not.toHaveBeenCalled();
});
