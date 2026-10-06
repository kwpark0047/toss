jest.mock('../../../services/SaaSBillingService', () => ({ activate: jest.fn() }));
const billing = require('../../../services/SaaSBillingService');
const controller = require('../../../controllers/subscriptionController');
beforeEach(() => jest.clearAllMocks());
const request = () => ({
  storeId: '1',
  storeRole: 'owner',
  user: { id: 7 },
  body: { auth_key: 'auth', checkout_token: 'signed' },
});
test('delegates a signed checkout to verified billing', async () => {
  billing.activate.mockResolvedValue({ effective_plan: 'pro' });
  const res = { success: jest.fn() },
    next = jest.fn();
  await controller.registerPaymentMethod(request(), res, next);
  expect(billing.activate).toHaveBeenCalledWith(1, 7, 'auth', 'signed');
  expect(res.success).toHaveBeenCalledWith({ effective_plan: 'pro' }, expect.any(String));
  expect(next).not.toHaveBeenCalled();
});
test('staff cannot register subscription payment methods', async () => {
  const next = jest.fn();
  await controller.registerPaymentMethod(
    { ...request(), storeRole: 'staff' },
    { success: jest.fn() },
    next
  );
  expect(next.mock.calls[0][0].statusCode).toBe(403);
  expect(billing.activate).not.toHaveBeenCalled();
});
test('provider rejection propagates without granting a plan', async () => {
  const error = new Error('unverified charge');
  billing.activate.mockRejectedValue(error);
  const next = jest.fn(),
    res = { success: jest.fn() };
  await controller.registerPaymentMethod(request(), res, next);
  expect(next).toHaveBeenCalledWith(error);
  expect(res.success).not.toHaveBeenCalled();
});
