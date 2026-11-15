import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import FoodTruckAnalyticsDashboard from './FoodTruckAnalyticsDashboard';

const { api } = vi.hoisted(() => ({ api: { get: vi.fn() } }));
vi.mock('@/api/client', () => ({ default: api }));

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/admin/stores/7/foodtruck/analytics']}>
      <Routes>
        <Route path="/admin/stores/:storeId/foodtruck/analytics" element={<FoodTruckAnalyticsDashboard />} />
      </Routes>
    </MemoryRouter>
  );
}

const realData = {
  totalSales: 24000,
  totalOrderCount: 2,
  averageOrderValue: 12000,
  hourlyOrders: Array.from({ length: 24 }, (_, h) => (h === 12 ? 2 : 0)),
  hourlySales: Array.from({ length: 24 }, (_, h) => (h === 12 ? 24000 : 0)),
  dailyOrders: [0, 2, 0, 0, 0, 0, 0],
  dailySales: [0, 24000, 0, 0, 0, 0, 0],
  locationSales: [],
  aiInsights: { summary: '실제 요약', peakAdvice: '피크 조언', inventoryStrategy: '재고 전략' },
};

describe('FoodTruckAnalyticsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('shows an error state instead of fabricated numbers when the API fails', async () => {
    api.get.mockRejectedValue(new Error('network'));
    renderDashboard();
    expect(await screen.findByText('분석을 불러올 수 없어요')).toBeTruthy();
    expect(screen.queryByText(/4,580,000/)).toBeNull();
    expect(screen.queryByText('홍대입구역 9번 출구')).toBeNull();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy();
  });

  it('shows an empty state when the store has no orders yet', async () => {
    api.get.mockResolvedValue({ success: true, data: { ...realData, totalOrderCount: 0, totalSales: 0 } });
    renderDashboard();
    expect(await screen.findByText('아직 분석할 주문이 없어요')).toBeTruthy();
  });

  it('renders API data when available', async () => {
    api.get.mockResolvedValue({ success: true, data: realData });
    renderDashboard();
    expect(await screen.findByText('₩24,000')).toBeTruthy();
    expect(screen.getByText('실제 요약')).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/foodtruck/stores/7/analytics');
  });

  it('recovers from an API failure through the retry button', async () => {
    api.get.mockRejectedValueOnce(Error('offline')).mockResolvedValueOnce({ success: true, data: realData });
    renderDashboard();
    fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('₩24,000')).toBeVisible();
    expect(screen.queryByText('분석을 불러올 수 없어요')).toBeNull();
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('removes stale metrics if a refresh fails', async () => {
    api.get.mockResolvedValueOnce({ success: true, data: realData }).mockRejectedValueOnce(Error('offline'));
    renderDashboard();
    await screen.findByText('₩24,000');
    fireEvent.click(screen.getByRole('button', { name: '실시간 갱신' }));
    expect(await screen.findByText('분석을 불러올 수 없어요')).toBeVisible();
    expect(screen.queryByText('₩24,000')).toBeNull();
    expect(screen.queryByText('실제 요약')).toBeNull();
  });

  it.each([null, { success: false, data: realData }, { success: true, data: null }, { success: true, data: { ...realData, totalOrderCount: null } }])('treats an invalid response as an error rather than no orders', async (response) => {
    api.get.mockResolvedValue(response);
    renderDashboard();
    expect(await screen.findByText('분석을 불러올 수 없어요')).toBeVisible();
    expect(screen.queryByText('아직 분석할 주문이 없어요')).toBeNull();
  });

  it('can retry an empty state and display newly available data', async () => {
    api.get.mockResolvedValueOnce({ success: true, data: { ...realData, totalOrderCount: 0, totalSales: 0 } }).mockResolvedValueOnce({ success: true, data: realData });
    renderDashboard();
    await screen.findByText('아직 분석할 주문이 없어요');
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    await waitFor(() => expect(screen.getByText('₩24,000')).toBeVisible());
  });

  it.each([
    { totalSales: -1 },
    { hourlyOrders: [] },
    { dailySales: [NaN, 0, 0, 0, 0, 0, 0] },
    { locationSales: [null] },
    { aiInsights: { summary: { invalid: true } } },
  ])('rejects malformed metrics and chart content without rendering fabricated data', async (patch) => {
    api.get.mockResolvedValue({ success: true, data: { ...realData, ...patch } });
    renderDashboard();
    expect(await screen.findByText('분석을 불러올 수 없어요')).toBeVisible();
    expect(screen.queryByText('₩24,000')).toBeNull();
  });
});
