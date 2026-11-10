import { beforeEach, it, expect, vi } from 'vitest';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }));
vi.mock('../api/client', () => ({ default: api }));
import { enableServerPush, disableServerPush, serverPushEnabled } from '../utils/orderServerPush';
import {
  showOrderReadyNotification,
  setReadyNotificationEnabled,
} from '../utils/orderReadyNotification';
const subscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/test',
  toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/test', keys: {} }),
};
const manager = { getSubscription: vi.fn(), subscribe: vi.fn() };
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  Object.defineProperty(window, 'PushManager', { configurable: true, value: class {} });
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve({ pushManager: manager }) },
  });
  manager.getSubscription.mockResolvedValue(null);
  manager.subscribe.mockResolvedValue(subscription);
  api.get.mockResolvedValue({ data: { enabled: true, publicKey: 'public-key' } });
  api.post.mockResolvedValue({ subscribed: true });
  api.delete.mockResolvedValue({ subscribed: false });
});
it('registers existing order capability and persists flag only after server ack', async () => {
  localStorage.setItem('wm_customer_history_capability', 'history-owned');
  await expect(enableServerPush({ id: 4, capability: 'owned' })).resolves.toBe(true);
  expect(api.post).toHaveBeenCalledWith(
    '/orders/4/push-subscription',
    { subscription: subscription.toJSON() },
    { headers: { 'x-order-capability': 'owned', 'x-customer-history-capability': 'history-owned' } }
  );
  expect(serverPushEnabled(4)).toBe(true);
});
it('server rejection must not disable foreground fallback', async () => {
  api.post.mockRejectedValue(new Error('403'));
  await expect(enableServerPush({ id: 4 })).rejects.toThrow();
  expect(serverPushEnabled(4)).toBe(false);
});
it('configuration unavailable preserves page-only notification mode', async () => {
  api.get.mockResolvedValue({ data: { enabled: false } });
  await expect(enableServerPush({ id: 4 })).resolves.toBe(false);
  expect(manager.subscribe).not.toHaveBeenCalled();
});
it('does not unsubscribe the browser device used by other orders', async () => {
  manager.getSubscription.mockResolvedValue(subscription);
  localStorage.setItem('wm_order_server_push:4', 'true');
  await disableServerPush({ id: 4, capability: 'owned' });
  expect(api.delete).toHaveBeenCalled();
  expect(serverPushEnabled(4)).toBe(false);
});
it('failed server opt-out retains flag and avoids falsely reporting disabled', async () => {
  manager.getSubscription.mockResolvedValue(subscription);
  localStorage.setItem('wm_order_server_push:4', 'true');
  api.delete.mockRejectedValue(new Error('offline'));
  await expect(disableServerPush({ id: 4 })).rejects.toThrow();
  expect(serverPushEnabled(4)).toBe(true);
});
it('server push subscription suppresses a second foreground native notification', async () => {
  localStorage.setItem('wm_order_server_push:4', 'true');
  setReadyNotificationEnabled(true);
  expect(await showOrderReadyNotification({ id: 4 })).toBe(false);
});
