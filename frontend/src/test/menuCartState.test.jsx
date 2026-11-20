import { beforeEach, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import useMenuCartState from '@/hooks/useMenuCartState';
import { writeMenuCart } from '@/lib/menuCartSession';
beforeEach(() => localStorage.clear());
it('restores only the selected store/table and rebinds functional edits on route changes', () => {
  const row = (id) => ({ cartItemId: id, v: Date.now(), menuItem: { id: 1 }, quantity: 1, unitPrice: 1000 });
  writeMenuCart(9, 'A', [row('table-a')]);
  writeMenuCart(9, 'B', [row('table-b')]);
  const view = renderHook(({ storeId, table }) => useMenuCartState(storeId, table), {
    initialProps: { storeId: 9, table: 'A' },
  });
  expect(view.result.current[0][0].cartItemId).toBe('table-a');
  view.rerender({ storeId: 9, table: 'B' });
  expect(view.result.current[0][0].cartItemId).toBe('table-b');
  act(() => view.result.current[1]((cart) => [...cart, row('new-b')]));
  expect(view.result.current[0].map((item) => item.cartItemId)).toEqual(['table-b', 'new-b']);
  view.rerender({ storeId: 10, table: 'B' });
  expect(view.result.current[0]).toEqual([]);
});
