import { useEffect, useRef, useState } from 'react';
import { marketingDraftAPI } from '@/api/marketingDrafts';

export default function AIMarketingDrafts({ storeId }) {
  // Keyed child discards drafts, consent and approval on a store change.
  return <DraftEditor key={storeId} storeId={storeId} />;
}
function DraftEditor({ storeId }) {
  const [catalogue, setCatalogue] = useState(null);
  const [ids, setIds] = useState([]);
  const [channel, setChannel] = useState('instagram');
  const [tone, setTone] = useState('friendly');
  const [useAI, setUseAI] = useState(false);
  const [consent, setConsent] = useState(false);
  const [draft, setDraft] = useState(null);
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const version = useRef(0);
  const pending = useRef(false);
  useEffect(() => {
    let active = true;
    const requestVersion = version;
    marketingDraftAPI
      .catalogue(storeId)
      .then((r) => {
        if (active) setCatalogue(r.data);
      })
      .catch(() => {
        if (active) setMessage('매장 운영 권한과 메뉴 연결을 확인해 주세요.');
      });
    return () => {
      active = false;
      requestVersion.current++;
    };
  }, [storeId]);
  const invalidate = () => {
    version.current++;
    setDraft(null);
    setApproved(false);
    setMessage('');
  };
  async function generate() {
    if (pending.current || !ids.length || (useAI && !consent)) return;
    pending.current = true;
    setBusy(true);
    setApproved(false);
    setDraft(null);
    setMessage('');
    const current = ++version.current;
    try {
      const r = await marketingDraftAPI.generate({
        store_id: Number(storeId),
        product_ids: ids,
        channel,
        tone,
        use_ai: useAI,
        consent,
      });
      if (current !== version.current) return;
      if (r.data?.draft_only !== true || r.data.store_id !== Number(storeId)) throw Error('scope');
      setDraft(r.data);
      setContent(r.data.content);
      setTags(r.data.hashtags.join(' '));
    } catch {
      if (current === version.current)
        setMessage(
          '초안 생성이 불가능합니다. 권한을 확인하거나 AI 생성을 해제해 기본 초안을 이용해 주세요.'
        );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function copy() {
    if (!approved || !content.trim() || !draft) return;
    try {
      await navigator.clipboard.writeText(
        [content.trim(), tags.trim()].filter(Boolean).join('\n\n')
      );
      setMessage('검토한 초안을 복사했습니다. 게시 전 최종 내용을 확인해 주세요.');
    } catch {
      setMessage('복사할 수 없습니다. 문구를 직접 선택해 복사해 주세요.');
    }
  }
  const field =
    'w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900';
  return (
    <section className="min-w-0 rounded-2xl border bg-white p-4 sm:p-6 text-gray-900 space-y-4">
      <div>
        <h2 className="text-lg font-bold">AI 마케팅 초안</h2>
        <p className="text-sm text-gray-600 mt-1">
          홍보 문구·SNS 콘텐츠를 검토하고 수정하세요. 자동 게시·발송·저장은 하지 않습니다.
        </p>
      </div>
      <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
        사업자 검토용 초안입니다. 가격·할인·기간·원산지·알레르기·효능·후기 표현은 사실과 대조하세요.
        고객 개인정보는 입력하지 마세요.
      </p>
      <fieldset disabled={busy} className="min-w-0 space-y-3">
        <legend className="font-semibold mb-2">
          {catalogue?.store?.name || '매장 메뉴'} · 메뉴 1~5개 선택
        </legend>
        <div className="max-h-52 overflow-y-auto space-y-2">
          {catalogue?.products?.map((p) => (
            <label key={p.id} className="flex gap-2 items-start text-sm">
              <input
                type="checkbox"
                checked={ids.includes(p.id)}
                disabled={!ids.includes(p.id) && ids.length >= 5}
                onChange={() => {
                  invalidate();
                  setIds((old) =>
                    old.includes(p.id) ? old.filter((id) => id !== p.id) : [...old, p.id]
                  );
                }}
              />
              <span className="break-all">
                {p.name} · {p.price.toLocaleString()}원
              </span>
            </label>
          ))}
        </div>
        {catalogue?.products?.length === 0 && (
          <p>판매 중인 메뉴가 없습니다. 메뉴 관리에서 먼저 등록해 주세요.</p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            콘텐츠 채널
            <select
              className={field}
              value={channel}
              onChange={(e) => {
                invalidate();
                setChannel(e.target.value);
              }}
            >
              <option value="instagram">인스타그램</option>
              <option value="naver">네이버 소식</option>
              <option value="poster">매장 홍보 문구</option>
            </select>
          </label>
          <label>
            말투
            <select
              className={field}
              value={tone}
              onChange={(e) => {
                invalidate();
                setTone(e.target.value);
              }}
            >
              <option value="friendly">친근하게</option>
              <option value="formal">정중하게</option>
            </select>
          </label>
        </div>
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={useAI}
            onChange={(e) => {
              invalidate();
              setUseAI(e.target.checked);
              setConsent(false);
            }}
          />
          AI 생성 사용 (관리자 활성화 시)
        </label>
        {useAI && (
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => {
                invalidate();
                setConsent(e.target.checked);
              }}
            />
            매장명과 선택 메뉴를 AI에 전송하는 데 동의합니다.
          </label>
        )}
        <p className="text-xs text-gray-500">
          기본 초안은 외부 AI 호출 없이 만듭니다. AI 생성은 서버의 기능·비용 허용 설정이 모두 켜져야
          합니다.
        </p>
        <button
          type="button"
          disabled={busy || !ids.length || (useAI && !consent)}
          onClick={generate}
          className="rounded-xl bg-indigo-700 px-4 py-2 text-white disabled:opacity-50"
        >
          {busy ? '초안 생성 중…' : '초안 만들기'}
        </button>
      </fieldset>
      {draft && (
        <div className="space-y-3 border-t pt-4">
          <p className="text-sm font-semibold">
            {draft.source === 'gemini' ? 'AI 생성' : '기본'} 초안 · 미게시
          </p>
          <p className="text-xs text-gray-600">
            참고 메뉴:{' '}
            {draft.facts.products.map((p) => `${p.name} ${p.price.toLocaleString()}원`).join(' / ')}
          </p>
          <label className="block">
            홍보 문구 초안
            <textarea
              rows={7}
              maxLength={1500}
              className={field}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setApproved(false);
                setMessage('');
              }}
            />
          </label>
          <label className="block">
            해시태그 초안
            <input
              maxLength={300}
              className={field}
              value={tags}
              onChange={(e) => {
                setTags(e.target.value);
                setApproved(false);
                setMessage('');
              }}
            />
          </label>
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={approved}
              onChange={(e) => setApproved(e.target.checked)}
            />
            가격·혜택·표현 및 개인정보 여부를 확인하고 초안 전체를 검토했습니다.
          </label>
          <button
            type="button"
            disabled={!approved || !content.trim()}
            onClick={copy}
            className="rounded-xl border border-indigo-700 px-4 py-2 text-indigo-800 disabled:opacity-50"
          >
            검토한 초안 복사
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="text-sm text-gray-700 break-words">
          {message}
        </p>
      )}
    </section>
  );
}
