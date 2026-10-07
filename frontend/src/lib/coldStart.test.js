import { describe, expect, it } from 'vitest';
import { shouldWakeAndRetry } from './coldStart';

describe('cold start recovery', () => {
  it('does not turn disabled provider responses into a minute of waiting', () => {
    expect(
      shouldWakeAndRetry({
        config: { method: 'get' },
        response: { status: 503, data: { error: 'API key not configured' } },
      })
    ).toBe(false);
  });
  it('does not revive aborted requests or repeat a potentially accepted order', () => {
    expect(shouldWakeAndRetry({ code: 'ERR_CANCELED', config: { method: 'get' } })).toBe(false);
    expect(shouldWakeAndRetry({ config: { method: 'post' } })).toBe(false);
  });
  it('recovers safe reads on transport errors and gateway errors once', () => {
    expect(shouldWakeAndRetry({ config: { method: 'get' } })).toBe(true);
    expect(shouldWakeAndRetry({ config: { method: 'get' }, response: { status: 502 } })).toBe(true);
    expect(shouldWakeAndRetry({ config: { method: 'get', _coldRetry: true } })).toBe(false);
  });
});
