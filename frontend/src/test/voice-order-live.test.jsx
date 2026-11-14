import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import LiveVoiceOrderAssistant from '../components/menu/LiveVoiceOrderAssistant';
const mock = vi.hoisted(() => ({
  options: null,
  live: {
    state: 'IDLE',
    transcript: { input: '', output: '' },
    start: vi.fn(),
    stop: vi.fn(),
    sendText: vi.fn(),
    confirmDraft: vi.fn(),
    setMuted: vi.fn(),
    invalidateDraft: vi.fn(),
  },
}));
vi.mock('../hooks/useAILiveSession', () => ({
  useAILiveSession: (options) => {
    mock.options = options;
    return mock.live;
  },
}));
const menu = [{ id: 1, name: '커피', price: 1000, options: [] }];
const draft = {
  success: true,
  draftId: 'd1',
  items: [
    {
      product_id: 1,
      name: '커피',
      quantity: 2,
      base_price: 1000,
      unit_price: 1000,
      line_total: 2000,
      selected_options: [],
    },
  ],
  total: 2000,
};
it('does not confirm while a correction is still being typed', () => {
  mock.live.state = 'LISTENING';
  const add = vi.fn();
  render(<LiveVoiceOrderAssistant storeId={3} menuItems={menu} canOrder onAddDraft={add} />);
  fireEvent.click(screen.getByRole('button', { name: 'Live로 주문하기' }));
  act(() => mock.options.onDraft(draft));
  fireEvent.change(screen.getByRole('textbox', { name: 'Live 주문 문장' }), {
    target: { value: '하나 빼 주세요' },
  });
  act(() => mock.options.onDraft({ ...draft, draftId: 'late' }));
  expect(screen.getByRole('button', { name: '확인 후 장바구니에 담기' })).toBeDisabled();
  expect(add).not.toHaveBeenCalled();
});
afterEach(() => {
  vi.clearAllMocks();
  mock.live.state = 'IDLE';
});
it('requires consent, shows server draft and applies once only after customer confirmation', () => {
  const add = vi.fn();
  let consumed = false;
  mock.live.confirmDraft.mockImplementation((id, apply) => {
    if (consumed) return false;
    consumed = true;
    apply(draft);
    return true;
  });
  render(<LiveVoiceOrderAssistant storeId={3} menuItems={menu} canOrder onAddDraft={add} />);
  fireEvent.click(screen.getByRole('button', { name: 'Live로 주문하기' }));
  expect(mock.live.start).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: '대화 시작' })).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: '대화 시작' }));
  act(() => mock.options.onDraft(draft));
  expect(add).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '확인 후 장바구니에 담기' }));
  expect(add).toHaveBeenCalledOnce();
  expect(add.mock.calls[0][0][0]).toMatchObject({ quantity: 2, unitPrice: 1000 });
});
it('clears old drafts on correction and blocks closed stores', () => {
  const add = vi.fn();
  const { rerender } = render(
    <LiveVoiceOrderAssistant storeId={3} menuItems={menu} canOrder onAddDraft={add} />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Live로 주문하기' }));
  act(() => mock.options.onDraft(draft));
  act(() => mock.options.onDraft(null));
  expect(screen.getByRole('button', { name: '확인 후 장바구니에 담기' })).toBeDisabled();
  act(() => mock.options.onDraft(draft));
  rerender(
    <LiveVoiceOrderAssistant storeId={3} menuItems={menu} canOrder={false} onAddDraft={add} />
  );
  expect(screen.getByRole('button', { name: '확인 후 장바구니에 담기' })).toBeDisabled();
  expect(add).not.toHaveBeenCalled();
});
it('falls back to existing voice ordering without adding anything', () => {
  const fallback = vi.fn(),
    add = vi.fn();
  render(
    <LiveVoiceOrderAssistant
      storeId={3}
      menuItems={menu}
      canOrder
      onFallback={fallback}
      onAddDraft={add}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Live로 주문하기' }));
  act(() => mock.options.onDraft(draft));
  act(() => mock.options.onFallback());
  expect(add).not.toHaveBeenCalled();
  expect(fallback).toHaveBeenCalledOnce();
});
it('replaces an earlier draft with the latest full snapshot rather than appending deltas', () => {
  const add = vi.fn();
  mock.live.confirmDraft.mockImplementation((_id, apply) => {
    apply();
    return true;
  });
  render(<LiveVoiceOrderAssistant storeId={3} menuItems={menu} canOrder onAddDraft={add} />);
  fireEvent.click(screen.getByRole('button', { name: 'Live로 주문하기' }));
  act(() => mock.options.onDraft(draft));
  const updated = {
    ...draft,
    draftId: 'd2',
    items: [{ ...draft.items[0], quantity: 1, line_total: 1000 }],
    total: 1000,
  };
  act(() => mock.options.onDraft(updated));
  fireEvent.click(screen.getByRole('button', { name: '확인 후 장바구니에 담기' }));
  expect(add).toHaveBeenCalledOnce();
  expect(add.mock.calls[0][0]).toHaveLength(1);
  expect(add.mock.calls[0][0][0].quantity).toBe(1);
});
it('never applies a stale price or a draft needing clarification', () => {
  const add = vi.fn();
  render(
    <LiveVoiceOrderAssistant
      storeId={3}
      menuItems={[{ ...menu[0], price: 2000 }]}
      canOrder
      onAddDraft={add}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Live로 주문하기' }));
  act(() =>
    mock.options.onDraft({
      ...draft,
      needs_clarification: true,
      clarifications: ['옵션을 확인하세요'],
    })
  );
  expect(screen.getByRole('button', { name: '확인 후 장바구니에 담기' })).toBeDisabled();
  act(() => mock.options.onDraft(draft));
  fireEvent.click(screen.getByRole('button', { name: '확인 후 장바구니에 담기' }));
  expect(screen.getByRole('alert')).toHaveTextContent('메뉴');
  expect(add).not.toHaveBeenCalled();
});
