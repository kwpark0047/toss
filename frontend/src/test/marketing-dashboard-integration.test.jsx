import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import CampaignDashboard from '../components/admin/CampaignDashboard';
vi.mock('../api/admin', () => ({
  campaignAPI: {
    getList: async () => {
      throw Error('offline');
    },
    getCoupons: async () => [],
    getAnalysis: async () => null,
    getAutomationRuns: async () => [],
  },
}));
vi.mock('../components/admin/AIMarketingDrafts', () => ({
  default: ({ storeId }) => <div>초안 매장 {storeId}</div>,
}));
it('offers store-scoped drafts even when existing campaign data is unavailable', async () => {
  render(
    <MemoryRouter initialEntries={['/3']}>
      <Routes>
        <Route path="/:storeId" element={<CampaignDashboard />} />
      </Routes>
    </MemoryRouter>
  );
  fireEvent.click(await screen.findByRole('button', { name: 'AI 마케팅 초안' }));
  expect(await screen.findByText('초안 매장 3')).toBeInTheDocument();
});
