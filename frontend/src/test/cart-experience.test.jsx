import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, { get: (_, tag) => ({ children, ...props }) => React.createElement(tag, props, children) }),
  AnimatePresence: ({ children }) => children,
  LayoutGroup: ({ children }) => children,
}));
vi.mock('../components/common/LazyImage', () => ({ default: ({ alt }) => <img alt={alt} /> }));

import CartModal from '../components/menu/CartModal';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';

const cart = [{
  cartItemId: 'menu-1-instance-1',
  menuItem: { id: 1, name: '불고기 덮밥', image_url: '', emoji: '🍚', category_id: 1 },
  quantity: 1,
  unitPrice: 12000,
  selectedOptions: [],
}];

const addCartStrings = () => i18n.addResourceBundle('ko', 'translation', {
  common: { close: '닫기' },
  cart_modal: {
    title: '장바구니', empty_title: '장바구니가 비어 있습니다', empty_desc: '메뉴를 담아 주세요',
    split_payment: '친구와 나누어 결제할까요?', split_payment_setting: '분할 결제 설정',
    notify_phone: '주문 알림 받을 번호', notify_phone_hint: '문자로 주문 상태 안내 (선택)',
    notify_phone_saved: '저장된 번호', notify_phone_invalid: '휴대전화 번호 형식을 확인해 주세요.',
    select_payment: '결제 수단 선택', select_payment_guide: '결제 수단을 선택해 주세요',
    popular_combo: '추천 메뉴', popular_menu: '인기 메뉴', recommended_pairing: '추천', add: '추가하기',
    order_with_method: '{{method}} 주문하기', easy_payment: '간편결제', easy_payment_desc: '앱 결제',
    standard_payment: '일반결제', standard_payment_desc: '매장 결제', toss_pay_desc: '토스',
    kakao_pay_desc: '카카오', naver_pay_desc: '네이버', cash_desc: '현금', card_desc: '카드', transfer_desc: '이체',
    minimize: '메뉴 보며 계속 담기', open_cart: '장바구니 열기', items_unit: '개',
    split_payment_pending: '결제 진행 중',
    split_payment_card_only: '분할 결제는 신용카드만 가능합니다.',
    remove_item: '{{name}} 삭제', decrease_quantity: '{{name}} 수량 줄이기', increase_quantity: '{{name}} 수량 늘리기',
  },
}, true, true);

describe('customer cart experience', () => {
  it('minimizes to a non-blocking cart bar and preserves the cart for further edits', async () => {
    addCartStrings();
    const user = userEvent.setup();
    const onUpdateQuantity = vi.fn();
    const onAddToCartClick = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <button onClick={() => onAddToCartClick({ id: 2, name: '김치찌개' })}>메뉴 추가</button>
        <CartModal isOpen onClose={vi.fn()} cart={cart} onUpdateQuantity={onUpdateQuantity}
          onOrder={vi.fn()} onSplitPayment={vi.fn()} isOrdering={false} totalPrice={12000}
          menuItems={[]} />
      </I18nextProvider>
    );

    await user.click(screen.getByRole('button', { name: '메뉴 보며 계속 담기' }));
    expect(screen.queryByRole('dialog', { name: '장바구니' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: '장바구니' })).toHaveTextContent('1개');
    await user.click(screen.getByRole('button', { name: '메뉴 추가' }));
    expect(onAddToCartClick).toHaveBeenCalledWith({ id: 2, name: '김치찌개' });

    await user.click(screen.getByRole('button', { name: '장바구니 열기' }));
    await user.click(screen.getByRole('button', { name: '불고기 덮밥 수량 줄이기' }));
    expect(onUpdateQuantity).toHaveBeenCalledWith('menu-1-instance-1', -1);
  });

  it('opens a split configuration, caps party size, and sends the calculated share', async () => {
    addCartStrings();
    const user = userEvent.setup();
    const onSplitPayment = vi.fn().mockResolvedValue({ success: true });
    render(
      <I18nextProvider i18n={i18n}>
        <CartModal isOpen onClose={vi.fn()} cart={cart} onUpdateQuantity={vi.fn()}
          onOrder={vi.fn()} onSplitPayment={onSplitPayment} isOrdering={false} totalPrice={12000} />
      </I18nextProvider>
    );

    await user.click(screen.getByRole('button', { name: '분할 결제 설정' }));
    expect(screen.getByText('함께 결제하기')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '인원 한 명 추가' }));
    await user.click(screen.getByRole('button', { name: '내 몫만 결제하기' }));
    expect(onSplitPayment).toHaveBeenCalledWith(expect.objectContaining({
      split_type: 'EQUAL',
      amount: 4000,
      people_count: 3,
    }));
  });

  it('validates an optional order notification phone before submission', async () => {
    addCartStrings();
    const onNotifyPhoneChange = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <CartModal isOpen onClose={vi.fn()} cart={cart} onUpdateQuantity={vi.fn()}
          onOrder={vi.fn()} isOrdering={false} totalPrice={12000} notifyPhone="010-12"
          onNotifyPhoneChange={onNotifyPhoneChange} />
      </I18nextProvider>
    );
    expect(screen.getByLabelText(/주문 알림 받을 번호/)).toHaveAttribute('aria-invalid', 'true');
  });
});

