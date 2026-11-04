import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test } from 'vitest';
import PricingPage from '../pages/marketing/PricingPage';
import FoodTruckPricing from '../pages/foodtruck/FoodTruckPricing';

// 운영 요금제(/api/plans): pro 월 20,000·연 200,000 / enterprise 월 50,000·연 500,000, pro 직원 최대 10명
const pages = [
  ['요금제 페이지', PricingPage],
  ['푸드트럭 요금제 페이지', FoodTruckPricing],
];

test.each(pages)('%s는 실제 결제 가격과 한도를 표시한다', (_name, Page) => {
  render(<MemoryRouter><Page /></MemoryRouter>);
  expect(screen.getByText('₩50,000')).toBeInTheDocument();
  expect(screen.queryByText(/79,000/)).not.toBeInTheDocument();
  expect(screen.getByText(/직원·매니저 계정 최대 10명/)).toBeInTheDocument();
  expect(screen.queryByText(/무제한 계정/)).not.toBeInTheDocument();
  expect(screen.queryByText(/SLA|엔지니어 배정/)).not.toBeInTheDocument();
  // 결제 금액은 표시 가격 그대로 청구되므로(부가세 별도 가산 없음) VAT 포함으로 안내한다
  expect(screen.getAllByText('/월 · VAT 포함').length).toBe(3);
});

test.each(pages)('%s의 연 결제는 2개월 무료(월 요금 × 10) 기준으로 월 환산한다', (_name, Page) => {
  render(<MemoryRouter><Page /></MemoryRouter>);
  expect(screen.getByText('2개월 무료')).toBeInTheDocument();
  expect(screen.queryByText(/20% SAVE/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('2개월 무료').closest('div').querySelector('button'));
  expect(screen.getByText('₩16,667')).toBeInTheDocument();
  expect(screen.getByText('₩41,667')).toBeInTheDocument();
});

test('엔터프라이즈 버튼은 문의 페이지로 연결한다', () => {
  render(<MemoryRouter><PricingPage /></MemoryRouter>);
  const links = screen.getAllByRole('link').filter((a) => a.getAttribute('href') === '/contact');
  expect(links.length).toBeGreaterThan(0);
});
