import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { test, expect, vi } from 'vitest';
const requests = vi.hoisted(() => ({ overview: vi.fn(), stats: vi.fn(), coverage: vi.fn() }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../lib/useSEO', () => ({ useSEO: () => {} }));
vi.mock('../api/admin', () => ({ adminAPI: { platformOverview: requests.overview, platformTrend: () => Promise.resolve({daily: []}), enrichmentCoverage: requests.coverage, linkRequests: () => Promise.resolve({requests: []}), platformStores: () => Promise.resolve({stores: []}) }, plansAPI: {getStats: requests.stats} }));
import Dashboard from '../components/admin/SuperAdminDashboard';
test('shows primary metrics without waiting for slow subscriptions; queues optional requests', async () => {
  let finish; requests.overview.mockResolvedValue({ totalStores: 123 });
  requests.stats.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  requests.coverage.mockResolvedValue({});
  render(<Dashboard />);
  await screen.findByText('123');
  expect(requests.coverage).not.toHaveBeenCalled();
  finish({});
  await waitFor(() => expect(requests.coverage).toHaveBeenCalledTimes(1));
});
test('retry clears resolved section errors without reloading the browser', async () => {
  requests.overview.mockResolvedValue({}); requests.stats.mockRejectedValueOnce(Error('pool')).mockResolvedValue({}); requests.coverage.mockResolvedValue({});
  render(<Dashboard />);
  await screen.findByRole('alert');
  fireEvent.click(screen.getByText('다시 불러오기'));
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
});
