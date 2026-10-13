import { it, expect, vi } from 'vitest';
const post = vi.hoisted(() => vi.fn(async () => ({ data: { id: 1 } })));
const get = vi.hoisted(() => vi.fn(async () => ({ data: { id: 1 } })));
vi.mock('../api/client', () => ({ default: { post, get } }));
vi.mock('../utils/socket', () => ({ getSocket: vi.fn() }));
import { ordersAPI } from '../api/orders';
it('retains the checkout attempt key across uncertain order creation retries', async () => {
  const payload = { store_id: 1, items: [{ product_id: 2, quantity: 1 }] };
  await ordersAPI.create(payload, { idempotencyKey: 'fixture-checkout-attempt' });
  await ordersAPI.create(payload, { idempotencyKey: 'fixture-checkout-attempt' });
  for (const call of post.mock.calls)
    expect(call[2].headers['Idempotency-Key']).toBe('fixture-checkout-attempt');
});
it('sends the retained owner proof to read a customer receipt', async () => {
  await ordersAPI.getById(1, 'fixture-order-capability');
  expect(get).toHaveBeenCalledWith('/orders/1', {
    headers: { 'x-order-capability': 'fixture-order-capability' },
  });
});
