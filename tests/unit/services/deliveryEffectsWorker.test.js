jest.mock('../../../utils/logger', () => ({ warn: jest.fn() }));
const { start } = require('../../../services/delivery/effectsWorker');
describe('delivery effects recovery lifecycle', () => {
  afterEach(() => jest.useRealTimers());
  test('runs on startup, does not overlap, and drains on stop', async () => {
    jest.useFakeTimers();
    let release;
    const service = { recoverPendingEffects: jest.fn(() => new Promise(r => { release = r; })) };
    const stop = start({ service, orderService: {}, enabled: true, intervalMs: 100 });
    await jest.advanceTimersByTimeAsync(0);
    expect(service.recoverPendingEffects).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(500);
    expect(service.recoverPendingEffects).toHaveBeenCalledTimes(1);
    const stopping = stop();
    release();
    await stopping;
    await jest.advanceTimersByTimeAsync(500);
    expect(service.recoverPendingEffects).toHaveBeenCalledTimes(1);
  });
});
