import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import VoiceOrderAssistant from '@/components/menu/VoiceOrderAssistant';

afterEach(() => vi.unstubAllGlobals());

describe('VoiceOrderAssistant customer entry point', () => {
  it('uses a high-contrast primary color for the voice-order action', () => {
    render(<VoiceOrderAssistant storeId={3} canOrder menuItems={[]} />);

    const button = screen.getByRole('button', { name: /말로 메뉴 주문하기/ });
    expect(button).toHaveClass('from-orange-500', 'to-rose-600', 'text-white');
    expect(button).toHaveTextContent('한 번 눌러 주문');
  });

  it('keeps the voice action disabled with a clear reason when ordering is unavailable', () => {
    render(<VoiceOrderAssistant storeId={3} canOrder={false} menuItems={[]} />);

    const button = screen.getByRole('button', { name: /말로 메뉴 주문하기/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-describedby', 'voice-order-unavailable');
    expect(screen.getByText('매장 영업시간에 이용할 수 있어요.')).toBeInTheDocument();
  });

  it('starts listening on the first tap and keeps recognized speech editable without submitting an order', () => {
    let recognition;
    const startRecognition = vi.fn();
    class FakeSpeechRecognition {
      constructor() { recognition = this; }
      start() {
        startRecognition();
        this.onstart?.();
      }
      stop() { this.onend?.(); }
      abort() {}
    }
    vi.stubGlobal('SpeechRecognition', FakeSpeechRecognition);

    render(<VoiceOrderAssistant storeId={3} canOrder menuItems={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /말로 메뉴 주문하기/ }));

    expect(startRecognition).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: '말하기 완료' })).toBeInTheDocument();

    const result = Object.assign([{ transcript: '짜장면 한 그릇 주세요' }], { isFinal: true });
    act(() => recognition.onresult({ results: [result] }));

    expect(screen.getByLabelText(/주문 문장/)).toHaveValue('짜장면 한 그릇 주세요');
    expect(screen.getByText(/직접 입력할 수 있어요/)).toBeInTheDocument();
  });
});
