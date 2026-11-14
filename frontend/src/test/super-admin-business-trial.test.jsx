import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { test, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ trials: vi.fn(), extend: vi.fn(), remove: vi.fn() }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../lib/useSEO', () => ({ useSEO: () => {} }));
vi.mock('../api/admin', () => ({
  adminAPI: {
    platformOverview: () => Promise.resolve({}),
    platformTrend: () => Promise.resolve({ daily: [] }),
    enrichmentCoverage: () => Promise.resolve({}),
    linkRequests: () => Promise.resolve({ requests: [] }),
    businessTrials: mocks.trials,
    extendBusinessTrial: mocks.extend,
    deleteBusinessTrialAccount: mocks.remove,
    platformStores: () => Promise.resolve({ stores: [] }),
  },
  plansAPI: { getStats: () => Promise.resolve({}) },
}));

import Dashboard from '../components/admin/SuperAdminDashboard';

test('shows trial dates and lets a super admin extend the pro trial by 30 days', async () => {
  const account = {
      id: 31,
      name: '테스트 사업자',
      phone: '01012345678',
      email: 'trial@example.com',
      effective_status: 'trialing',
      trial_started_at: '2026-10-18T00:00:00.000Z',
      trial_ends_at: '2026-11-18T00:00:00.000Z',
    };
  mocks.trials.mockResolvedValue({ accounts: [account] });
  mocks.extend.mockResolvedValue({});

  render(<Dashboard />);
  await waitFor(() => expect(mocks.trials).toHaveBeenCalled());
  expect(await screen.findByText(/trial@example\.com/)).toBeInTheDocument();
  expect(screen.getByText(/체험 2026\. 10\. 18\./)).toBeInTheDocument();
  expect(screen.getByText('프로 체험 중')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /정식 이용 승인/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /체험 30일 연장/ }));

  await waitFor(() => expect(mocks.extend).toHaveBeenCalledWith(31, 30));
  await waitFor(() => expect(mocks.trials).toHaveBeenCalledTimes(2));
});

test('labels expired trials as free plan and requires confirmation before deleting an account', async () => {
  const account = { id: 41, name: '만료 계정', email: 'expired@example.com', phone: null, effective_status: 'expired' };
  mocks.trials.mockResolvedValue({ accounts: [account] });
  mocks.remove.mockResolvedValue({});
  render(<Dashboard />);
  expect(await screen.findByText('체험 종료 · 무료 플랜')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /체험 30일 연장/ })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /계정 삭제/ }));
  expect(await screen.findByRole('alertdialog', { name: '계정 삭제 확인' })).toBeInTheDocument();
  const confirmDelete = screen.getByRole('button', { name: '계정 정리 확인' });
  expect(confirmDelete).toBeDisabled();
  fireEvent.change(screen.getByLabelText('삭제 확인 문구'), { target: { value: '삭제' } });
  expect(confirmDelete).toBeEnabled();
  fireEvent.click(confirmDelete);
  await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith(41));
});
