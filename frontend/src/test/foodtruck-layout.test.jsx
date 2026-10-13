import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FoodTruckLanding from '../pages/FoodTruckLanding';
import Features from '../pages/foodtruck/FoodTruckFeatures';
import Pricing from '../pages/foodtruck/FoodTruckPricing';
import Guides from '../pages/foodtruck/FoodTruckGuides';
import Contact from '../pages/foodtruck/FoodTruckContact';
vi.mock('../api/client', () => ({ default: { get: vi.fn().mockResolvedValue({ data: [] }) } }));

describe('food truck page owns its layout', () => {
  it('finder does not duplicate the feature marketing page', () => {
    render(<MemoryRouter><FoodTruckLanding /></MemoryRouter>);
    expect(screen.queryByText('FOOD TRUCK FEATURES')).toBeNull();
    expect(screen.getAllByRole('banner')).toHaveLength(1);
  });
  it.each(['기능소개', '요금제', '이용가이드', '문의하기'])('selects one content panel in %s', async label => {
    const { container } = render(<MemoryRouter><FoodTruckLanding /></MemoryRouter>);
    fireEvent.click(screen.getByRole('tab', { name: label }));
    await screen.findByRole('tabpanel');
    expect(container.querySelectorAll('header, nav')).toHaveLength(1);
    expect(container.querySelectorAll('footer')).toHaveLength(1);
  });
  it.each([Features, Pricing, Guides, Contact])('embedded content has no second navigation or footer (%#)', Component => {
    const { container } = render(<MemoryRouter><Component embedded /></MemoryRouter>);
    expect(container.querySelectorAll('nav, footer')).toHaveLength(0);
  });
  it('opens a bookmarked tab without showing the finder', () => {
    render(<MemoryRouter initialEntries={['/foodtruck/landing?tab=pricing']}><FoodTruckLanding /></MemoryRouter>);
    expect(screen.getByRole('tab', { name: '요금제' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByText('실시간 푸드트럭 추적기')).toBeNull();
  });
});
