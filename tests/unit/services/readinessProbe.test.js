const { createReadinessProbe } = require('../../../utils/readinessProbe');
describe('bounded shared database readiness', () => {
  afterEach(() => jest.useRealTimers());
  it('bounds callers without accumulating database queries and recovers on completion', async () => {
    jest.useFakeTimers();
    let resolve;
    const check = jest.fn(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    const probe = createReadinessProbe(check, { timeoutMs: 100, cacheMs: 10 });
    const callers = Promise.all([probe(), probe(), probe()]);
    await jest.advanceTimersByTimeAsync(101);
    expect(await callers).toEqual([false, false, false]);
    expect(check).toHaveBeenCalledTimes(1);
    const next = probe();
    resolve();
    await expect(next).resolves.toBe(true);
    expect(check).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
});
