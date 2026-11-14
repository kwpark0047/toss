import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import AIManagerLive from '../components/admin/AIManagerLive';
const mock = vi.hoisted(() => ({
  options: null,
  live: {
    state: 'IDLE',
    transcript: { input: '', output: '' },
    start: vi.fn(),
    stop: vi.fn(),
    sendText: vi.fn(),
    setMuted: vi.fn(),
  },
}));
vi.mock('../hooks/useAILiveSession', () => ({
  useAILiveSession: (options) => {
    mock.options = options;
    return mock.live;
  },
}));
afterEach(() => {
  vi.clearAllMocks();
  mock.live.state = 'IDLE';
});
it('starts only after consent and always requests manager scope', () => {
  render(<AIManagerLive storeId={3} canExecute={false} />);
  expect(mock.live.start).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Live 상담 시작' })).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Live 상담 시작' }));
  expect(mock.live.start).toHaveBeenCalledWith({ storeId: 3, purpose: 'manager', consent: true });
  expect(screen.getByText(/소유주 승인/)).toBeInTheDocument();
});
it('returns to existing approval cards instead of performing a transition', () => {
  const review = vi.fn();
  render(<AIManagerLive storeId={3} canExecute onReviewActions={review} />);
  fireEvent.click(screen.getByRole('button', { name: '기존 제안·승인 화면 보기' }));
  expect(mock.live.stop).toHaveBeenCalled();
  expect(review).toHaveBeenCalledOnce();
});
it('offers existing text consultation after a denied connection', () => {
  render(<AIManagerLive storeId={3} />);
  act(() => mock.options.onFallback());
  expect(screen.getByRole('status')).toHaveTextContent('기존 텍스트 상담');
});
