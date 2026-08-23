import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import { boardAPI } from '../../api/board';
import { toast } from 'sonner';
import Icon from '../ui/Icon';
import { Check, Handshake, Inbox, Loader2, Plus, RefreshCw, Send, StoreIcon, X } from 'lucide-react';

const STATUS = {
  pending: { label: '대기중', cls: 'bg-amber-500/15 text-amber-400' },
  accepted: { label: '제휴중', cls: 'bg-emerald-500/15 text-emerald-400' },
  rejected: { label: '거절됨', cls: 'bg-rose-500/15 text-rose-400' },
};

/**
 * PartnershipManager (F7) — 매장 간 제휴/크로스 프로모션 관리.
 * 같은 지역 매장 탐색 → 제휴 신청, 받은 신청 수락/거절, 진행 현황 조회.
 */
export default function PartnershipManager() {
  const { storeId } = useParams();
  const [sent, setSent] = useState([]);
  const [received, setReceived] = useState([]);
  const [nearby, setNearby] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDiscover, setShowDiscover] = useState(false);
  const [busy, setBusy] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const p = await boardAPI.getPartnerships(storeId);
      const data = p?.data || p;
      setSent(data.sent || []);
      setReceived(data.received || []);
    } catch { toast.error('제휴 현황을 불러오지 못했습니다.'); }
    finally { setLoading(false); }
  }, [storeId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const loadNearby = async () => {
    setShowDiscover(true);
    try {
      const res = await boardAPI.getNearby({ store_id: storeId });
      const data = res?.data || res;
      // 이미 신청했거나 받은 매장은 후보에서 제외
      const linkedIds = new Set([
        ...sent.map(s => s.target_store?.id),
        ...received.map(r => r.requester_store?.id),
      ]);
      setNearby((data.stores || []).filter(s => !linkedIds.has(s.id)));
    } catch { toast.error('주변 매장을 불러오지 못했습니다.'); }
  };

  const request = async (targetId) => {
    setBusy(targetId);
    try {
      await boardAPI.requestPartnership({ store_id: Number(storeId), target_store_id: targetId, message: '제휴를 제안합니다.' });
      toast.success('제휴 신청을 보냈습니다.');
      setNearby(prev => prev.filter(s => s.id !== targetId));
      fetchAll();
    } catch (e) { toast.error(e?.response?.data?.error || '신청 실패'); }
    finally { setBusy(null); }
  };

  const respond = async (id, action) => {
    setBusy(id);
    try {
      await boardAPI.respondPartnership(id, action);
      toast.success(action === 'accept' ? '제휴를 수락했습니다.' : '제휴를 거절했습니다.');
      fetchAll();
    } catch { toast.error('처리 실패'); }
    finally { setBusy(null); }
  };

  const Badge = ({ status }) => {
    const s = STATUS[status] || STATUS.pending;
    return <span className={`shrink-0 px-2 py-1 rounded-lg text-[11px] font-black ${s.cls}`}>{s.label}</span>;
  };

  return (
    <div className="min-h-screen pb-20">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Link to="/admin" className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white">
            <Icon icon="ArrowLeft" size="md" className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2"><Handshake size={22} className="text-orange-400" /> 제휴 마케팅</h1>
            <p className="text-slate-400 text-sm">매장 간 제휴·크로스 프로모션 관리</p>
          </div>
        </div>
        <button onClick={fetchAll} className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-slate-300 hover:text-white">
          <RefreshCw className={'w-4 h-4 ' + (loading ? 'animate-spin' : '')} /><span className="hidden sm:inline font-medium">새로고침</span>
        </button>
      </div>

      {/* 받은 제휴 신청 */}
      <section className="bg-white/5 border border-white/8 rounded-2xl p-5 mb-5">
        <h2 className="text-lg font-black text-white flex items-center gap-2 mb-4"><Inbox size={18} className="text-blue-400" /> 받은 제휴 신청 <span className="text-xs text-slate-500">{received.length}</span></h2>
        {received.length === 0 ? <p className="text-sm text-slate-500 py-2">받은 제휴 신청이 없습니다.</p> : (
          <div className="space-y-2">
            {received.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-white/8">
                <div className="min-w-0">
                  <p className="font-bold text-white text-sm truncate">{r.requester_store?.name || '알 수 없는 매장'}</p>
                  <p className="text-[11px] text-slate-500">{r.requester_store?.business_type || ''} · {r.requester_store?.address || ''}</p>
                  {r.message && <p className="text-xs text-slate-400 mt-1">"{r.message}"</p>}
                </div>
                {r.status === 'pending' ? (
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => respond(r.id, 'accept')} disabled={busy === r.id} className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg" aria-label="수락"><Check size={15} /></button>
                    <button onClick={() => respond(r.id, 'reject')} disabled={busy === r.id} className="p-2 bg-rose-500/20 text-rose-400 rounded-lg" aria-label="거절"><X size={15} /></button>
                  </div>
                ) : <Badge status={r.status} />}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 보낸 제휴 신청 */}
      <section className="bg-white/5 border border-white/8 rounded-2xl p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black text-white flex items-center gap-2"><Send size={18} className="text-fuchsia-400" /> 보낸 제휴 신청 <span className="text-xs text-slate-500">{sent.length}</span></h2>
          <button onClick={loadNearby} className="flex items-center gap-1.5 px-3 py-2 bg-orange-500 text-white rounded-xl text-xs font-black"><Plus size={14} /> 제휴 매장 찾기</button>
        </div>
        {sent.length === 0 ? <p className="text-sm text-slate-500 py-2">보낸 제휴 신청이 없습니다.</p> : (
          <div className="space-y-2">
            {sent.map(s => (
              <div key={s.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-white/8">
                <div className="min-w-0">
                  <p className="font-bold text-white text-sm truncate">{s.target_store?.name || '알 수 없는 매장'}</p>
                  <p className="text-[11px] text-slate-500">{s.target_store?.business_type || ''} · {s.target_store?.address || ''}</p>
                </div>
                <Badge status={s.status} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 주변 매장 탐색 (제휴 신청) */}
      {showDiscover && (
        <section className="bg-white/5 border border-white/8 rounded-2xl p-5">
          <h2 className="text-lg font-black text-white flex items-center gap-2 mb-4"><StoreIcon size={18} className="text-teal-400" /> 같은 지역 매장</h2>
          {nearby.length === 0 ? <p className="text-sm text-slate-500 py-2">제휴 가능한 주변 매장이 없습니다.</p> : (
            <div className="space-y-2">
              {nearby.map(s => (
                <div key={s.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-white/8">
                  <div className="min-w-0">
                    <p className="font-bold text-white text-sm truncate">{s.name}</p>
                    <p className="text-[11px] text-slate-500">{s.business_type || ''}</p>
                  </div>
                  <button onClick={() => request(s.id)} disabled={busy === s.id} className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-white/10 text-white rounded-lg text-xs font-black disabled:opacity-40">
                    {busy === s.id ? <Loader2 size={13} className="animate-spin" /> : <Handshake size={13} />} 제휴 신청
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
