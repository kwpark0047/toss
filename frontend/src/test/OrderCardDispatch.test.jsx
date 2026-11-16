import { describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import OrderCard from '../components/admin/OrderCard';

afterEach(cleanup);
const props = {
  order: { id: 7, order_number: 'fixture', order_type: 'delivery', status: 'ready',
    total_amount: 10000, latest_dispatch: { status: 'requested', request_state: 'unknown' } },
  statusConfig: { ready: { label: '준비 완료' } },
  formatTime: () => '12:00', onDeliveryAction: vi.fn(), onDispatchAction: vi.fn(),
};

describe('배차 결과가 불확실할 때 중복 배달 방지', () => {
  it('대행사 확인을 안내하고 재요청·취소·직접 배달 버튼을 숨긴다', () => {
    render(<OrderCard {...props} />);
    expect(screen.getByText('배차 결과 확인 필요 · 대행사에 문의')).toBeInTheDocument();
    for (const name of ['배차 요청', '배차 취소', '배달 출발']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });
  it('배차가 확인됐으면 픽업 전 취소할 수 있다', () => {
    render(<OrderCard {...props} order={{ ...props.order,
      latest_dispatch: { status: 'requested', request_state: 'confirmed' } }} />);
    expect(screen.getByRole('button', { name: '배차 취소' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '배달 출발' })).not.toBeInTheDocument();
  });
});
