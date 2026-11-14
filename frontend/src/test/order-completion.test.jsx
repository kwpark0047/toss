import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it } from 'vitest';
import OrderCompletion from '../components/customer/OrderCompletion';

afterEach(cleanup);
const order = {
  id: 7, order_number: 'A-023', store_name: '테스트 매장', total_amount: 13000,
  payment_method: 'card', discount_amount: 1000,
  items: [
    { product_name: '아메리카노', quantity: 2, price: 4000, options: JSON.stringify([{ choiceName: '아이스' }]) },
    { product_name: '치즈케이크', quantity: 1, price: 6000 },
  ],
};
it('shows canonical items, options and charged amount with three explicit destinations', () => {
  render(<MemoryRouter><OrderCompletion order={order} payment={{ totalAmount: 13000 }} paid /></MemoryRouter>);
  expect(screen.getByText('아메리카노 × 2')).toBeInTheDocument();
  expect(screen.getByText('아이스')).toBeInTheDocument();
  expect(screen.getByText('13,000원')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /매장찾기/ })).toHaveAttribute('href', '/search?afterOrder=1');
  for (const [name, href] of [['네이버', 'https://www.naver.com/'], ['유튜브', 'https://www.youtube.com/']]) {
    const link = screen.getByRole('link', { name: new RegExp(name) });
    expect(link).toHaveAttribute('href', href);
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
});
it('keeps unpaid transfer distinct from successful payment', () => {
  render(<MemoryRouter><OrderCompletion order={{ ...order, payment_method: 'transfer' }} /></MemoryRouter>);
  expect(screen.getByText('결제 예정금액')).toBeInTheDocument();
  expect(screen.getByText(/입금 확인 대기 중/)).toBeInTheDocument();
  expect(screen.queryByText('결제가 완료되었습니다!')).not.toBeInTheDocument();
});
it('expands long orders without hiding menu options', async () => {
  render(<MemoryRouter><OrderCompletion order={{ ...order, items: Array.from({ length: 5 }, (_, i) => ({ product_name: `메뉴${i}`, quantity: 1, price: 1000 })) }} paid /></MemoryRouter>);
  await userEvent.click(screen.getByText('나머지 메뉴 2개 보기'));
  expect(screen.getByText('메뉴4 × 1')).toBeVisible();
});
