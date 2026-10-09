jest.mock('../../../utils/aiUsageTracker', () => ({ track: jest.fn() }));
const ai = require('../../../services/aiService');
beforeEach(() => {
  ai.cache.clear();
});
afterEach(() => jest.restoreAllMocks());
test('equal length customer histories and menus must not share a recommendation', async () => {
  const generate = jest
    .spyOn(ai, 'generateWithFallback')
    .mockResolvedValue('[{"id":1,"reason":"own"}]');
  await ai.recommendMenus({ time: '12:00', pastOrders: ['customer A purchase'] }, [
    { id: 1, name: 'store A' },
  ]);
  await ai.recommendMenus({ time: '12:00', pastOrders: ['customer B purchase'] }, [
    { id: 2, name: 'store B' },
  ]);
  expect(generate).toHaveBeenCalledTimes(2);
  expect(generate.mock.calls[1][0]).not.toContain('customer A purchase');
  expect(generate.mock.calls[1][0]).not.toContain('store A');
  expect([...ai.cache.keys()].join()).not.toContain('customer A purchase');
});
