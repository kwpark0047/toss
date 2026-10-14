import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { businessSupportAPI as api } from '../../api/businessSupport';
import './menu/menuWorkspace.css';
const unwrap = (r) => r?.data || r;
const labels = {
  draft: '검토 전',
  sent: '사업자 확인 대기',
  changes_requested: '수정 요청',
  deferred: '보류',
  rejected: '거절',
  approved: '승인됨',
  running: '실행 중',
  stopped: '중단됨',
  completed: '평가 완료',
};
const actions = {
  send: '사업자에게 전달',
  assign: '내가 담당',
  approve: '승인',
  changes: '수정 요청',
  defer: '보류',
  reject: '거절',
  execute: 'QR 노출 시작',
  stop: 'QR 노출 중단',
  resolve: '확인·조치 완료',
};
const stamp = (value) =>
  value ? new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '확인 불가';
const failure = (e) =>
  e?.response?.data?.message ||
  e?.response?.data?.error ||
  '지원 정보를 불러오지 못했습니다. 다시 조회해 주세요.';
export default function BusinessSupportCenter() {
  const { storeId } = useParams();
  const platform = !storeId;
  const [items, setItems] = useState([]),
    [summary, setSummary] = useState(null),
    [enrollment, setEnrollment] = useState(null),
    [consent, setConsent] = useState(false);
  const [detail, setDetail] = useState(null),
    [note, setNote] = useState(''),
    [cursor, setCursor] = useState(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [confirmExecution, setConfirmExecution] = useState(false),
    [evaluation, setEvaluation] = useState(null);
  const sequence = useRef(0),
    operations = useRef(new Map()),
    executionDialog = useRef(null);
  useEffect(() => {
    if (confirmExecution) executionDialog.current?.showModal();
    else if (executionDialog.current?.open) executionDialog.current.close();
  }, [confirmExecution]);
  const load = useCallback(
    async (next = null) => {
      const request = ++sequence.current;
      setBusy(true);
      setError('');
      try {
        const [page, info] = await Promise.all([
          api.list(storeId, next),
          platform ? api.overview() : api.enrollment(storeId),
        ]);
        if (request !== sequence.current) return;
        const data = unwrap(page);
        setItems((old) => (next ? [...old, ...data.items] : data.items));
        setCursor(data.next_cursor);
        setLoaded(true);
        if (platform) setSummary(unwrap(info));
        else {
          setEnrollment(unwrap(info));
          setConsent(unwrap(info).enabled);
        }
      } catch (e) {
        if (request === sequence.current) setError(failure(e));
      } finally {
        if (request === sequence.current) setBusy(false);
      }
    },
    [storeId, platform]
  );
  useEffect(() => {
    setItems([]);
    setDetail(null);
    setSummary(null);
    setEnrollment(null);
    setLoaded(false);
    setEvaluation(null);
    setConfirmExecution(false);
    load();
    return () => {
      sequence.current++;
    };
  }, [load]);
  const perform = async (work) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
    } catch (e) {
      setError(failure(e));
    } finally {
      setBusy(false);
    }
  };
  const open = (row) =>
    perform(async () => {
      setDetail(unwrap(await api.detail(row.store_id, row.id)));
      setNote('');
      setEvaluation(null);
    });
  const mutate = (event) =>
    perform(async () => {
      const key = JSON.stringify([detail.store_id, detail.id, event, note]);
      if (!operations.current.has(key)) operations.current.set(key, crypto.randomUUID());
      await api.transition(detail.store_id, detail.id, event, operations.current.get(key), note);
      operations.current.delete(key);
      setDetail(unwrap(await api.detail(detail.store_id, detail.id)));
      await load();
    });
  const owner = !!enrollment?.can_consent;
  const options = detail
    ? platform
      ? [
          'assign',
          ...(['draft', 'changes_requested', 'deferred'].includes(detail.status) ? ['send'] : []),
        ]
      : owner
        ? [
            ...(['sent'].includes(detail.status)
              ? [...(detail.action_id ? ['approve'] : ['resolve']), 'changes', 'defer', 'reject']
              : []),
            ...(detail.status === 'approved' ? ['execute', 'changes', 'defer', 'reject'] : []),
            ...(detail.status === 'deferred' ? ['reject'] : []),
            ...(detail.status === 'running' ? ['stop'] : []),
          ]
        : []
    : [];
  return (
    <section className="menu-workspace space-y-5 p-4 sm:p-6" aria-label="AI 사업자 지원">
      <header className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {platform ? 'AI 사업자 지원센터' : '위마켓 지원 제안함'}
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            근거 확인 → 지원 검토 → 사업자 승인 → 실행 → 성과 확인
          </p>
        </div>
        <button className="menu-quiet px-4 rounded-lg" disabled={busy} onClick={() => load()}>
          다시 조회
        </button>
      </header>
      {error && (
        <p role="alert" className="border border-rose-500/40 rounded-lg p-4">
          {error}
        </p>
      )}
      {busy && <p role="status">처리 중입니다…</p>}
      {notice && <p role="status">{notice}</p>}
      {platform && summary && (
        <section className="menu-panel p-4 rounded-xl" aria-label="지원 요약">
          <h2 className="font-semibold">지원 대상 {summary.enrolled_stores}개 매장</h2>
          <p className="text-sm text-slate-400">
            실제 소유자가 지원에 동의한 운영 매장입니다. 공개 수집 매장 전체를 분석하지 않습니다.
          </p>
          <div className="flex flex-wrap gap-5 mt-3">
            {summary.cases.map((c) => (
              <span key={c.status}>
                {labels[c.status] || c.status} <strong>{c.count}</strong>
              </span>
            ))}
          </div>
          {summary.jobs.some((j) => j.status === 'dead') && (
            <p className="mt-3 text-amber-400">
              반복 실패한 분석 작업이 있습니다. 매장별 재분석으로 복구하세요.
            </p>
          )}
          {summary.failed_jobs?.map((job) => (
            <div key={job.store_id} className="flex flex-wrap items-center gap-3 mt-3">
              <span>
                {job.name} · 분석 실패 {job.attempts}회
              </span>
              <button
                className="menu-quiet px-3 rounded-lg"
                disabled={busy}
                onClick={() =>
                  perform(async () => {
                    await api.rescan(job.store_id);
                    await load();
                  })
                }
              >
                이 매장 분석 재시도
              </button>
            </div>
          ))}
        </section>
      )}
      {!platform && enrollment && (
        <section className="menu-panel p-4 rounded-xl space-y-3" aria-label="지원 동의">
          <h2 className="font-semibold">매장 성장 지원 참여</h2>
          <label className="flex gap-2 items-start">
            <input
              type="checkbox"
              checked={consent}
              disabled={!owner || busy}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>매장 데이터 분석과 최고관리자 지원 검토에 동의합니다.</span>
          </label>
          <p className="text-sm text-slate-400">
            동의해도 할인·문자·발주·결제는 자동 실행되지 않습니다. 철회 후에도 진행 중인 QR 노출은
            직접 중단할 수 있습니다.
          </p>
          {owner && (
            <button
              className="menu-quiet px-4 rounded-lg"
              disabled={busy}
              onClick={() =>
                perform(async () => {
                  await api.enroll(storeId, consent);
                  await load();
                })
              }
            >
              동의 설정 저장
            </button>
          )}
          <button
            className="menu-quiet px-4 rounded-lg ml-2"
            disabled={busy || !enrollment.enabled}
            onClick={() =>
              perform(async () => {
                await api.rescan(storeId);
                setNotice(
                  '재분석이 대기열에 등록됐습니다. 작업 프로세스가 처리한 뒤 다시 조회하세요.'
                );
              })
            }
          >
            재분석 요청
          </button>
          <Link className="underline ml-3" to={`/admin/stores/${storeId}/ai-manager`}>
            오늘의 매장 매니저
          </Link>
        </section>
      )}
      <section className="menu-panel rounded-xl p-4">
        <h2 className="font-semibold mb-3">지원 목록</h2>
        {loaded && !items.length && <p className="text-slate-400">아직 지원 제안이 없습니다.</p>}
        <div className="overflow-x-auto">
          {!!items.length && (
            <table className="w-full text-sm text-left">
              <caption className="sr-only">매장별 지원 상태와 근거 기준 시각</caption>
              <thead>
                <tr>
                  <th className="p-3">매장 / 우선순위</th>
                  <th>상태</th>
                  <th>자료 품질</th>
                  <th>기준 시각</th>
                  <th>담당자</th>
                  <th>상세</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-t border-slate-700/40">
                    <td className="p-3">
                      {row.store_name}
                      <span className="block text-slate-400">우선순위 {row.priority}</span>
                    </td>
                    <td>{labels[row.status]}</td>
                    <td>{row.evidence?.quality === 'insufficient' ? '자료 부족' : '관측 자료'}</td>
                    <td>{stamp(row.evidence?.as_of)}</td>
                    <td>{row.assignee_id ? `담당 #${row.assignee_id}` : '미배정'}</td>
                    <td>
                      <button disabled={busy} className="underline p-3" onClick={() => open(row)}>
                        근거·지원안
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {cursor && (
          <button disabled={busy} className="menu-quiet px-4 mt-3" onClick={() => load(cursor)}>
            다음 지원 목록
          </button>
        )}
      </section>
      {detail && (
        <section className="menu-panel rounded-xl p-4 space-y-4" aria-label="지원 상세">
          <div className="flex justify-between">
            <h2 className="font-semibold">
              매장 #{detail.store_id} 지원 근거 · {labels[detail.status]}
            </h2>
            <button onClick={() => setDetail(null)}>상세 닫기</button>
          </div>
          <p className="text-sm">
            기준 {stamp(detail.evidence?.as_of)} · 규칙 {detail.evidence?.version} · Snapshot{' '}
            {detail.snapshot_id}
          </p>
          {Date.now() - new Date(detail.evidence?.as_of).getTime() > 86400000 && (
            <p className="text-amber-400">근거가 오래되었습니다. 최신 분석 후 승인해 주세요.</p>
          )}
          {detail.evidence?.insights?.map((i, n) => (
            <article key={n}>
              <h3 className="font-semibold">{i.title}</h3>
              <p className="text-sm text-slate-400">{i.detail}</p>
            </article>
          ))}
          <p>
            미접수 {detail.evidence?.facts?.pending_orders || 0}건 · 최장 대기{' '}
            {Math.floor(detail.evidence?.facts?.oldest_minutes || 0)}분
          </p>
          {detail.evidence?.current && (
            <p>
              자체 수금 순매출{' '}
              {Number(detail.evidence.current.revenue || 0).toLocaleString('ko-KR')}원 · 같은 요일
              비교{' '}
              {detail.evidence.comparison?.revenue == null
                ? '자료 부족'
                : `${Math.round(detail.evidence.comparison.revenue).toLocaleString('ko-KR')}원`}
            </p>
          )}
          {!!detail.evidence?.facts?.stock_alerts?.length && (
            <ul className="text-sm">
              {detail.evidence.facts.stock_alerts.map((p) => (
                <li key={p.id}>
                  {p.name} · 등록 재고 {p.stock_quantity ?? '미등록'} ·{' '}
                  {p.is_sold_out ? '품절 설정' : '재고 확인 필요'} · 갱신 {stamp(p.updated_at)}
                </li>
              ))}
            </ul>
          )}
          <details>
            <summary className="cursor-pointer">분석 기간·데이터 출처</summary>
            <pre className="text-xs whitespace-pre-wrap break-all mt-2">
              {JSON.stringify(detail.evidence?.provenance, null, 2)}
            </pre>
          </details>
          {detail.evidence?.action_source && (
            <details>
              <summary>QR 실행안의 원본 근거</summary>
              <p className="text-sm mt-2">
                Snapshot {detail.evidence.action_source.snapshot_id} · 기준{' '}
                {stamp(detail.evidence.action_source.as_of)}
              </p>
              <pre className="text-xs whitespace-pre-wrap break-all">
                {JSON.stringify(detail.evidence.action_source.provenance, null, 2)}
              </pre>
            </details>
          )}
          <p className="text-sm text-slate-400">
            {detail.evidence?.action?.title && (
              <strong className="block">
                {detail.evidence.action.title} · 메뉴 #{detail.evidence.action.product_id}
              </strong>
            )}
            {detail.evidence?.action?.reason && (
              <span className="block">제안 이유: {detail.evidence.action.reason}</span>
            )}
            {detail.action_id
              ? '실행 범위: 7일 QR 추천 메뉴 노출. 할인·SMS·발주·금융 변경 없음.'
              : '실행 가능한 QR 제안이 없습니다. 자료 확인과 수정 요청만 가능합니다.'}{' '}
            원가·외부 입금 자료가 없으면 이익·정산 효과를 확정하지 않습니다.
          </p>
          {detail.note && <p className="border-l-2 border-orange-500 pl-3">{detail.note}</p>}
          <label className="block text-sm">
            지원 설명 / 수정 요청
            <textarea
              className="block w-full bg-transparent border border-slate-500 rounded-lg p-3 mt-2"
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="개인정보 없이 확인할 내용과 지원 이유를 입력하세요."
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {options.map((event) => (
              <button
                className="menu-quiet px-4 rounded-lg"
                disabled={busy}
                key={event}
                onClick={() => (event === 'execute' ? setConfirmExecution(true) : mutate(event))}
              >
                {actions[event]}
              </button>
            ))}
            {detail.action_id && ['running', 'completed'].includes(detail.status) && (
              <button
                disabled={busy}
                className="menu-quiet px-4"
                onClick={() =>
                  perform(async () =>
                    setEvaluation(unwrap(await api.evaluate(detail.store_id, detail.id)))
                  )
                }
              >
                성과 확인
              </button>
            )}
          </div>
          {evaluation && <p role="status">{evaluation.message} 인과 효과로 확정하지 않습니다.</p>}
          <h3 className="font-semibold">지원 이력</h3>
          <ol className="text-sm space-y-2">
            {detail.events?.map((e, i) => (
              <li key={i}>
                {stamp(e.created_at)} · {actions[e.event] || e.event} · {labels[e.to_status]}
                {e.note && ` · ${e.note}`}
              </li>
            ))}
          </ol>
        </section>
      )}
      <dialog
        ref={executionDialog}
        onCancel={() => setConfirmExecution(false)}
        aria-labelledby="support-execution-title"
        aria-describedby="support-execution-description"
        className="menu-panel rounded-xl p-6 max-w-md text-inherit"
      >
        <h2 id="support-execution-title" className="font-semibold text-lg">
          QR 추천 노출을 시작할까요?
        </h2>
        <p id="support-execution-description" className="mt-3">
          승인한 메뉴를 고객 QR 화면에 7일간 노출합니다. 할인·문자·발주·결제는 실행하지 않습니다.
          지원 제안함에서 중단할 수 있습니다.
        </p>
        <div className="flex gap-3 mt-5">
          <button
            autoFocus
            className="menu-quiet rounded-lg px-4"
            onClick={() => setConfirmExecution(false)}
          >
            취소
          </button>
          <button
            className="menu-primary rounded-lg px-4"
            disabled={busy}
            onClick={() => {
              setConfirmExecution(false);
              mutate('execute');
            }}
          >
            7일 QR 노출 시작
          </button>
        </div>
      </dialog>
    </section>
  );
}
