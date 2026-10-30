import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Loader2, Mic, MicOff, RotateCcw, ShoppingBag, Square, X } from 'lucide-react';
import { formatWon } from '../../utils/format';
import { aiOrderAPI } from '../../api/aiOrder';
import { normalizeMenuOptionGroups } from '../../utils/menuOptionGroups';

const SPEECH_LOCALES = {
  ko: 'ko-KR',
  en: 'en-US',
  ja: 'ja-JP',
  zh: 'zh-CN',
};

const getSpeechRecognition = () => {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

export default function VoiceOrderAssistant({
  storeId,
  menuItems = [],
  lang = 'ko',
  canOrder = true,
  onAddDraft,
  onAssistantSpeak,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);
  const SpeechRecognition = getSpeechRecognition();

  useEffect(() => () => {
    try { recognitionRef.current?.abort(); } catch { /* 이미 종료된 인식 세션 */ }
  }, []);

  const startListening = () => {
    if (!SpeechRecognition) {
      setError('이 브라우저는 음성 인식을 지원하지 않습니다. 아래 입력란에 주문을 적어 주세요.');
      return;
    }
    if (!window.isSecureContext && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      setError('마이크는 보안 연결(HTTPS)에서 사용할 수 있습니다. 주문 내용을 직접 입력해 주세요.');
      return;
    }

    setError('');
    setDraft(null);
    setTranscript('');
    setInterimTranscript('');
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = SPEECH_LOCALES[lang] || 'ko-KR';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event) => {
        let finalText = '';
        let interimText = '';
        for (let index = 0; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (!result?.[0]?.transcript) continue;
          if (result.isFinal) finalText += result[0].transcript;
          else interimText += result[0].transcript;
        }
        setTranscript(finalText);
        setInterimTranscript(interimText);
      };
      recognition.onerror = (event) => {
        const messages = {
          'not-allowed': '마이크 권한이 꺼져 있습니다. 브라우저 설정에서 허용하거나 주문을 직접 입력해 주세요.',
          'service-not-allowed': '음성 인식 서비스를 사용할 수 없습니다. 주문을 직접 입력해 주세요.',
          'no-speech': '음성이 들리지 않았습니다. 마이크에 가까이 말씀해 주세요.',
          network: '음성 인식 연결에 실패했습니다. 주문 내용을 직접 입력해 주세요.',
        };
        setError(messages[event.error] || '음성을 인식하지 못했습니다. 다시 말하거나 직접 입력해 주세요.');
      };
      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
      };
      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
      setError('마이크를 시작하지 못했습니다. 브라우저 권한을 확인하거나 직접 입력해 주세요.');
    }
  };

  const stopListening = () => {
    try { recognitionRef.current?.stop(); } catch { setIsListening(false); }
  };

  const parseOrder = async () => {
    const cleanTranscript = transcript.trim();
    if (!cleanTranscript || isParsing) return;
    setIsParsing(true);
    setError('');
    setDraft(null);
    try {
      const response = await aiOrderAPI.parsePublic(storeId, cleanTranscript);
      if (response?.success === false) throw new Error(response.error || '주문을 분석하지 못했습니다.');
      const parsed = response?.items ? response : response?.data;
      if (!Array.isArray(parsed?.items) || parsed.items.length === 0) {
        throw new Error('주문 메뉴를 찾지 못했어요. 메뉴 이름을 넣어 다시 말씀해 주세요.');
      }
      setDraft(parsed);
      const lineSummary = parsed.items.map((line) => {
        const options = (line.selected_options || []).map((option) => option.choiceName).filter(Boolean).join(', ');
        return `${line.name} ${line.quantity}개${options ? `, ${options}` : ''}`;
      }).join(', ');
      const clarification = parsed.needs_clarification && parsed.clarifications?.length
        ? ` 확인이 필요한 내용이 있어요. ${parsed.clarifications.join(' ')}`
        : ' 이 내용으로 장바구니에 담을까요?';
      onAssistantSpeak?.(`주문 내용을 확인할게요. ${lineSummary}.${clarification}`);
    } catch (requestError) {
      const message = requestError?.response?.data?.error || requestError?.message || '주문 분석에 실패했습니다.';
      setError(message);
      onAssistantSpeak?.(message);
    } finally {
      setIsParsing(false);
    }
  };

  const confirmDraft = () => {
    if (!draft || draft.needs_clarification || !canOrder) return;
    const safeLines = draft.items.map((line) => {
      const menuItem = menuItems.find((item) => Number(item.id) === Number(line.product_id));
      const selectedOptions = line.selected_options || [];
      const priceIsCurrent = menuItem && Number(menuItem.price) === Number(line.base_price);
      const currentGroups = menuItem ? normalizeMenuOptionGroups(menuItem.options) : [];
      const optionsAreCurrent = selectedOptions.every((selected) => {
        const group = currentGroups.find((candidate) => String(candidate.id) === String(selected.groupId));
        const choice = group?.choices.find((candidate) => String(candidate.id) === String(selected.choiceId));
        return choice
          && choice.name === selected.choiceName
          && Number(choice.price_adjustment) === Number(selected.priceAdjustment);
      });
      return menuItem && priceIsCurrent && optionsAreCurrent ? {
        item: menuItem,
        quantity: line.quantity,
        selectedOptions,
        unitPrice: line.unit_price,
      } : null;
    });
    if (safeLines.some((line) => !line)) {
      setDraft(null);
      setError('메뉴가 변경되어 주문을 다시 확인해야 합니다. 문장을 다시 분석해 주세요.');
      return;
    }
    onAddDraft?.(safeLines);
    onAssistantSpeak?.('확인했어요. 주문 초안을 장바구니에 담았습니다. 장바구니에서 내용을 확인해 주세요.');
    setIsOpen(false);
    setDraft(null);
    setTranscript('');
  };

  const openAndStartListening = () => {
    setIsOpen(true);
    setError('');
    // Start recognition in the same user gesture so mobile browsers retain
    // microphone activation and customers do not need a second tap.
    startListening();
  };

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-2 sm:px-6 lg:px-8" aria-label="음성 주문">
      <button
        type="button"
        onClick={openAndStartListening}
        disabled={!canOrder}
        aria-describedby={!canOrder ? 'voice-order-unavailable' : undefined}
        className="group flex min-h-[68px] w-full items-center gap-3 rounded-2xl border border-orange-400/50 bg-gradient-to-r from-orange-500 via-orange-600 to-rose-600 px-4 py-3 text-left text-sm font-extrabold text-white shadow-lg shadow-orange-600/25 transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-75 disabled:hover:translate-y-0 disabled:hover:shadow-lg"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/20 ring-1 ring-white/30 transition group-hover:scale-105" aria-hidden="true">
          <Mic size={21} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-black leading-tight">말로 메뉴 주문하기</span>
          <span id={!canOrder ? 'voice-order-unavailable' : undefined} className="mt-1 block text-xs font-semibold text-white/90">
            {canOrder ? '한 번 누르면 바로 듣기 시작해요' : '매장 영업시간에 이용할 수 있어요.'}
          </span>
        </span>
        <span className="shrink-0 rounded-full border border-white/30 bg-white/15 px-3 py-1.5 text-xs font-extrabold text-white">
          {canOrder ? '한 번 눌러 주문' : '영업시간 확인'}
        </span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isListening) setIsOpen(false); }}>
          <div className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900 sm:rounded-3xl" role="dialog" aria-modal="true" aria-labelledby="voice-order-title">
            <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <div>
                <h2 id="voice-order-title" className="text-lg font-black text-slate-900 dark:text-white">팅커벨 음성 주문</h2>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  {isListening ? '지금 바로 말씀해 주세요. 잠시 멈추면 자동으로 듣기를 마쳐요.' : '주문 문장을 고친 뒤 내용을 확인하고 직접 승인해 주세요.'}
                </p>
              </div>
              <button type="button" onClick={() => { stopListening(); setIsOpen(false); }} aria-label="닫기" className="rounded-full p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 dark:text-slate-300 dark:hover:bg-slate-800"><X size={20} /></button>
            </header>

            <div className="space-y-4 overflow-y-auto p-5">
              <div className="flex flex-wrap gap-2">
                {!isListening ? (
                  <button type="button" onClick={startListening} disabled={isParsing} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2">
                    <Mic size={17} /> {SpeechRecognition ? '말하기 시작' : '마이크 미지원'}
                  </button>
                ) : (
                  <button type="button" onClick={stopListening} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2">
                    <Square size={15} fill="currentColor" /> 말하기 완료
                  </button>
                )}
                {transcript && !isListening && <button type="button" onClick={() => { setTranscript(''); setDraft(null); setError(''); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"><RotateCcw size={16} /> 다시 입력</button>}
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-800 dark:text-slate-100">주문 문장 <span className="font-medium text-slate-500">인식한 문장을 고치거나 직접 입력할 수 있어요</span></span>
                <textarea
                  value={transcript}
                  onChange={(event) => { setTranscript(event.target.value.slice(0, 500)); setDraft(null); }}
                  rows={3}
                  maxLength={500}
                  placeholder="예: 아이스 아메리카노 두 잔, 라지 사이즈로 주세요"
                  className="w-full resize-y rounded-2xl border border-slate-300 bg-white p-3 text-base leading-relaxed text-slate-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:ring-orange-900"
                />
                {isListening && <span className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-rose-600 dark:text-rose-300"><span className="h-2 w-2 animate-pulse rounded-full bg-rose-600" /> 듣고 있어요… {interimTranscript}</span>}
                <span className="mt-1 block text-right text-xs text-slate-500">{transcript.length}/500</span>
              </label>

              <p className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                브라우저 음성 인식 기능으로 음성을 문장으로 변환합니다. 음성이 브라우저 제공자에게, 변환된 주문 문장이 AI 처리 제공자에게 전송될 수 있습니다. 위마켓 서버는 녹음 파일을 저장하지 않습니다.
              </p>

              {error && <p role="alert" className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"><AlertCircle size={18} className="shrink-0" />{error}</p>}

              {draft && (
                <div className="rounded-2xl border border-orange-200 bg-orange-50/70 p-4 dark:border-orange-900 dark:bg-orange-950/20">
                  <h3 className="font-black text-slate-900 dark:text-white">주문 내용 확인</h3>
                  <ul className="mt-3 space-y-3">
                    {draft.items.map((line, index) => (
                      <li key={`${line.product_id}-${index}`} className="flex justify-between gap-4 border-b border-orange-100 pb-2 text-sm last:border-0 dark:border-orange-900/50">
                        <span className="text-slate-800 dark:text-slate-100"><strong>{line.name}</strong> · {line.quantity}개{line.selected_options?.length > 0 && <span className="mt-1 block text-xs text-slate-600 dark:text-slate-300">{line.selected_options.map((option) => option.choiceName).join(' · ')}</span>}</span>
                        <strong className="shrink-0 text-slate-900 dark:text-white">{formatWon(line.line_total)}</strong>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex justify-between border-t border-orange-200 pt-3 font-black text-slate-900 dark:border-orange-900 dark:text-white"><span>합계</span><span>{formatWon(draft.total)}</span></div>
                  {draft.needs_clarification && <div role="alert" className="mt-3 space-y-1 rounded-xl bg-amber-100 p-3 text-sm font-semibold text-amber-950 dark:bg-amber-950/60 dark:text-amber-100">{draft.clarifications?.map((message) => <p key={message}>{message}</p>)}<p className="pt-1 text-xs font-medium">문장을 고쳐 다시 분석해 주세요. 확인 전에는 장바구니에 담기지 않습니다.</p></div>}
                </div>
              )}
            </div>

            <footer className="flex flex-col gap-2 border-t border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:flex-row">
              <button type="button" onClick={parseOrder} disabled={!transcript.trim() || isListening || isParsing} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 font-bold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-white dark:hover:bg-slate-800">
                {isParsing ? <><Loader2 size={18} className="animate-spin" /> 주문 분석 중</> : <><RotateCcw size={17} /> 주문 내용 확인</>}
              </button>
              <button type="button" onClick={confirmDraft} disabled={!draft || draft.needs_clarification || !canOrder || isParsing} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3 font-extrabold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2">
                {draft?.needs_clarification ? <><MicOff size={18} /> 확인이 더 필요해요</> : <><ShoppingBag size={18} /><Check size={16} /> 장바구니에 담기</>}
              </button>
            </footer>
          </div>
        </div>
      )}
    </section>
  );
}
