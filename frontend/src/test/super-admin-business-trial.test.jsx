import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { test, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ trials: vi.fn(), approve: vi.fn() }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../lib/useSEO', () => ({ useSEO: () => {} }));
vi.mock('../api/admin', () => ({
  adminAPI: {
    platformOverview: () => Promise.resolve({}),
    platformTrend: () => Promise.resolve({ daily: [] }),
    enrichmentCoverage: () => Promise.resolve({}),
    linkRequests: () => Promise.resolve({ requests: [] }),
    businessTrials: mocks.trials,
    approveBusinessTrial: mocks.approve,
    platformStores: () => Promise.resolve({ stores: [] }),
  },
  plansAPI: { getStats: () => Promise.resolve({}) },
}));

import Dashboard from '../components/admin/SuperAdminDashboard';

test('shows trial dates and lets a super admin grant formal access', async () => {
  const account = {
      id: 31,
      name: '테스트 사업자',
      phone: '01012345678',
      email: 'trial@example.com',
      effective_status: 'trialing',
      trial_started_at: '2026-10-18T00:00:00.000Z',
      trial_ends_at: '2026-11-18T00:00:00.000Z',
    };
  mocks.trials.mockImplementation(() => Promise.resolve({ accounts: mocks.approve.mock.calls.length ? [] : [account] }));
  mocks.approve.mockResolvedValue({});

  render(<Dashboard />);
  await waitFor(() => expect(mocks.trials).toHaveBeenCalled());
  expect(await screen.findByText(/trial@example\.com/)).toBeInTheDocument();
  expect(screen.getByText(/체험 2026\. 10\. 18\./)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /정식 이용 승인/ }));

  await waitFor(() => expect(mocks.approve).toHaveBeenCalledWith(31));
  await waitFor(() => expect(mocks.trials).toHaveBeenCalledTimes(2));
});

