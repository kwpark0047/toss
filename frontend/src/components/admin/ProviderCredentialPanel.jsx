import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import api from '../../api/client';
import { KeyRound, RefreshCw } from 'lucide-react';
import './menu/menuWorkspace.css';
const FIELD_LABELS = { client_key: '클라이언트 키', secret_key: '시크릿 키', api_key: 'API 키', api_keys: 'API 키 (여러 개는 쉼표로 구분)', client_id: 'Client ID', client_secret: 'Client Secret' };
const STATUS = { untested: '미검증', verified: '공식 API 조회 확인', failed: '연결 검증 실패', adapter_required: '업체 어댑터 연결 필요' };
function ProviderCard({ row, base, reload }) {
  const [values, setValues] = useState({}), [enabled, setEnabled] = useState(row.enabled ?? true), [busy, setBusy] = useState(false);
  useEffect(() => { setValues({}); setEnabled(row.enabled ?? true); }, [row.updated_at, row.enabled]);
  const run = async action => {
    setBusy(true);
    try { await action(); } catch (error) { toast.error(error?.response?.data?.message || error?.message || '요청을 처리하지 못했습니다.'); }
    finally { setBusy(false); }
  };
  return <article className="menu-panel rounded-xl p-4 space-y-3">
    <h3 className="font-semibold">{row.label}</h3>
    <p className="text-sm text-slate-400">{row.configured ? '인증정보 설정됨' : '사용 가능한 인증정보 없음'} · {row.source === 'store' ? '이 매장 전용' : row.source === 'global' ? '최고관리자 공통 설정' : row.source === 'environment' ? '서버 환경변수' : '미등록'}</p>
    {row.read_only ? <p className="text-sm">전체 매장에 공통 적용됩니다. 최고관리자 계정에서 설정합니다.</p> : <>
      <p className="text-xs text-slate-400">{STATUS[row.last_test_status] || '미검증'}{row.last_test_at ? ` · ${new Date(row.last_test_at).toLocaleString('ko-KR')}` : ''}</p>
      {row.provider === 'tosspayments' && <p className="text-xs text-slate-400">이 키는 해당 사업장의 거래 대사용입니다. 주문 결제·구독 청구 키는 변경하지 않습니다.</p>}
      {row.provider === 'naver' && <p className="text-xs text-slate-400">공식 지역검색·플레이스 링크에 적용됩니다. 네이버 리뷰 원문 수집 API는 제공하지 않습니다.</p>}
      {!row.adapter && <p className="text-xs text-slate-400">키 등록은 보안 보관 단계입니다. 업체 어댑터 연결 완료 또는 자동 수집을 의미하지 않습니다. WeMarket 수집 키 발급은 개발자 센터에서 진행하세요.</p>}
      <form className="space-y-3" onSubmit={event => { event.preventDefault(); void run(async () => { await api.put(`${base}/${row.provider}`, { ...values, enabled }); setValues({}); await reload(); toast.success('인증정보가 암호화 저장되었습니다.'); }); }}>
        {row.fields.map(field => <label key={field} className="block text-sm">{FIELD_LABELS[field]}{row.masked?.[field] && <span className="block text-xs text-slate-400 mt-1">현재 값: {row.masked[field]}</span>}<input type="password" autoComplete="new-password" aria-label={`${row.label} ${FIELD_LABELS[field]}`} className="menu-field rounded-lg p-3 mt-1 w-full" maxLength={4096} value={values[field] || ''} disabled={busy} required={!row.registered} placeholder={row.registered ? '비워두면 기존 값 유지' : '발급받은 인증정보 입력'} onChange={event => setValues({ ...values, [field]: event.target.value })} /></label>)}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} disabled={busy} onChange={event => setEnabled(event.target.checked)} />사용 활성화</label>
        <div className="flex flex-wrap gap-2"><button className="menu-primary rounded-lg px-4" disabled={busy}>저장</button><button type="button" className="menu-quiet rounded-lg px-4" disabled={busy || !row.configured} onClick={() => void run(async () => { const response = await api.post(`${base}/${row.provider}/test`); const result = response?.data || response; result.status === 'verified' ? toast.success(result.message) : toast.info(result.message); await reload(); })}>연결 확인</button>{row.registered && <button type="button" className="menu-quiet rounded-lg px-4 text-rose-400" disabled={busy} onClick={() => { if (window.confirm('등록된 인증정보를 삭제할까요? 삭제 후 공통 설정 또는 서버 환경변수로 돌아갈 수 있습니다.')) void run(async () => { await api.delete(`${base}/${row.provider}`); setValues({}); await reload(); }); }}>삭제</button>}</div>
      </form>
    </>}
  </article>;
}
export default function ProviderCredentialPanel({ storeId, global = false }) {
  const base = `/provider-credentials/${global ? 'global' : `stores/${storeId}`}`;
  const [rows, setRows] = useState([]), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true); setError('');
    try { const response = await api.get(base); const result = response?.data || response; setRows(Array.isArray(result) ? result : []); }
    catch (failure) { setError(failure?.response?.data?.message || failure?.message || '인증정보를 불러오지 못했습니다.'); }
    finally { setLoading(false); }
  }, [base]);
  useEffect(() => { void reload(); }, [reload]);
  return <section className="menu-workspace space-y-4" style={{ color: 'var(--menu-text)' }}>
    <header className="flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-bold flex items-center gap-2"><KeyRound size={22} />{global ? '전체 매장 공통 API 설정' : '사업자 매장 API 인증정보'}</h2><p className="text-sm text-slate-400 mt-2">{global ? '서울 공공데이터·기상청 설정은 모든 매장에서 공유하며 최고관리자만 변경합니다.' : '매장 소유주만 등록·변경할 수 있으며 다른 사업자의 인증정보와 분리됩니다.'}</p></div><button className="menu-quiet rounded-lg px-3 flex items-center gap-2" disabled={loading} onClick={reload}><RefreshCw size={16} />설정 새로고침</button></header>
    <p className="text-xs text-slate-400">저장한 키 원문은 다시 조회할 수 없습니다. 암호화 보관 후 마지막 네 자리만 표시합니다. 변경은 서버 재시작 없이 다음 API 요청에 반영됩니다.</p>
    {error && <p role="alert" className="text-rose-400">{error}</p>}{loading && <p role="status">설정을 불러오는 중…</p>}
    <div className="grid gap-4 lg:grid-cols-2">{rows.map(row => <ProviderCard key={`${base}:${row.provider}`} row={row} base={base} reload={reload} />)}</div>
  </section>;
}
