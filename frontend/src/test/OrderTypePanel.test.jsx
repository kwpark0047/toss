import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import OrderTypePanel from '../components/menu/OrderTypePanel';

const baseProps = {
  types: ['takeout', 'delivery'],
  orderType: 'takeout',
  onOrderTypeChange: vi.fn(),
  pickupGuide: '1층 수령대',
  delivery: { fee: 3000, min_order_amount: 15000, est_minutes: 40 },
  deliveryAddress: '',
  onDeliveryAddressChange: vi.fn(),
  deliveryMemo: '',
  onDeliveryMemoChange: vi.fn(),
  quote: null,
  quoting: false,
};

describe('OrderTypePanel', () => {
  it('포장을 고르면 픽업 안내를 보여 주고, 배달로 바꿀 수 있다', () => {
    const onOrderTypeChange = vi.fn();
    render(<OrderTypePanel {...baseProps} onOrderTypeChange={onOrderTypeChange} />);
    expect(screen.getByText('1층 수령대')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /배달/ }));
    expect(onOrderTypeChange).toHaveBeenCalledWith('delivery');
  });

  it('배달이면 주소 입력과 배달 조건, 견적 결과를 보여 준다', () => {
    const onDeliveryAddressChange = vi.fn();
    render(
      <OrderTypePanel
        {...baseProps}
        orderType="delivery"
        onDeliveryAddressChange={onDeliveryAddressChange}
        quote={{ deliverable: false, reason: '배달 가능 지역이 아닙니다.' }}
      />
    );
    expect(screen.getByText(/15,000원 이상 · 배달비 3,000원/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('배달 주소'), { target: { value: '서울 강남구 테헤란로 1' } });
    expect(onDeliveryAddressChange).toHaveBeenCalledWith('서울 강남구 테헤란로 1');
    expect(screen.getByRole('status')).toHaveTextContent('배달 가능 지역이 아닙니다.');
  });

  it('주문 유형이 없으면 아무것도 그리지 않는다', () => {
    const { container } = render(<OrderTypePanel {...baseProps} types={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
