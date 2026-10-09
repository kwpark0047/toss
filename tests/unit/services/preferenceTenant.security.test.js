jest.mock('../../../repositories/CustomerPreference', () => ({
  findOrCreate: jest.fn(),
  incrementFromOrder: jest.fn(),
  updateOrderPatterns: jest.fn(),
}));
jest.mock('../../../repositories/Product', () => ({ findById: jest.fn() }));
jest.mock('../../../repositories/Order', () => ({
  findByCustomer: jest.fn(),
  findByCustomerInStore: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../../services/aiService', () => ({}));
const Order = require('../../../repositories/Order');
test('learning order patterns always supplies the source store', async () => {
  await require('../../../services/CustomerPreferenceService').learnFromOrder(3, '01099998888', []);
  expect(Order.findByCustomer).not.toHaveBeenCalled();
  expect(Order.findByCustomerInStore).toHaveBeenCalledWith(3, '01099998888');
});
test('unavailable private profile degrades without propagating raw phone in errors', async () => {
  require('../../../repositories/CustomerPreference').findOrCreate.mockRejectedValue(
    new Error('private 01099998888 failed')
  );
  await expect(
    require('../../../services/CustomerPreferenceService').getProfile(3, '01099998888')
  ).resolves.toEqual({});
});
