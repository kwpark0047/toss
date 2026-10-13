import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getToken: vi.fn() }));
vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})) }));
vi.mock('firebase/messaging', () => ({
  getMessaging: vi.fn(() => ({})),
  getToken: mocks.getToken,
  onMessage: vi.fn(),
}));
import { requestNotificationPermission } from '../firebase';

describe('optional checkout notifications', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ json: async () => ({}) }))
    );
    vi.stubGlobal('Notification', {
      permission: 'default',
      requestPermission: vi.fn(() => new Promise(() => {})),
    });
    mocks.getToken.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('does not prompt or wait when permission was never granted', async () => {
    const result = requestNotificationPermission({ requestPermission: false, timeoutMs: 100 });
    await vi.advanceTimersByTimeAsync(101);
    expect(Notification.requestPermission).not.toHaveBeenCalled();
    expect(await result).toBeNull();
    expect(mocks.getToken).not.toHaveBeenCalled();
  });
  it('does not retry denied permission', async () => {
    Notification.permission = 'denied';
    const result = requestNotificationPermission({ requestPermission: false, timeoutMs: 100 });
    await vi.advanceTimersByTimeAsync(101);
    expect(Notification.requestPermission).not.toHaveBeenCalled();
    expect(await result).toBeNull();
  });
  it('bounds a stalled token lookup and consumes a late failure', async () => {
    Notification.permission = 'granted';
    let rejectToken;
    mocks.getToken.mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectToken = reject;
        })
    );
    const result = requestNotificationPermission({ requestPermission: false, timeoutMs: 100 });
    await vi.advanceTimersByTimeAsync(101);
    expect(await result).toBeNull();
    rejectToken(new Error('late provider failure'));
    await vi.advanceTimersByTimeAsync(1);
  });
  it('returns an already-authorized token without requesting permission', async () => {
    Notification.permission = 'granted';
    mocks.getToken.mockResolvedValue('fixture-notification-token');
    expect(await requestNotificationPermission({ requestPermission: false, timeoutMs: 100 })).toBe(
      'fixture-notification-token'
    );
    expect(Notification.requestPermission).not.toHaveBeenCalled();
  });
});
