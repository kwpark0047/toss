const cache = require('../../../utils/singleFlightCache');
test('shares concurrent reads, caches successful values, and retries failures', async () => {
  const load = cache(30000);
  const factory = jest.fn().mockRejectedValueOnce(Error('db')).mockResolvedValue({ total: 2 });
  const first = load(factory);
  const second = load(factory);
  expect(first).toBe(second);
  await expect(first).rejects.toThrow('db');
  expect(await load(factory)).toEqual({ total: 2 });
  expect(await load(factory)).toEqual({ total: 2 });
  expect(factory).toHaveBeenCalledTimes(2);
});
