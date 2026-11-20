import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readMenuCart, writeMenuCart, restoreMenuCart } from '@/lib/menuCartSession';
import { registerMenuCheckpoint, prepareCustomerUpdate, isCustomerMenu } from '@/lib/customerUpdate';

beforeEach(() => localStorage.clear());
const row = { cartItemId: 'a', v: Date.now(), createdAt: Date.now(), quantity: 2,
  menuItem: { id: 1, name: '상품', price: 1000 }, unitPrice: 1000 };

describe('menu upgrade checkpoint', () => {
  it('restores lines and retains deletion versions without resurrecting them', () => {
    const removed = { cartItemId: 'b', v: Date.now(), deleted: true };
    expect(writeMenuCart(9, '3', [row, removed])).toBe(true);
    expect(readMenuCart(9, '3')).toEqual([row, removed]);
    expect(restoreMenuCart(9, '3')).toEqual([expect.objectContaining({ cartItemId: 'a', quantity: 2 })]);
    expect(readMenuCart(9, '4')).toEqual([]);
    expect(readMenuCart(10, '3')).toEqual([]);
  });
  it('expires old snapshots and reports quota failures instead of claiming a safe checkpoint', () => {
    writeMenuCart(9, '3', [row]);
    expect(readMenuCart(9, '3', localStorage, Date.now() + 31 * 60000)).toEqual([]);
    expect(writeMenuCart(9, '3', [row], { setItem() { throw new Error('quota'); } })).toBe(false);
  });
  it('does not let a stale tab overwrite a newer deletion snapshot', () => {
    const removed = { cartItemId: row.cartItemId, v: row.v + 1, deleted: true };
    writeMenuCart(9, '3', [removed]);
    writeMenuCart(9, '3', [row]);
    expect(restoreMenuCart(9, '3')).toEqual([]);
  });
  it('defers without a mounted menu, while editing, or when checkout/storage is not safe', () => {
    expect(prepareCustomerUpdate()).toBe(false);
    const handler = vi.fn(() => false);
    const unregister = registerMenuCheckpoint(handler);
    expect(prepareCustomerUpdate()).toBe(false);
    handler.mockReturnValue(true);
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    expect(prepareCustomerUpdate()).toBe(false);
    input.remove();
    expect(prepareCustomerUpdate()).toBe(true);
    unregister();
    expect(prepareCustomerUpdate()).toBe(false);
  });
  it('does not auto-update admin, demo, or payment routes', () => {
    expect(isCustomerMenu('/menu/9')).toBe(true);
    for (const path of ['/menu/demo', '/admin', '/payment/success']) expect(isCustomerMenu(path)).toBe(false);
  });
});
