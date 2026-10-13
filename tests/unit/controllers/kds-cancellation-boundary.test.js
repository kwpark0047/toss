jest.mock('../../../services/KdsService', () => ({ updateKdsOrderStatus: jest.fn() }));
jest.mock('../../../services/FeatureFlagService', () => ({
  isEnabled: jest.fn().mockResolvedValue(true),
}));
const service = require('../../../services/KdsService'),
  controller = require('../../../controllers/kdsController');
test('KDS cannot bypass inventory/refund cancellation workflow', async () => {
  const next = jest.fn();
  await controller.updateOrderStatus(
    {
      params: { storeId: '3', orderId: '1' },
      body: { status: 'cancelled' },
      user: { id: 1 },
      app: { get: () => null },
    },
    { success: jest.fn() },
    next
  );
  expect(next.mock.calls[0][0].statusCode).toBe(409);
  expect(service.updateKdsOrderStatus).not.toHaveBeenCalled();
});
