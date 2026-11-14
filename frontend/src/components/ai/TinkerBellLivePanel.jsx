import { useEffect, useId, useRef, useState } from 'react';
import { useAILiveSession } from '../../hooks/useAILiveSession';
import { liveText } from './tinkerbellLiveText';
import LiveCameraHelper from './LiveCameraHelper';

export default function TinkerBellLivePanel({
  storeId,
  lang = 'ko',
  largeFont = false,
  onClose,
  onFallback,
  onState,
  onStart,
}) {
  const L = liveText(lang),
    titleId = useId();
  const [consent, setConsent] = useState(false),
    [text, setText] = useState(''),
    [muted, setMuted] = useState(false);
  const live = useAILiveSession({ onFallback });
  const stopRef = useRef(live.stop),
    closeRef = useRef(null);
  useEffect(() => {
    stopRef.current = live.stop;
  });
  useEffect(() => {
    const previous = document.activeElement;
    closeRef.current?.focus();
    return () => {
      stopRef.current();
      previous?.focus?.();
    };
  }, []);
  useEffect(() => {
    onState?.(live.state);
  }, [live.state, onState]);
  const active = !['IDLE', 'FALLBACK', 'ERROR'].includes(live.state);
  const connected = active && live.state !== 'CONNECTING';
  const close = () => {
    live.stop();
    onClose();
  };
  const status =
    {
      CONNECTING: L.connecting,
      LISTENING: L.listening,
      INTERRUPTED: L.listening,
      SPEAKING: L.speaking,
      TOOL_CALLING: L.tools,
      THINKING: L.thinking,
    }[live.state] || L.idle;
  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      lang={lang}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          close();
        }
      }}
      className={`fixed right-4 top-60 z-[60] max-h-[calc(100dvh-16rem)] w-[calc(100vw-2rem)] max-w-sm overflow-y-auto rounded-2xl border border-amber-200 bg-white p-4 text-slate-900 shadow-xl pointer-events-auto ${largeFont ? 'text-lg' : 'text-base'}`}
    >
      <header className="flex items-center justify-between gap-3">
        <h2 id={titleId} className="font-bold">
          {L.title}
        </h2>
        <button
          ref={closeRef}
          type="button"
          onClick={close}
          className="min-h-11 px-3 rounded-xl border border-slate-300"
        >
          {L.close}
        </button>
      </header>
      <p className="my-3 break-words">{L.help}</p>
      <p role="status" className="font-semibold text-amber-800">
        {live.state === 'FALLBACK' || live.state === 'ERROR' ? L.fallback : status}
      </p>
      {!active && (
        <>
          <label className="my-4 flex gap-3 items-start">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 h-5 w-5 shrink-0"
            />
            <span>{L.consent}</span>
          </label>
          <button
            type="button"
            disabled={!consent || !Number.isSafeInteger(storeId) || storeId <= 0}
            onClick={() => {
              onStart?.();
              setMuted(false);
              void live.start({ storeId, purpose: 'customer', consent: true });
            }}
            className="min-h-11 w-full rounded-xl bg-amber-700 px-4 py-2 font-bold text-white disabled:opacity-50"
          >
            {L.start}
          </button>
        </>
      )}
      {active && (
        <>
          <div className="my-3 space-y-2 break-words" aria-live="polite" aria-atomic="true">
            <p>{live.transcript.input}</p>
            <p className="font-semibold">{live.transcript.output}</p>
          </div>
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
            {muted ? L.unmute : L.mute}
          </button>
          <form
            className="mt-3 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (connected && text.trim()) {
                live.sendText(text.trim());
                setText('');
              }
            }}
          >
            <input
              aria-label={L.message}
              maxLength={500}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={!connected}
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-300 px-3"
            />
            <button
              disabled={!connected || !text.trim()}
              className="min-h-11 rounded-xl bg-amber-700 px-3 text-white disabled:opacity-50"
            >
              {L.send}
            </button>
          </form>
        </>
      )}
      <p className="mt-3 text-sm break-words">{L.orderNotice}</p>
      {import.meta.env.VITE_AI_LIVE_CAMERA_UI_ENABLED==='true' && <LiveCameraHelper key={live.sessionId || 'none'} live={live}/>}
    </section>
  );
}
