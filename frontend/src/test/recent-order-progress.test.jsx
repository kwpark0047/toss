import { act, render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
const api = vi.hoisted(() => ({ getById: vi.fn(), getCustomerHistory: vi.fn() }));
const live = vi.hoisted(() => ({ changed: null, connection: null, off: vi.fn() }));
vi.mock('../api', () => ({ ordersAPI: api }));
vi.mock('../utils/socket', () => ({
  subscribeCustomerOrder: (_id, _cap, _history, changed, connection) => {
    live.changed = changed;
    live.connection = connection;
    return live.off;
  },
}));
vi.mock('../components/menu/OrderStatusModal', () => ({
  default: ({ isOpen }) => (isOpen ? <div>주문 상세 열림</div> : null),
}));
import RecentOrderBanner from '../components/customer/RecentOrderBanner';
import {
  showOrderReadyNotification,
  setReadyNotificationEnabled,
} from '../utils/orderReadyNotification';
const order = {
  id: 2,
  store_id: 1,
  store_name: 'QA 매장',
  order_number: 'QA-2',
  total_amount: 10000,
  order_type: 'takeout',
  status: 'preparing',
};
const mount = () =>
  render(
    <MemoryRouter>
      <RecentOrderBanner />
    </MemoryRouter>
  );
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  sessionStorage.setItem(
    'wm_recent_order',
    JSON.stringify({ id: 2, store_id: 1, capability: 'fixture-owned', savedAt: Date.now() })
  );
  api.getById.mockResolvedValue({ data: order });
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it('loads canonical status and refreshes the matching order on a live invalidation', async () => {
  mount();
  await screen.findByText('정성껏 조리하고 있어요.');
  expect(api.getById).toHaveBeenCalledWith(2, 'fixture-owned');
  act(() => live.connection('live'));
  expect(screen.getByText('실시간 연결')).toBeInTheDocument();
  api.getById.mockResolvedValue({ data: { ...order, status: 'ready' } });
  await act(async () => {
    await live.changed();
  });
  expect(screen.getByRole('alert')).toHaveTextContent('주문이 준비됐어요');
  await userEvent.click(screen.getByRole('button', { name: '확인했어요' }));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  await act(async () => {
    await live.changed();
  });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('polls after missing events and releases its subscription on unmount', async () => {
  vi.useFakeTimers();
  const view = mount();
  await act(async () => {});
  api.getById.mockResolvedValue({ data: { ...order, status: 'ready' } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(15000);
  });
  expect(screen.getByRole('alert')).toBeInTheDocument();
  view.unmount();
  expect(live.off).toHaveBeenCalledTimes(1);
  const count = api.getById.mock.calls.length;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30000);
  });
  expect(api.getById).toHaveBeenCalledTimes(count);
});
it('retains the last confirmed state and clearly marks offline data', async () => {
  mount();
  await screen.findByText('정성껏 조리하고 있어요.');
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
  act(() => window.dispatchEvent(new Event('offline')));
  expect(screen.getByRole('status')).toHaveTextContent('오프라인');
  expect(screen.getByText('정성껏 조리하고 있어요.')).toBeInTheDocument();
});
it('uses owned history when the short lived order capability expires', async () => {
  localStorage.setItem('wm_customer_history_capability', 'fixture-history');
  api.getById.mockRejectedValue({ response: { status: 403 } });
  api.getCustomerHistory.mockResolvedValue({ data: [order] });
  mount();
  await screen.findByText('정성껏 조리하고 있어요.');
  expect(api.getCustomerHistory).toHaveBeenCalledWith('fixture-history');
});
it('does not display another order or a fabricated ready state on a forbidden lookup', async () => {
  api.getById.mockResolvedValue({ data: { ...order, id: 3, status: 'ready' } });
  mount();
  await screen.findByText(/주문 조회 권한이 만료/);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('keeps screen alerts when browser notification permission is denied', async () => {
  vi.stubGlobal('Notification', { permission: 'denied', requestPermission: vi.fn() });
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
  mount();
  await screen.findByText('정성껏 조리하고 있어요.');
  await userEvent.click(screen.getByRole('button', { name: '준비 완료 알림 켜기' }));
  expect(screen.getByRole('status')).toHaveTextContent('화면 알림은 계속 제공');
  expect(Notification.requestPermission).not.toHaveBeenCalled();
});
it('sends one system notification for repeated ready events and reloads', async () => {
  const show = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('Notification', { permission: 'granted' });
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistration: vi.fn(async () => ({ active: true, showNotification: show })) },
  });
  setReadyNotificationEnabled(true);
  await Promise.all([showOrderReadyNotification(order), showOrderReadyNotification(order)]);
  await showOrderReadyNotification(order);
  expect(show).toHaveBeenCalledTimes(1);
  expect(show).toHaveBeenCalledWith(
    '주문이 준비됐어요',
    expect.objectContaining({ tag: 'wemarket-order-ready-2' })
  );
});
it('ignores an older HTTP response that arrives after a ready update', async () => {
  let resolveOld;
  api.getById.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      })
  );
  mount();
  api.getById.mockResolvedValue({ data: { ...order, status: 'ready' } });
  await act(async () => {
    await live.changed();
  });
  await act(async () => {
    resolveOld({ data: order });
  });
  expect(screen.getByRole('alert')).toBeInTheDocument();
});
