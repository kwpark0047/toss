import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import TinkerBellLivePanel from '../components/ai/TinkerBellLivePanel';
import TinkerBell from '../components/ai/TinkerBell';
vi.mock('../hooks/useMotionSafe', () => ({ useMotionSafe: () => ({ motionIntensity: 'none' }) }));
const live = vi.hoisted(() => ({
  state: 'IDLE',
  transcript: { input: '', output: '' },
  start: vi.fn(),
  stop: vi.fn(),
  sendText: vi.fn(),
  setMuted: vi.fn(),
  interrupt: vi.fn(),
}));
vi.mock('../hooks/useAILiveSession', () => ({ useAILiveSession: () => live }));
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  live.state = 'IDLE';
  live.transcript = { input: '', output: '' };
});
describe('Tinkerbell Live opt-in', () => {
  it('keeps the character static fallback and Live default off independently of recommendations', () => {
    vi.useFakeTimers();
    const { rerender } = render(<TinkerBell liveStoreId={3} />);
    act(() => vi.advanceTimersByTime(1800));
    expect(screen.getByTestId('fairy-static')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '음성 대화' })).not.toBeInTheDocument();
    rerender(<TinkerBell liveStoreId={3} liveEnabled storeId={null} />);
    fireEvent.click(screen.getByRole('button', { name: '음성 대화' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(live.start).not.toHaveBeenCalled();
  });
  it('never exposes customer Live in admin previews', () => {
    vi.useFakeTimers();
    render(<TinkerBell liveStoreId={3} liveEnabled mode="preview" adminMode />);
    act(() => vi.advanceTimersByTime(1800));
    expect(screen.queryByRole('button', { name: '음성 대화' })).not.toBeInTheDocument();
  });
  it('does not connect until consent and explicit start', () => {
    render(<TinkerBellLivePanel storeId={3} lang="ko" onClose={() => {}} />);
    expect(live.start).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '대화 시작' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: '대화 시작' }));
    expect(live.start).toHaveBeenCalledWith({ storeId: 3, purpose: 'customer', consent: true });
  });
  it('shows safe fallback and leaves legacy voice available', () => {
    live.state = 'FALLBACK';
    render(<TinkerBellLivePanel storeId={3} onClose={() => {}} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '보내기' })).not.toBeInTheDocument();
  });
  it('supports captions, text and mute without placing an order', () => {
    live.state = 'LISTENING';
    live.transcript = { input: '달지 않은 음료', output: '메뉴를 확인할게요' };
    render(<TinkerBellLivePanel storeId={3} onClose={() => {}} />);
    expect(screen.getByText('메뉴를 확인할게요')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '추천해 주세요' } });
    fireEvent.click(screen.getByRole('button', { name: '보내기' }));
    expect(live.sendText).toHaveBeenCalledWith('추천해 주세요');
    fireEvent.click(screen.getByRole('button', { name: '음소거' }));
    expect(live.setMuted).toHaveBeenCalledWith(true);
  });
  it('ends and cleans up on close/unmount', () => {
    const close = vi.fn();
    const { unmount } = render(<TinkerBellLivePanel storeId={3} onClose={close} />);
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(live.stop).toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
    unmount();
    expect(live.stop).toHaveBeenCalled();
  });
  it.each([
    ['en', 'Start conversation'],
    ['ja', '会話を開始'],
    ['zh', '开始对话'],
    ['tl', 'Simulan ang usapan'],
    ['vi', 'Bắt đầu trò chuyện'],
    ['id', 'Mulai percakapan'],
    ['th', 'เริ่มสนทนา'],
    ['ms', 'Mulakan perbualan'],
  ])('keeps %s controls localized', (lang, label) => {
    render(<TinkerBellLivePanel storeId={3} lang={lang} onClose={() => {}} />);
    expect(screen.getByRole('button', { name: label })).toBeDisabled();
  });
});
