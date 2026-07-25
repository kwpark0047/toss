import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { developerAPI } from '../../api/developer';
import { storesAPI } from '../../api/stores';
import {
  ArrowLeft, RefreshCw, KeyRound, Webhook, Plus, Trash2, Copy, Check,
  CircleCheck, CircleX, Clock, Loader2, Code2, ScrollText
} from 'lucide-react';
import { toast } from 'sonner';
import Skeleton from '../common/Skeleton';

const EVENT_TYPES = ['order.created', 'order.updated', 'order.completed'];

const fmtDateTime = (s) => {
  if (!s) return '-';
  const d = new Date(s);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// 발급 직후 1회만 노출되는 시크릿을 복사 UI로 표시
function SecretReveal({ label, value, onDone }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-4">
      <p className="text-xs font-black text-amber-400 mb-2">⚠️ {label} — 지금만 표시됩니다. 안전하게 보관하세요.</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs text-amber-200 bg-black/30 rounded-lg px-3 py-2 break-all font-mono">{value}</code>
        <button onClick={copy} className="shrink-0 px-3 py-2 bg-amber-500 text-white rounded-lg text-xs font-black flex items-center gap-1">
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? '복사됨' : '복사'}
        </button>
      </div>
      <button onClick={onDone} className="mt-2 text-[11px] text-slate-400 hover:text-white">확인했습니다 (숨기기)</button>
    </div>
  );
}

const STATUS_BADGE = {
  success: { cls: 'bg-emerald-500/15 text-emerald-400', icon: CircleCheck, label: '성공' },
  pending: { cls: 'bg-amber-500/15 text-amber-400', icon: Clock, label: '대기/재시도' },
  failed: { cls: 'bg-rose-500/15 text-rose-400', icon: CircleX, label: '실패' },
};

export default function DeveloperConsole() {
  const { storeId } = useParams();
  const [store, setStore] = useState(null);
  const [keys, setKeys] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reveal, setReveal] = useState(null); // { label, value }

  // 새 키/웹훅 폼
  const [keyName, setKeyName] = useState('');
  const [keyScopes, setKeyScopes] = useState(['read']);
  const [whUrl, setWhUrl] = useState('');
  const [whEvents, setWhEvents] = useState(['*']);
  const [busy, setBusy] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, k, w, d] = await Promise.all([
        storesAPI.getById(storeId),
        developerAPI.listApiKeys(storeId),
        developerAPI.listWebhooks(storeId),
        developerAPI.listDeliveries(storeId),
      ]);
      setStore(s?.data || s);
      setKeys(k?.data || k || []);
      setWebhooks(w?.data || w || []);
      setDeliveries(d?.data || d || []);
    } catch {
      toast.error('개발자 콘솔 데이터를 불러오지 못했습니다.');
    } finally { setLoading(false); }
  }, [storeId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const createKey = async () => {
    if (!keyName.trim()) return toast.warning('키 이름을 입력하세요.');
    setBusy(true);
    try {
      const res = await developerAPI.createApiKey(storeId, { name: keyName.trim(), scopes: keyScopes });
      const d = res?.data || res;
      setReveal({ label: 'API 키', value: d.key });
      setKeyName('');
      fetchAll();
    } catch (e) { toast.error(e?.response?.data?.error || 'API 키 발급 실패'); }
    finally { setBusy(false); }
  };

  const revokeKey = async (id) => {
    if (!window.confirm('이 API 키를 폐기할까요? 연동된 외부 시스템이 즉시 차단됩니다.')) return;
    try { await developerAPI.revokeApiKey(storeId, id); toast.success('폐기되었습니다.'); fetchAll(); }
    catch { toast.error('폐기 실패'); }
  };

  const createWebhook = async () => {
    if (!/^https?:\/\//.test(whUrl)) return toast.warning('https URL을 입력하세요.');
    setBusy(true);
    try {
      const res = await developerAPI.createWebhook(storeId, { url: whUrl.trim(), events: whEvents });
      const d = res?.data || res;
      setReveal({ label: '웹훅 서명 시크릿', value: d.secret });
      setWhUrl('');
      fetchAll();
    } catch (e) { toast.error(e?.response?.data?.error || '웹훅 등록 실패'); }
    finally { setBusy(false); }
  };

  const deleteWebhook = async (id) => {
    if (!window.confirm('이 웹훅을 삭제할까요?')) return;
    try { await developerAPI.deleteWebhook(storeId, id); toast.success('삭제되었습니다.'); fetchAll(); }
    catch { toast.error('삭제 실패'); }
  };

  const toggleScope = (s) => setKeyScopes(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const toggleEvent = (e) => setWhEvents(prev => {
    if (e === '*') return ['*'];
    const next = prev.filter(x => x !== '*');
    return next.includes(e) ? next.filter(x => x !== e) : [...next, e];
  });

  const deliveryStats = {
    total: deliveries.length,
    success: deliveries.filter(d => d.status === 'success').length,
    failed: deliveries.filter(d => d.status === 'failed').length,
  };

  return (
    <div className="min-h-screen pb-20">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Link to="/admin" className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2"><Code2 size={22} className="text-indigo-400" /> 개발자 콘솔</h1>
            <p className="text-slate-400 text-sm">{store?.name} · Open Commerce Hub API</p>
          </div>
        </div>
        <button onClick={fetchAll} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-slate-300 hover:bg-white/10 hover:text-white transition-all">
          <RefreshCw className={'w-4 h-4 ' + (loading ? 'animate-spin' : '')} /><span className="hidden sm:inline font-medium">새로고침</span>
        </button>
      </div>

      {reveal && <SecretReveal label={reveal.label} value={reveal.value} onDone={() => setReveal(null)} />}

      {/* ── API 키 ── */}
      <section className="bg-white/5 border border-white/8 rounded-2xl p-5 mb-5">
        <h2 className="text-lg font-black text-white flex items-center gap-2 mb-4"><KeyRound size={18} className="text-orange-400" /> API 키</h2>
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <input value={keyName} onChange={e => setKeyName(e.target.value)} aria-label="API 키 이름"
            placeholder="키 이름 (예: POS 연동)"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-orange-500/50" />
          <div className="flex items-center gap-2">
            {['read', 'write'].map(s => (
              <button key={s} onClick={() => toggleScope(s)}
                className={`px-3 py-2.5 rounded-xl text-xs font-black border ${keyScopes.includes(s) ? 'bg-orange-500/20 border-orange-500/40 text-orange-300' : 'bg-white/5 border-white/10 text-slate-500'}`}>{s}</button>
            ))}
            <button onClick={createKey} disabled={busy} className="px-4 py-2.5 bg-orange-500 text-white rounded-xl text-xs font-black flex items-center gap-1 disabled:opacity-40">
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} 발급
            </button>
          </div>
        </div>
        {keys.length === 0 ? <p className="text-sm text-slate-500 py-2">발급된 키가 없습니다.</p> : (
          <div className="space-y-2">
            {keys.map(k => (
              <div key={k.id} className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${k.revoked ? 'bg-white/5 border-white/5 opacity-50' : 'bg-white/5 border-white/8'}`}>
                <div className="min-w-0">
                  <p className="font-bold text-white text-sm truncate">{k.name} {k.revoked && <span className="text-[10px] text-rose-400">(폐기됨)</span>}</p>
                  <p className="text-[11px] text-slate-500 font-mono">{k.key_prefix}··· · {k.scopes} · {k.last_used_at ? '최근사용 ' + fmtDateTime(k.last_used_at) : '미사용'}</p>
                </div>
                {!k.revoked && (
                  <button onClick={() => revokeKey(k.id)} aria-label="API 키 폐기" className="shrink-0 p-2 text-slate-500 hover:text-rose-400"><Trash2 size={15} /></button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 웹훅 엔드포인트 ── */}
      <section className="bg-white/5 border border-white/8 rounded-2xl p-5 mb-5">
        <h2 className="text-lg font-black text-white flex items-center gap-2 mb-4"><Webhook size={18} className="text-blue-400" /> 웹훅 엔드포인트</h2>
        <div className="space-y-2 mb-3">
          <input value={whUrl} onChange={e => setWhUrl(e.target.value)} aria-label="웹훅 URL"
            placeholder="https://example.com/webhook"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500/50" />
          <div className="flex flex-wrap items-center gap-2">
            {['*', ...EVENT_TYPES].map(e => (
              <button key={e} onClick={() => toggleEvent(e)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border ${whEvents.includes(e) ? 'bg-blue-500/20 border-blue-500/40 text-blue-300' : 'bg-white/5 border-white/10 text-slate-500'}`}>{e === '*' ? '전체' : e}</button>
            ))}
            <button onClick={createWebhook} disabled={busy} className="ml-auto px-4 py-2 bg-blue-500 text-white rounded-xl text-xs font-black flex items-center gap-1 disabled:opacity-40">
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} 등록
            </button>
          </div>
        </div>
        {webhooks.length === 0 ? <p className="text-sm text-slate-500 py-2">등록된 웹훅이 없습니다.</p> : (
          <div className="space-y-2">
            {webhooks.map(w => (
              <div key={w.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-white/8">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-white truncate">{w.url}</p>
                  <p className="text-[11px] text-slate-500">{w.events} · {w.active ? '활성' : '비활성'}</p>
                </div>
                <button onClick={() => deleteWebhook(w.id)} aria-label="웹훅 삭제" className="shrink-0 p-2 text-slate-500 hover:text-rose-400"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 전송 로그 ── */}
      <section className="bg-white/5 border border-white/8 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-white flex items-center gap-2"><ScrollText size={18} className="text-fuchsia-400" /> 웹훅 전송 로그</h2>
          <div className="flex items-center gap-3 text-xs font-bold">
            <span className="text-slate-400">총 {deliveryStats.total}</span>
            <span className="text-emerald-400">성공 {deliveryStats.success}</span>
            <span className="text-rose-400">실패 {deliveryStats.failed}</span>
          </div>
        </div>
        {loading ? (
          <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} dark className="h-12 rounded-xl" />)}</div>
        ) : deliveries.length === 0 ? <p className="text-sm text-slate-500 py-2">전송 이력이 없습니다.</p> : (
          <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
            {deliveries.map(d => {
              const b = STATUS_BADGE[d.status] || STATUS_BADGE.pending;
              const Icon = b.icon;
              return (
                <div key={d.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 border border-white/5 text-xs">
                  <span className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg font-black ${b.cls}`}><Icon size={12} /> {b.label}</span>
                  <span className="font-mono text-slate-300 truncate flex-1">{d.event_type}</span>
                  <span className="shrink-0 text-slate-500">{d.attempts}회{d.response_status ? ` · ${d.response_status}` : ''}</span>
                  <span className="shrink-0 text-slate-600">{fmtDateTime(d.created_at)}</span>
                </div>
              );
            })}
          </div>
        )}
        {deliveries.some(d => d.last_error) && (
          <p className="mt-3 text-[11px] text-slate-500">실패 사유는 최근 오류가 있는 건에 기록됩니다. 재시도는 지수 백오프로 자동 진행됩니다(최대 5회).</p>
        )}
      </section>
    </div>
  );
}
