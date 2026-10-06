import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Database, Upload, RefreshCw, Link2, Plus, Download, TrendingUp } from 'lucide-react';
import { integrationsAPI } from '../../api/integrations';
import { API_URL } from '../../api/client';
import './menu/menuWorkspace.css';

const LABELS = { qr: 'QR · 자체 주문', pos: 'POS', table_order: '테이블오더', point_device: '포인트기기', card_terminal: '카드단말기', baemin: '배달의민족', online_order: '온라인 주문' };
const TEMPLATE = 'event_id,record_id,kind,version,occurred_at,amount,status,currency,refund_amount,order_key,native_order_id,customer_reference,marketing_consent,consent_at,consent_source\n';
const unwrap = response => response?.data || response;
const errorMessage = error => error?.response?.data?.message || error?.response?.data?.error || error?.message || '요청을 처리하지 못했습니다.';
const won = value => `${Number(value || 0).toLocaleString('ko-KR')}원`;

export default function StoreIntegrationCenter() {
  const { storeId } = useParams();
  const [days, setDays] = useState(30), [tab, setTab] = useState('data');
  const [data, setData] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(false), [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ channel: 'pos', provider: '', name: '', method: 'csv' });
  const [selected, setSelected] = useState(''), [csv, setCsv] = useState(''), [preview, setPreview] = useState(null);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(unwrap(await integrationsAPI.overview(storeId, days))); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setLoading(false); }
  }, [storeId, days]);
  useEffect(() => { void load(); }, [load]);
  const connections = data?.connections || [];
  const source = connections.find(connection => connection.id === selected);
  const validPreview = preview && preview.id === selected && preview.csv === csv;
  const run = async action => {
    setBusy(true);
    try { await action(); }
    catch (failure) { toast.error(errorMessage(failure)); }
    finally { setBusy(false); }
  };
  const create = event => {
    event.preventDefault();
    void run(async () => {
      const connection = unwrap(await integrationsAPI.create(storeId, form));
      setSelected(connection.id); setForm({ ...form, name: '', provider: '' });
      await load(); toast.success('수집 연결이 등록되었습니다. 업체의 API가 자동 연결된 상태는 아닙니다.');
    });
  };
  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob(['\uFEFF' + TEMPLATE], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'wemarket-integration-template.csv'; link.click(); URL.revokeObjectURL(url);
  };
  const fileChange = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 1024 * 1024 || !/\.csv$/i.test(file.name)) { toast.error('UTF-8 CSV 파일을 1MB 이하로 선택하세요.'); return; }
    try { setCsv(await file.text()); setPreview(null); } catch { toast.error('파일을 읽을 수 없습니다.'); }
  };
  return <div className="menu-workspace max-w-7xl mx-auto px-3 sm:px-6 pb-24 space-y-5" style={{ color: 'var(--menu-text)' }}>
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-bold flex items-center gap-2"><Database size={24} />데이터 통합 센터</h1><p className="text-sm text-slate-400 mt-1">QR 주문에서 외부 거래 분석까지, 매장 데이터를 한곳에서 관리하세요.</p></div>
      <button className="menu-quiet rounded-xl px-4 inline-flex items-center gap-2" disabled={loading} onClick={load}><RefreshCw size={16} />새로고침</button>
    </header>
    <nav aria-label="통합 센터 탭" className="flex gap-2"><button className="menu-quiet rounded-xl px-4" aria-pressed={tab === 'data'} onClick={() => setTab('data')}>데이터 연결</button><button className="menu-quiet rounded-xl px-4" aria-pressed={tab === 'growth'} onClick={() => setTab('growth')}>성장 플랫폼 기획</button></nav>
    {error && <div role="alert" className="rounded-xl border border-rose-500/30 p-4 text-rose-400">{error} <button className="underline" onClick={load}>다시 조회</button></div>}
    {loading && !data && <p role="status">통합 데이터를 불러오는 중…</p>}
    {tab === 'growth' ? <GrowthRoadmap storeId={storeId} /> : <>
      <div className="menu-panel rounded-xl p-4 text-sm">업체별 API 연동은 승인·계정·별도 어댑터가 필요합니다. 지금은 공통 CSV 가져오기와 인증된 API 수집을 지원합니다. 수집 기록은 분석용이며 기존 주문·카드 승인·포인트·문자 발송을 실행하지 않습니다.</div>
      <div className="flex items-center gap-3"><label htmlFor="integration-days">조회 기간</label><select id="integration-days" className="menu-field rounded-lg p-2" value={days} onChange={event => setDays(Number(event.target.value))}><option value={7}>최근 7일</option><option value={30}>최근 30일</option><option value={90}>최근 90일</option></select></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[
        ['주문 기준 순매출', data ? won(data.total_revenue) : '—'], ['정산 대상 주문', data?.total_orders ?? '—'], ['수집 연결', data ? connections.length : '—'], ['기존 CRM 고객', data?.crm_customers ?? '—'],
      ].map(([label, value]) => <div key={label} className="menu-panel rounded-xl p-4"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p></div>)}</div>
      <section className="menu-panel rounded-xl p-4"><h2 className="font-semibold mb-3">채널별 주문 매출</h2>{data?.channels?.length ? <div className="divide-y divide-slate-500/20">{data.channels.map(row => <div key={row.channel} className="flex items-center justify-between gap-3 py-3"><span>{LABELS[row.channel] || row.channel}</span><span className="text-right"><strong>{won(row.revenue)}</strong><span className="block text-xs text-slate-400">{row.orders}건</span></span></div>)}</div> : <p className="text-sm text-slate-400">아직 수집된 주문 매출이 없습니다.</p>}<p className="text-xs text-slate-400 mt-3">결제·환불·포인트 기록을 매출에 중복 합산하지 않습니다. 동일 주문은 order_key 또는 native_order_id로 연결하세요.</p></section>
      <div className="grid lg:grid-cols-2 gap-4">
        <section className="menu-panel rounded-xl p-4 space-y-3"><h2 className="font-semibold flex items-center gap-2"><Link2 size={18} />수집 연결 등록</h2>
          <form onSubmit={create} className="grid gap-3">
            <label className="grid gap-1 text-sm">채널<select className="menu-field rounded-lg p-3" value={form.channel} onChange={event => setForm({ ...form, channel: event.target.value })}>{Object.entries(LABELS).filter(([key]) => key !== 'qr').map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label className="grid gap-1 text-sm">업체·서비스명<input required maxLength={80} className="menu-field rounded-lg p-3" value={form.provider} onChange={event => setForm({ ...form, provider: event.target.value })} placeholder="사용 중인 업체명" /></label>
            <label className="grid gap-1 text-sm">연결 이름<input required maxLength={80} className="menu-field rounded-lg p-3" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="예: 매장 POS 매출" /></label>
            <label className="grid gap-1 text-sm">수집 방식<select className="menu-field rounded-lg p-3" value={form.method} onChange={event => setForm({ ...form, method: event.target.value })}><option value="csv">CSV 가져오기</option><option value="api">API 키로 데이터 받기</option></select></label>
            <button className="menu-primary rounded-xl px-4 inline-flex justify-center items-center gap-2" disabled={busy || !data}><Plus size={16} />연결 등록</button>
          </form>
        </section>
        <section className="menu-panel rounded-xl p-4 space-y-3"><h2 className="font-semibold">등록된 연결</h2>{connections.length === 0 && <p className="text-sm text-slate-400">업체별 수집 연결을 먼저 등록하세요.</p>}{connections.map(connection => <div key={connection.id} className="border rounded-xl p-3" style={{ borderColor: 'var(--menu-border)' }}><div className="flex justify-between gap-2"><div><strong className="break-all">{connection.name}</strong><p className="text-xs text-slate-400 mt-1">{LABELS[connection.channel]} · {connection.provider} · {connection.method.toUpperCase()}</p></div><button className="menu-quiet rounded-lg px-3 text-xs" disabled={busy} onClick={() => void run(async () => { await integrationsAPI.toggle(storeId, connection.id, !connection.enabled); await load(); })}>{connection.enabled ? '수집 중지' : '수집 재개'}</button></div><p className="text-xs mt-2">{!connection.enabled ? '수집 중지됨' : connection.last_ingested_at ? '수집 이력 있음' : '수집 준비 · 업체 자동 연결 미설정'}</p><button className="menu-quiet rounded-lg px-3 mt-3 text-xs" onClick={() => { setSelected(connection.id); setPreview(null); }}>이 연결 선택</button></div>)}</section>
      </div>
      <section className="menu-panel rounded-xl p-4 space-y-4"><h2 className="font-semibold flex items-center gap-2"><Upload size={18} />데이터 수집</h2>
        <label className="grid gap-1 text-sm">수집 연결<select className="menu-field rounded-lg p-3" value={selected} disabled={busy} onChange={event => { setSelected(event.target.value); setPreview(null); }}><option value="">연결을 선택하세요</option>{connections.filter(connection => connection.enabled).map(connection => <option key={connection.id} value={connection.id}>{connection.name} · {connection.method.toUpperCase()}</option>)}</select></label>
        {source?.method === 'api' ? <div className="space-y-3 text-sm"><p>개발자 센터에서 integrations:write 스코프의 API 키를 발급하고, 업체 어댑터에서 아래 주소로 events를 전송하세요.</p><code className="block break-all rounded-lg menu-field p-3">POST {API_URL}/integrations/events/{source.id}</code><Link className="text-orange-400 underline" to={`/admin/stores/${storeId}/developer`}>API 키 관리 열기</Link><p className="text-xs text-slate-400">API 키는 업체 시스템의 서버에 보관하세요. CSV 수집 규격과 동일한 거래 필드를 사용합니다.</p></div> : <>
          <div className="flex flex-wrap gap-3 items-center"><button className="menu-quiet rounded-lg px-3 inline-flex items-center gap-2" onClick={downloadTemplate}><Download size={16} />CSV 양식 다운로드</button><label className="text-sm">CSV 파일<input type="file" accept=".csv,text/csv" className="block mt-1 max-w-full" disabled={busy || !source?.enabled} onChange={fileChange} /></label></div>
          <label className="block text-sm">CSV 내용<textarea aria-label="CSV 내용" className="menu-field rounded-xl p-3 w-full mt-1 font-mono text-xs" rows={7} value={csv} disabled={busy} onChange={event => { setCsv(event.target.value); setPreview(null); }} placeholder="양식에 맞춘 CSV를 붙여 넣거나 파일을 선택하세요." /></label>
          <p className="text-xs text-slate-400">최대 500행·1MB, 시간대가 있는 ISO 일시를 사용하세요. 카드번호·전화번호·비밀번호를 업로드하지 마세요. 수정은 version을 높이고, order의 환불 누계는 refund_amount에 기록합니다.</p>
          <div className="flex flex-wrap gap-3"><button className="menu-quiet rounded-xl px-4" disabled={busy || !csv || !source?.enabled || source.method !== 'csv'} onClick={() => void run(async () => { const result = unwrap(await integrationsAPI.preview(storeId, selected, csv)); setPreview({ result, id: selected, csv }); })}>가져오기 미리보기</button><button className="menu-primary rounded-xl px-4" disabled={busy || !validPreview || !source?.enabled} onClick={() => void run(async () => { const result = unwrap(await integrationsAPI.import(storeId, selected, csv)); setPreview(null); toast.success(`${result.accepted}건 수집 · 중복 ${result.duplicates}건 제외`); await load(); })}>확인한 데이터 수집</button></div>
          {validPreview && <div className="rounded-xl border border-orange-500/30 p-4 space-y-2"><h3 className="font-semibold">미리보기: {preview.result.count}건</h3><p className="text-xs">{Object.entries(preview.result.by_kind).map(([kind, count]) => `${kind} ${count}건`).join(' · ')}</p>{preview.result.warnings.map(warning => <p className="text-xs text-slate-400" key={warning}>{warning}</p>)}<div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr><th className="text-left py-2">거래 ID</th><th>종류</th><th>버전</th><th>금액</th><th>상태</th></tr></thead><tbody>{preview.result.samples.map((event, i) => <tr key={`${event.event_id}-${i}`}><td className="py-2">{event.record_id}</td><td className="text-center">{event.kind}</td><td className="text-center">{event.version}</td><td className="text-right">{event.amount.toLocaleString()}</td><td className="text-center">{event.status}</td></tr>)}</tbody></table></div></div>}
        </>}
      </section>
      <div className="text-xs text-slate-400 space-y-1">{data?.notes?.map(note => <p key={note}>{note}</p>)}</div>
    </>}
  </div>;
}

function GrowthRoadmap({ storeId }) {
  return <section className="menu-panel rounded-xl p-5 space-y-5"><h2 className="text-xl font-semibold flex items-center gap-2"><TrendingUp size={22} />매장성장 플랫폼 추가기능 기획</h2><p className="text-sm text-slate-400">아래 신규 통합 기능은 기획 단계입니다. 기존 고객·CRM·캠페인 기능으로 연결하며 메시지를 자동 발송하지 않습니다.</p>
    <div className="grid sm:grid-cols-2 gap-4">{[
      ['고객 데이터 연결', 'QR 고객 동의 → 확인된 연락처·회원 식별 → 채널 간 동일 고객 확인 → 고객별 방문·구매 이력. 가려진 배달 연락처로 자동 병합하지 않습니다.'],
      ['AI 성장 제안', '채널·메뉴별 매출, 재방문, 객단가를 근거로 실행 제안을 만듭니다. 데이터 부족·비용·기대 효과를 함께 표시하고 점주가 승인합니다.'],
      ['CRM 실행', '신규·단골·이탈 위험 고객을 구분하고 혜택·방문 주기를 설계합니다. 유효한 마케팅 동의와 수신 거부를 발송 직전에 확인합니다.'],
      ['마케팅 효과 측정', '캠페인 → 쿠폰·QR·주문 전환 → 순매출·재방문을 연결합니다. 대조군과 환불 반영으로 할인 비용 대비 효과를 확인합니다.'],
    ].map(([title, body]) => <article key={title} className="border rounded-xl p-4" style={{ borderColor: 'var(--menu-border)' }}><h3 className="font-semibold mb-2">{title}</h3><p className="text-sm text-slate-400 leading-relaxed">{body}</p></article>)}</div>
    <div className="flex flex-wrap gap-4"><Link className="text-orange-400 underline" to={`/admin/stores/${storeId}/customers`}>기존 고객 관리</Link><Link className="text-orange-400 underline" to={`/admin/stores/${storeId}/campaigns`}>기존 CRM · 캠페인</Link><Link className="text-orange-400 underline" to={`/admin/stores/${storeId}/recommendation-stats`}>AI 추천 분석</Link></div>
    <p className="text-sm text-slate-400">권장 순서: 데이터 정합성 → 고객 식별·동의 → 승인형 캠페인 → AI 제안·성과 검증. 외부 API 자동 동기화는 업체 계약과 접근 권한 확보 후 연결합니다.</p>
  </section>;
}
