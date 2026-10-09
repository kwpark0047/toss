import { beforeEach, expect, test, vi } from 'vitest';
vi.mock('../api/client', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../utils/socket', () => ({ getSocket: vi.fn() }));
import api from '../api/client';
import { ordersAPI } from '../api/orders';
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
});
test('creation chains only the previously possessed history capability', async () => {
  localStorage.setItem('wm_customer_history_capability', 'owned-proof');
  api.post.mockResolvedValue({ data: { customer_history_capability: 'new-proof' } });
  await ordersAPI.create({ store_id: 3, phone: 'claimed' });
  expect(api.post.mock.calls[0][2].headers['x-customer-history-capability']).toBe('owned-proof');
  expect(localStorage.getItem('wm_customer_history_capability')).toBe('new-proof');
});
test('legacy rejected proof is removed without affecting a subsequently replaced token', async () => {
  const error = { response: { status: 403 } };
  localStorage.setItem('wm_customer_history_capability', 'legacy');
  api.get.mockRejectedValue(error);
  await expect(ordersAPI.getCustomerHistory('legacy')).rejects.toBe(error);
  expect(localStorage.getItem('wm_customer_history_capability')).toBeNull();
  localStorage.setItem('wm_customer_history_capability', 'new-proof');
  await expect(ordersAPI.getCustomerHistory('legacy')).rejects.toBe(error);
  expect(localStorage.getItem('wm_customer_history_capability')).toBe('new-proof');
});
