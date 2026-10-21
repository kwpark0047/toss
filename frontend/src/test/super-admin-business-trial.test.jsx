import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { test, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ trials: vi.fn(), approve: vi.fn(), revoke: vi.fn(), restrict: vi.fn(), restore: vi.fn(), remove: vi.fn() }));
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
    restrictBusinessTrialAccess: mocks.restrict,
    restoreBusinessTrialAccess: mocks.restore,
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
  expect(mocks.trials).toHaveBeenCalledWith('all');
  expect(await screen.findByText(/trial@example\.com/)).toBeInTheDocument();
  expect(screen.getByText(/체험 2026\. 10\. 18\./)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /정식 이용 승인/ }));

  await waitFor(() => expect(mocks.approve).toHaveBeenCalledWith(31));
  await waitFor(() => expect(mocks.trials).toHaveBeenCalledTimes(2));
});

test('requires confirmation before revoking approval and only offers deletion for trial accounts', async () => {
  const account = { id: 41, name: '승인 계정', email: 'approved@example.com', phone: null, effective_status: 'approved' };
  const trial = { id: 42, name: '체험 계정', email: 'trial@example.com', phone: null, effective_status: 'trialing', trial_started_at: '2026-10-18T00:00:00.000Z', trial_ends_at: '2026-11-18T00:00:00.000Z' };
  mocks.trials.mockResolvedValue({ accounts: [account, trial] });
  mocks.revoke.mockResolvedValue({});
  mocks.remove.mockResolvedValue({});
  render(<Dashboard />);
  fireEvent.click(await screen.findByRole('button', { name: /승인 취소/ }));
  expect(await screen.findByRole('alertdialog', { name: '승인 취소 확인' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '승인 취소 확인' }));
  await waitFor(() => expect(mocks.revoke).toHaveBeenCalledWith(41));

  expect(screen.getByText(/approved@example\.com/).closest('.rounded-xl')).not.toHaveTextContent('계정 삭제');
  fireEvent.click(await screen.findByRole('button', { name: /계정 삭제/ }));
  const confirmDelete = screen.getByRole('button', { name: '계정 정리 확인' });
  expect(confirmDelete).toBeDisabled();
  fireEvent.change(screen.getByLabelText('삭제 확인 문구'), { target: { value: '삭제' } });
  expect(confirmDelete).toBeEnabled();
  fireEvent.click(confirmDelete);
  await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith(42));
});

test('requires a reason to suspend a business account and offers restoration for restricted accounts', async () => {
  const trial = { id: 51, name: '체험 계정', email: 'trial@example.com', effective_status: 'trialing', trial_started_at: '2026-10-18T00:00:00.000Z', trial_ends_at: '2026-11-18T00:00:00.000Z' };
  mocks.trials.mockResolvedValue({ accounts: [trial] });
  mocks.restrict.mockResolvedValue({});
  render(<Dashboard />);
  fireEvent.click(await screen.findByRole('button', { name: /일시 중단/ }));
  const action = await screen.findByRole('alertdialog', { name: '사업자 이용 상태 변경 확인' });
  const apply = within(action).getByRole('button', { name: '제한 적용' });
  expect(apply).toBeDisabled();
  fireEvent.change(screen.getByLabelText('이용 제한 사유'), { target: { value: '정책 위반 확인' } });
  fireEvent.click(apply);
  await waitFor(() => expect(mocks.restrict).toHaveBeenCalledWith(51, 'suspended', '정책 위반 확인'));

  cleanup();
  mocks.trials.mockResolvedValue({ accounts: [{ ...trial, effective_status: 'fraud_review' }] });
  render(<Dashboard />);
  fireEvent.click(await screen.findByRole('button', { name: /계정 복구/ }));
  fireEvent.click(await screen.findByRole('button', { name: '복구 확인' }));
  await waitFor(() => expect(mocks.restore).toHaveBeenCalledWith(51));
});
