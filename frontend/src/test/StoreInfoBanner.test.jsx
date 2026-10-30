import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import StoreInfoBanner from '@/components/menu/StoreInfoBanner';

vi.mock('framer-motion', () => ({
  motion: { div: ({ children, ...props }) => <div {...props}>{children}</div> },
  AnimatePresence: ({ children }) => <>{children}</>,
}));
vi.mock('@/components/common/NaverShareButton', () => ({ default: () => null }));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('StoreInfoBanner', () => {
  it('closed stores show the next opening time when a schedule is available', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-22T14:00:00+09:00'));
    const businessHours = Object.fromEntries(
      ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => [
        day,
        { open: '10:00', close: '22:00', closed: false },
      ])
    );

    render(<StoreInfoBanner isOpen={false} businessHours={businessHours} />);

    expect(screen.getByText('내일 10:00에 다시 열어요')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('영업 시간에 다시 주문할 수 있어요');
  });

  it('schedule missing still explains that ordering is temporarily unavailable', () => {
    render(<StoreInfoBanner isOpen={false} />);
    expect(screen.getByText('영업 시간에 다시 주문할 수 있어요')).toBeInTheDocument();
  });
});
