import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const mockConfirm = vi.fn();
const mockNavigate = vi.fn();
let callbackParams = new URLSearchParams();

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [callbackParams, vi.fn()],
  };
});

vi.mock('../api', () => ({
  paymentsAPI: { confirm: (...args) => mockConfirm(...args) },
}));

vi.mock('../firebase', () => ({ requestNotificationPermission: vi.fn() }));
vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('framer-motion', () => ({
  motion: new Proxy({}, { get: (_, tag) => ({ children, ...props }) => React.createElement(tag, props, children) }),
  AnimatePresence: ({ children }) => children,
  LayoutGroup: ({ children }) => children,
}));

import PaymentSuccess from '../pages/PaymentSuccess';
import CartModal from '../components/menu/CartModal';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';

describe('payment release blockers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    callbackParams = new URLSearchParams();
  });

  it('rejects a provider callback without matching session payment state', async () => {
    callbackParams = new URLSearchParams('payment_id=10&paymentKey=key&orderId=ORDER-1&amount=5000');
    render(<PaymentSuccess />);

    expect(await screen.findByText('결제 최종 승인 실패')).toBeInTheDocument();
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it('shows success only after server confirmation with the retained capability', async () => {
    callbackParams = new URLSearchParams('payment_id=10&paymentKey=key&orderId=ORDER-1&amount=5000');
    sessionStorage.setItem('wm_pending_payment:10', JSON.stringify({
      paymentId: '10',
      orderId: '7',
      providerOrderId: 'ORDER-1',
      amount: 5000,
      capability: 'order-capability',
      createdAt: Date.now(),
    }));
    mockConfirm.mockResolvedValue({ success: true, order: { id: 7, store_id: 1 } });

    render(<PaymentSuccess />);

    expect(await screen.findByText('결제가 완료되었습니다!')).toBeInTheDocument();
    expect(mockConfirm).toHaveBeenCalledWith('10', {
      paymentKey: 'key',
      orderId: 'ORDER-1',
      amount: 5000,
    }, 'order-capability');
    expect(sessionStorage.getItem('wm_pending_payment:10')).toBeNull();
  });

  it('enables supported online methods so kakao pay can be selected', async () => {
    const onPaymentMethodChange = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <CartModal
          isOpen
          onClose={vi.fn()}
          cart={[]}
          onUpdateQuantity={vi.fn()}
          onOrder={vi.fn()}
          isOrdering={false}
          totalPrice={0}
          onPaymentMethodChange={onPaymentMethodChange}
        />
      </I18nextProvider>
    );

    const kakaoButton = screen.getByRole('button', { name: '카카오페이' });
    expect(kakaoButton).toBeEnabled();
    await userEvent.click(kakaoButton);
    expect(onPaymentMethodChange).toHaveBeenCalledWith('kakao');
    expect(screen.queryByText('현재 준비 중입니다')).not.toBeInTheDocument();
  });
});
