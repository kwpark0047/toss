import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
