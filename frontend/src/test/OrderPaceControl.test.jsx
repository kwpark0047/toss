import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

const api = vi.hoisted(() => ({ getOrderPace: vi.fn(), updateOrderPace: vi.fn() }));
vi.mock('../api', () => ({ adminAPI: api }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../utils/apiError', () => ({ handleApiError: vi.fn() }));

import OrderPaceControl from '@/components/admin/OrderPaceControl';

describe('OrderPaceControl', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders nothing when the settings cannot be loaded (e.g. before migration)', async () => {
    api.getOrderPace.mockRejectedValue(new Error('500'));
    const { container } = render(<OrderPaceControl storeId="1" />);
    await waitFor(() => expect(api.getOrderPace).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('saves extra wait minutes and pauses orders', async () => {
    api.getOrderPace.mockResolvedValue({ data: { extra_wait_minutes: 0, orders_paused: false, orders_paused_until: null } });
    api.updateOrderPace.mockResolvedValue({ data: { extra_wait_minutes: 20, orders_paused: false, orders_paused_until: null } });
    render(<OrderPaceControl storeId="1" />);
    const twenty = await screen.findByRole('button', { name: '20분' });
    await act(async () => { fireEvent.click(twenty); });
    expect(api.updateOrderPace).toHaveBeenCalledWith('1', { extra_wait_minutes: 20 });
    expect(screen.getByRole('button', { name: '20분' })).toHaveAttribute('aria-pressed', 'true');

    api.updateOrderPace.mockResolvedValue({
      data: { extra_wait_minutes: 20, orders_paused: true, orders_paused_until: '2026-11-02T12:30:00.000Z' },
    });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '30분 동안 주문 멈추기' })); });
    expect(api.updateOrderPace).toHaveBeenLastCalledWith('1', { pause_minutes: 30 });
    expect(screen.getByRole('button', { name: '지금 다시 받기' })).toBeInTheDocument();
  });
});
