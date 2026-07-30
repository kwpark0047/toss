import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

import StoreCard from '@/components/StoreCard';
import ContactPage from '@/pages/marketing/ContactPage';

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_, tag) => ({ children, layout: _layout, whileHover: _whileHover, whileTap: _whileTap, ...props }) => {
      const Component = tag;
      return <Component {...props}>{children}</Component>;
    },
  }),
  AnimatePresence: ({ children }) => children,
}));

const store = {
  id: 42,
  name: '테스트 매장',
  business_type: 'cafe',
  address: '서울시 강남구',
};

describe('프런트엔드 출시 차단 회귀', () => {
  it('StoreCard를 접근 가능한 메뉴 Link로 제공하고 내부 액션을 분리', async () => {
    const user = userEvent.setup();
    const onWaitClick = vi.fn();

    render(
      <MemoryRouter>
        <StoreCard store={store} onWaitClick={onWaitClick} />
      </MemoryRouter>
    );

    const menuLink = screen.getByRole('link', { name: '테스트 매장 메뉴 보기' });
    expect(menuLink).toHaveAttribute('href', '/menu/42');
    expect(menuLink.querySelector('button')).toBeNull();

    await user.tab();
    expect(menuLink).toHaveFocus();

    await user.click(screen.getByRole('button', { name: '대기 신청' }));
    expect(onWaitClick).toHaveBeenCalledWith(store);
  });

  it('ContactPage가 문의를 성공으로 가장하지 않고 대체 연락 경로를 안내', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ContactPage />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText('성명 (필수)'), '홍길동');
    await user.type(screen.getByLabelText('연락처 (필수)'), '010-1234-5678');
    await user.type(screen.getByLabelText('이메일 주소 (필수)'), 'hong@example.com');
    await user.type(screen.getByLabelText('문의 내용 (필수)'), '도입 상담을 요청합니다.');
    await user.click(screen.getByRole('button', { name: '이메일 문의 안내 보기' }));

    expect(screen.getByRole('alert')).toHaveTextContent('온라인으로 접수되지 않았습니다.');
    expect(screen.queryByText('상담 신청 접수 완료!')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '이메일로 문의하기' })).toHaveAttribute(
      'href',
      expect.stringContaining('mailto:support@wemarket.co.kr')
    );
  });
});
