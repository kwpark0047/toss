import { useEffect, useId, useRef, useState } from 'react';
import { useAILiveSession } from '../../hooks/useAILiveSession';
import { liveDraftToCart } from '../../utils/live/liveOrderDraft';
import { liveText } from '../ai/tinkerbellLiveText';
import { formatWon } from '../../utils/format';

export default function LiveVoiceOrderAssistant({
  storeId,
  menuItems = [],
  canOrder = true,
  lang = 'ko',
  onAddDraft,
  onFallback,
  onActivate,
}) {
  const [open, setOpen] = useState(false),
    [consent, setConsent] = useState(false),
    [draft, setDraft] = useState(null),
    [text, setText] = useState(''),
    [error, setError] = useState(''),
    [muted, setMuted] = useState(false);
  const title = useId(),
    submitting = useRef(false),
    closeRef = useRef(null);
  const live = useAILiveSession({
    onDraft: setDraft,
    onFallback: () => {
      setDraft(null);
      setOpen(false);
      onFallback?.();
    },
  });
  const stopRef = useRef(live.stop);
  useEffect(() => {
    stopRef.current = live.stop;
  });
  useEffect(() => {
    if (!canOrder) {
      stopRef.current();
    }
  }, [canOrder]);
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);
  const close = () => {
    live.stop();
    setDraft(null);
    setOpen(false);
  };
  const confirm = () => {
    if (submitting.current || !canOrder || !draft || !onAddDraft || text.trim()) return;
    try {
      const lines = liveDraftToCart(draft, menuItems);
      submitting.current = true;
      const applied = live.confirmDraft(draft.draftId, () => onAddDraft(lines));
      if (applied) close();
      else {
        setDraft(null);
        setError('초안이 갱신되었습니다. 최신 주문 내용을 다시 확인해 주세요.');
      }
    } catch (e) {
      setDraft(null);
      setError(e.message);
    } finally {
      submitting.current = false;
    }
  };
  const L = liveText(lang),
    active = !['IDLE', 'FALLBACK', 'ERROR'].includes(live.state),
    connected = active && live.state !== 'CONNECTING';
  return (
    <>
      <button
        type="button"
        disabled={!canOrder}
        className="mt-3 min-h-11 w-full rounded-xl border border-orange-400 bg-white px-4 py-2 font-bold text-orange-900 disabled:opacity-50"
        onClick={() => {
          onActivate?.();
          setDraft(null);
          setError('');
          setConsent(false);
          setOpen(true);
        }}
      >
        Live로 주문하기
      </button>
      {open && (
        <section
          role="dialog"
          aria-modal="false"
          aria-labelledby={title}
          onKeyDown={(e) => {
            if (e.key === 'Escape') close();
          }}
          className="fixed inset-x-4 top-20 z-[75] mx-auto max-h-[calc(100dvh-6rem)] max-w-xl overflow-y-auto rounded-2xl border border-orange-200 bg-white p-4 text-base text-slate-900 shadow-xl"
        >
          <header className="flex items-center justify-between gap-2">
            <h2 id={title} className="font-black">
              Live 주문 내용 확인
            </h2>
            <button
              ref={closeRef}
              type="button"
              onClick={close}
              className="min-h-11 rounded-xl border px-3"
            >
              닫기
            </button>
          </header>
          <p className="my-3">
            대화 중 주문을 수정할 수 있어요. 아래 최신 초안을 확인한 뒤 직접 승인해 주세요. 결제는
            기존 장바구니에서 진행합니다.
          </p>
          <p role="status">
            {!canOrder
              ? '현재 주문할 수 없습니다.'
              : live.state === 'CONNECTING'
                ? L.connecting
                : active
                  ? L.listening
                  : L.idle}
          </p>
          {!active && (
            <>
              <label className="my-3 flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 shrink-0"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>{L.consent}</span>
              </label>
              <button
                type="button"
                disabled={!consent || !canOrder}
                className="min-h-11 rounded-xl bg-orange-700 px-4 text-white disabled:opacity-50"
                onClick={() => {
                  setDraft(null);
                  setError('');
                  setMuted(false);
                  void live.start({ storeId: Number(storeId), purpose: 'customer', consent: true });
                }}
              >
                대화 시작
              </button>
            </>
          )}
          {active && (
            <>
              <div aria-live="polite" className="my-3 break-words">
                <p>{live.transcript.input}</p>
                <p>{live.transcript.output}</p>
              </div>
              <button
                type="button"
                aria-pressed={muted}
                disabled={!connected}
                className="min-h-11 rounded-xl border px-3"
                onClick={() => {
                  live.setMuted(!muted);
                  setMuted(!muted);
                }}
              >
                {muted ? '음소거 해제' : '음소거'}
              </button>
              <form
                className="my-3 flex flex-wrap gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (connected && text.trim()) {
                    setDraft(null);
                    live.sendText(text.trim());
                    setText('');
                  }
                }}
              >
                <input
                  aria-label="Live 주문 문장"
                  className="min-h-11 min-w-0 flex-1 rounded-xl border px-3"
                  maxLength={500}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setDraft(null);
                    live.invalidateDraft();
                  }}
                />
                <button
                  disabled={!connected || !text.trim() || !canOrder}
                  className="min-h-11 rounded-xl bg-orange-700 px-4 text-white disabled:opacity-50"
                >
                  수정 요청 보내기
                </button>
              </form>
            </>
          )}
          {error && (
            <p role="alert" className="my-3 text-rose-800">
              {error}
            </p>
          )}
          {draft && (
            <div className="my-3 rounded-xl bg-orange-50 p-3">
              <h3 className="font-bold">서버 검증 주문 초안</h3>
              <ul className="space-y-2 break-words">
                {draft.items?.map((line, i) => (
                  <li key={i}>
                    {line.name} × {line.quantity} · {formatWon(line.line_total)}
                    <p>{line.selected_options?.map((o) => o.choiceName).join(' · ')}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-3 font-bold">합계 {formatWon(draft.total)}</p>
              {draft.needs_clarification && (
                <p role="alert">{draft.clarifications?.join(' ')} 확인 전에는 담기지 않습니다.</p>
              )}
            </div>
          )}
          <button
            type="button"
          disabled={!canOrder || !draft || draft.needs_clarification || !onAddDraft || !!text.trim()}
            onClick={confirm}
            className="mt-3 min-h-12 w-full rounded-xl bg-orange-700 px-4 font-bold text-white disabled:opacity-50"
          >
            확인 후 장바구니에 담기
          </button>
          <button
            type="button"
            className="mt-2 min-h-11 w-full rounded-xl border px-4"
            onClick={() => {
              close();
              onFallback?.();
            }}
          >
            기존 음성·직접 입력으로 전환
          </button>
        </section>
      )}
    </>
  );
}
