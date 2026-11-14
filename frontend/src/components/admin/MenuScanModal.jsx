import { useEffect, useRef, useState } from 'react';
import { aiAPI } from '../../api';
import { initialMenuDraft, prepareMenuPhoto } from '../../utils/menuPhotoDraft';
export default function MenuScanModal({ storeId, onClose, onDraft, onManual }) {
  const [photo, setPhoto] = useState(''),
    [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [suggestions, setSuggestions] = useState([]),
    [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    []
  );
  const file = async (event) => {
    const selected = event.target.files?.[0];
    if (!selected) return;
    const version = ++generation.current;
    setError('');
    setSuggestions([]);
    setPhoto('');
    setConsent(false);
    try {
      const prepared = await prepareMenuPhoto(selected);
      if (version === generation.current) setPhoto(prepared);
    } catch (e) {
      if (version === generation.current) setError(e.message);
    }
  };
  const analyze = async () => {
    if (!photo || !consent || busy) return;
    const version = ++generation.current;
    setBusy(true);
    setError('');
    try {
      const response = await aiAPI.scanMenuImage({
        store_id: Number(storeId),
        image: photo.split(',')[1],
        mimeType: 'image/jpeg',
        consent: true,
      });
      const data = response?.data || response;
      if (!data.success || !Array.isArray(data.suggestions))
        throw Error('사진 분석 초안을 확인하지 못했습니다.');
      if (version === generation.current) {
        setSuggestions(data.suggestions.map(initialMenuDraft));
        if (!data.suggestions.length)
          setError('메뉴를 읽지 못했습니다. 다른 사진이나 수동 등록을 이용해 주세요.');
      }
    } catch {
      if (version === generation.current)
        setError('사진 분석을 사용할 수 없습니다. 수동 메뉴 등록으로 이어가세요.');
    } finally {
      if (version === generation.current) setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-3">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="AI 메뉴 사진 초안"
        className="max-h-[92dvh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl bg-white p-4 text-slate-900"
      >
        <header className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-bold">AI 메뉴 사진 초안</h2>
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl border px-3">
            닫기
          </button>
        </header>
        <p>
          분석 결과는 등록 전 초안입니다. 가격·알레르기를 추측하지 않으며 다음 등록 화면에서
          사업자가 직접 확인·승인해야 합니다.
        </p>
        <label className="block">
          메뉴판·음식 사진
          <input
            aria-label="메뉴 사진 선택"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={busy}
            onChange={file}
            className="mt-2 block w-full min-w-0"
          />
        </label>
        <p className="text-sm">
          5MB 이하 사진을 1200px·512KB 이하 JPEG로 변환합니다. 사람·연락처·결제정보는 촬영하지
          마세요. 원본 사진은 저장하지 않습니다.
        </p>
        {photo && (
          <img
            src={photo}
            alt="분석 전 메뉴 사진"
            className="max-h-48 w-full rounded-xl object-contain"
          />
        )}
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            disabled={busy}
            className="mt-1 h-5 w-5 shrink-0"
          />
          <span>선택한 사진을 Google AI에 전송하는 데 동의합니다.</span>
        </label>
        <button
          type="button"
          onClick={analyze}
          disabled={!photo || !consent || busy}
          className="min-h-11 rounded-xl bg-orange-700 px-4 text-white disabled:opacity-50"
        >
          {busy ? '초안 분석 중' : '사진 분석 초안 만들기'}
        </button>
        {error && (
          <p role="alert" className="text-rose-800">
            {error}
          </p>
        )}
        <div className="space-y-3">
          {suggestions.map((draft, index) => (
            <article
              key={index}
              className="space-y-2 rounded-xl border border-orange-200 p-3 break-words"
            >
              <h3 className="font-bold">{draft.name} · 검토 전 초안</h3>
              <p>{draft.category_name}</p>
              <p>{draft.description}</p>
              <p>원재료 확인 항목: {draft.ingredient_review || '직접 확인 필요'}</p>
              {draft.marketing_copy && <p>홍보 문구 초안: {draft.marketing_copy}</p>}
              {draft.image_description && <p>이미지 설명 초안: {draft.image_description}</p>}
              <p className="font-semibold">가격·알레르기 미확정</p>
              <button
                type="button"
                disabled={!onDraft}
                onClick={() => onDraft(draft)}
                className="min-h-11 rounded-xl border border-orange-500 px-3"
              >
                이 초안을 등록 화면에서 검토
              </button>
            </article>
          ))}
        </div>
        {onManual && (
          <button type="button" onClick={onManual} className="min-h-11 rounded-xl border px-3">
            수동 메뉴 등록
          </button>
        )}
      </section>
    </div>
  );
}
