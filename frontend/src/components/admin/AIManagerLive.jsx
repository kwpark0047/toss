import { useId, useState } from 'react';
import { useAILiveSession } from '../../hooks/useAILiveSession';
import { formatWon } from '../../utils/format';

export default function AIManagerLive({ storeId, canExecute = false, onReviewActions }) {
  const [consent, setConsent] = useState(false),
    [text, setText] = useState(''),
    [fallback, setFallback] = useState(false),
    [muted, setMuted] = useState(false),
    [facts, setFacts] = useState({});
  const id = useId();
  const live = useAILiveSession({
    onFallback: () => {
      setFallback(true);
      setFacts({});
    },
    onManagerFacts: (event) => setFacts((previous) => ({ ...previous, [event.kind]: event.data })),
  });
  const active = !['IDLE', 'FALLBACK', 'ERROR'].includes(live.state),
    connected = active && live.state !== 'CONNECTING';
  const start = () => {
    setFallback(false);
    setMuted(false);
    setFacts({});
    void live.start({ storeId: Number(storeId), purpose: 'manager', consent: true });
  };
  return (
    <section
      aria-labelledby={id}
      className="rounded-2xl border border-orange-200 bg-white p-4 text-slate-900 space-y-3"
    >
      <h2 id={id} className="text-lg font-bold">
        AI Manager Live 상담
      </h2>
      <p>
        이 매장의 실제 집계와 기존 제안을 음성으로 확인합니다. AI는 업무를 승인하거나 실행하지
        않습니다.
      </p>
      <p className="text-sm">
        {canExecute
          ? '업무 변경은 아래 제안에서 소유주 승인 후 실행해 주세요.'
          : '조회·상담만 가능합니다. 업무 변경에는 소유주 승인이 필요합니다.'}
      </p>
      <p role="status">
        {fallback
          ? 'Live 상담을 사용할 수 없습니다. 기존 텍스트 상담으로 이어가세요.'
          : live.state === 'CONNECTING'
            ? '연결 중…'
            : active
              ? '매장 상담 중'
              : '대기 중'}
      </p>
      {!active && (
        <>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 h-5 w-5 shrink-0"
            />
            <span>
              마이크 음성과 조회된 매장 집계를 Google AI로 전송하는 데 동의합니다. WEMARKET에는 원본
              음성·대화를 저장하지 않습니다.
            </span>
          </label>
          <button
            type="button"
            disabled={!consent || !Number.isSafeInteger(Number(storeId)) || Number(storeId) <= 0}
            onClick={start}
            className="min-h-11 rounded-xl bg-orange-700 px-4 text-white disabled:opacity-50"
          >
            Live 상담 시작
          </button>
        </>
      )}
      {active && (
        <>
          <div aria-live="polite" className="space-y-2 break-words">
            <p>{live.transcript.input}</p>
            <p className="font-semibold">{live.transcript.output}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!connected}
              aria-pressed={muted}
              onClick={() => {
                live.setMuted(!muted);
                setMuted(!muted);
              }}
              className="min-h-11 rounded-xl border border-slate-300 px-3"
            >
              {muted ? '음소거 해제' : '음소거'}
            </button>
            <button
              type="button"
              onClick={() => {
                live.stop();
                setFacts({});
              }}
              className="min-h-11 rounded-xl border border-slate-300 px-3"
            >
              상담 종료
            </button>
          </div>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (connected && text.trim()) {
                live.sendText(text.trim());
                setText('');
              }
            }}
          >
            <input
              aria-label="Live 매장 상담 질문"
              maxLength={500}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={!connected}
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 px-3"
            />
            <button
              disabled={!connected || !text.trim()}
              className="min-h-11 rounded-xl bg-orange-700 px-4 text-white disabled:opacity-50"
            >
              질문 보내기
            </button>
          </form>
        </>
      )}
      {facts.get_manager_briefing && (
        <aside
          aria-label="서버 조회 집계"
          className="rounded-xl bg-orange-50 p-3 text-sm break-words"
        >
          <p className="font-bold">서버 조회 집계</p>
          <p>
            완료 시간대 순매출 {formatWon(facts.get_manager_briefing.current?.revenue)} · 결제 주문{' '}
            {facts.get_manager_briefing.current?.orders ?? '—'}건
          </p>
          <p>{facts.get_manager_briefing.basis}</p>
        </aside>
      )}
      {Array.isArray(facts.get_manager_actions) && (
        <aside
          aria-label="서버 조회 제안"
          className="rounded-xl bg-slate-50 p-3 text-sm break-words"
        >
          <p className="font-bold">기존 제안 {facts.get_manager_actions.length}건</p>
          <ul>
            {facts.get_manager_actions.map((action) => (
              <li key={action.id}>
                {action.title} · {action.status}
              </li>
            ))}
          </ul>
        </aside>
      )}
      <button
        type="button"
        onClick={() => {
          live.stop();
          onReviewActions?.();
        }}
        className="min-h-11 rounded-xl border border-slate-300 px-4"
      >
        기존 제안·승인 화면 보기
      </button>
    </section>
  );
}
