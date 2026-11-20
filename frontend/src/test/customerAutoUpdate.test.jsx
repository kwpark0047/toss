import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { registerMenuCheckpoint } from '@/lib/customerUpdate';
import useCustomerAutoUpdate from '@/hooks/useCustomerAutoUpdate';
const sw = { update: vi.fn(async () => {}), needed: true };
const useUpdate = () => useCustomerAutoUpdate({ needRefresh: sw.needed,
  updateServiceWorker: sw.update, pathname: window.location.pathname });
let unregister;
beforeEach(() => {
  vi.useFakeTimers();
  sw.update.mockClear();
  window.history.replaceState({}, '', '/menu/9?table=3');
  unregister = registerMenuCheckpoint(() => true);
});
afterEach(() => { unregister(); vi.useRealTimers(); });

describe('customer automatic deployment updates', () => {
  it('applies a waiting version without an update button after checkpointing', async () => {
    const checkpoint = vi.fn(() => true);
    unregister(); unregister = registerMenuCheckpoint(checkpoint);
    const view = renderHook(useUpdate);
    await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
    expect(checkpoint).toHaveBeenCalled();
    expect(sw.update).toHaveBeenCalledWith(true);
    view.unmount();
  });
  it('waits for a safe checkpoint at entry, then updates automatically', async () => {
    let safe = false;
    unregister(); unregister = registerMenuCheckpoint(() => safe);
    const view = renderHook(useUpdate);
    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
    expect(sw.update).not.toHaveBeenCalled();
    safe = true;
    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
    expect(sw.update).toHaveBeenCalledWith(true);
    view.unmount();
  });
  it('keeps admin updates manual', async () => {
    window.history.replaceState({}, '', '/admin/stores/9/orders');
    const view = renderHook(useUpdate);
    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
    expect(sw.update).not.toHaveBeenCalled();
    view.unmount();
  });
  it('does not interrupt an existing cart session; the next QR entry may apply the update', async () => {
    const view = renderHook(({ entryKey }) => useCustomerAutoUpdate({
      needRefresh: true, updateServiceWorker: sw.update, pathname: '/menu/9', entryKey,
    }), { initialProps: { entryKey: 'first' } });
    act(() => window.dispatchEvent(new Event('pointerdown')));
    await act(async () => { await vi.advanceTimersByTimeAsync(6000); });
    expect(sw.update).not.toHaveBeenCalled();
    view.rerender({ entryKey: 'next-qr' });
    await act(async () => { await vi.advanceTimersByTimeAsync(2500); });
    expect(sw.update).toHaveBeenCalledWith(true);
    view.unmount();
  });
});
