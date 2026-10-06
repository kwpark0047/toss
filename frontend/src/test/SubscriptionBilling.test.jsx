import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, test, expect, vi } from 'vitest';
import SubscriptionBilling from '../components/admin/SubscriptionBilling';
import { subscriptionsAPI } from '../api/subscriptions';
vi.mock('../api/subscriptions', () => ({
  subscriptionsAPI: {
    get: vi.fn(),
    invoices: vi.fn(),
    checkout: vi.fn(),
    activate: vi.fn(),
    cancel: vi.fn(),
    resume: vi.fn(),
    changePlan: vi.fn(),
    retry: vi.fn(),
  },
}));
const plans = [{ id: 'pro-id', display_name: 'Pro', price_monthly: 30000, price_yearly: 300000 }];
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  window.history.replaceState({}, '', '/');
  subscriptionsAPI.get.mockResolvedValue({
    data: {
      effective_plan: 'free',
      subscription: null,
      usage: { maxMenus: 3, maxStaff: 1, ordersPerMonth: 2 },
    },
  });
  subscriptionsAPI.invoices.mockResolvedValue({ data: [] });
});
test('automatic payment requires explicit consent and uses the selected server checkout', async () => {
  const requestBillingAuth = vi.fn().mockResolvedValue(undefined);
  window.TossPayments = vi.fn(() => ({ requestBillingAuth }));
  subscriptionsAPI.checkout.mockResolvedValue({
    data: {
      checkout_token: 'signed',
      customer_key: 'sub-store',
      client_key: 'test_ck',
      amount: 300000,
    },
  });
  render(<SubscriptionBilling storeId="1" plans={plans} />);
  const subscribe = await screen.findByRole('button', { name: '구독 시작' });
  expect(subscribe).toBeDisabled();
  fireEvent.change(screen.getByLabelText('구독 결제 주기'), { target: { value: 'YEARLY' } });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(subscribe);
  await waitFor(() =>
    expect(subscriptionsAPI.checkout).toHaveBeenCalledWith('1', 'pro-id', 'YEARLY', 'subscribe')
  );
  await waitFor(() =>
    expect(requestBillingAuth).toHaveBeenCalledWith(
      '카드',
      expect.objectContaining({ customerKey: 'sub-store' })
    )
  );
});
test('a callback from a different customer cannot activate a subscription', async () => {
  sessionStorage.setItem(
    'wm-sub-checkout-1',
    JSON.stringify({ token: 'signed', customerKey: 'expected', key: 'stable' })
  );
  window.history.replaceState({}, '', '/?authKey=secret&customerKey=other');
  render(<SubscriptionBilling storeId="1" plans={plans} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('결제 세션이 일치하지 않습니다');
  expect(subscriptionsAPI.activate).not.toHaveBeenCalled();
  expect(window.location.search).toBe('');
});
test('canceling renewal requires the confirmation action', async () => {
  subscriptionsAPI.get.mockResolvedValue({
    data: {
      effective_plan: 'pro',
      subscription: {
        status: 'active',
        auto_renew: true,
        current_period_end: '2026-11-06',
        plan: plans[0],
      },
      usage: { maxMenus: 3, maxStaff: 1, ordersPerMonth: 2 },
    },
  });
  subscriptionsAPI.cancel.mockResolvedValue({});
  render(<SubscriptionBilling storeId="1" plans={plans} />);
  fireEvent.click(await screen.findByRole('button', { name: '자동 갱신 해지' }));
  expect(subscriptionsAPI.cancel).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '해지 확정' }));
  await waitFor(() => expect(subscriptionsAPI.cancel).toHaveBeenCalledWith('1'));
});
