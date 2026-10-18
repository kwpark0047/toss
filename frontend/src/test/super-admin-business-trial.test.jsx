import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { test, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ trials: vi.fn(), approve: vi.fn(), revoke: vi.fn(), remove: vi.fn() }));
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
    revokeBusinessTrialApproval: mocks.revoke,
    deleteBusinessTrialAccount: mocks.remove,
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

test('requires confirmation before revoking formal approval or deleting an account', async () => {
  const account = { id: 41, name: '승인 계정', email: 'approved@example.com', phone: null, effective_status: 'approved' };
  mocks.trials.mockResolvedValue({ accounts: [account] });
  mocks.revoke.mockResolvedValue({});
  mocks.remove.mockResolvedValue({});
  render(<Dashboard />);
  fireEvent.click(await screen.findByRole('button', { name: /승인 취소/ }));
  expect(await screen.findByRole('alertdialog', { name: '승인 취소 확인' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '승인 취소 확인' }));
  await waitFor(() => expect(mocks.revoke).toHaveBeenCalledWith(41));

  fireEvent.click(await screen.findByRole('button', { name: /계정 삭제/ }));
  const confirmDelete = screen.getByRole('button', { name: '계정 정리 확인' });
  expect(confirmDelete).toBeDisabled();
  fireEvent.change(screen.getByLabelText('삭제 확인 문구'), { target: { value: '삭제' } });
  expect(confirmDelete).toBeEnabled();
  fireEvent.click(confirmDelete);
  await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith(41));
});

