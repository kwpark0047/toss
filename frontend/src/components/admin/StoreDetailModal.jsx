import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, ShoppingBag, Coins, Users, Store, Power, Gift, Loader2, ExternalLink } from 'lucide-react';
import { adminAPI } from '../../api/admin';
import { bizLabel } from '../../utils/businessType';
import MiniBarChart from './MiniBarChart';

const won = (n) => `₩${Number(n || 0).toLocaleString('ko-KR')}`;
const num = (n) => Number(n || 0).toLocaleString('ko-KR');

/**
 * StoreDetailModal — 슈퍼관리자 매장 상세 드릴인.
 * 일별 매출/주문 미니차트 · 최근 주문 · 포인트 수동 지급/차감 · 활성 토글.
 */
export default function StoreDetailModal({ storeId, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState('sales'); // sales | orders
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  // 포인트 폼
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminAPI.storeDetail(storeId, 14);
      const d = r?.data || r;
      setData(d);
      setActive(!!d.store?.is_active);
    } catch { setData(null); }
    finally { setLoading(false); }
  }, [storeId]);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async () => {
    setBusy(true); setMsg('');
    try {
      const next = !active;
      await adminAPI.toggleStoreActive(storeId, next);
      setActive(next);
      setMsg(next ? '매장을 활성화했습니다.' : '매장을 비활성화했습니다.');
      onChanged?.();
    } catch (e) { setMsg(e?.response?.data?.error || '변경 실패'); }
    finally { setBusy(false); }
  };

  const submitPoints = async (sign) => {
    const amt = Math.abs(parseInt(amount) || 0) * sign;
    if (!phone.trim() || !amt) { setMsg('전화번호와 포인트를 입력하세요.'); return; }
    setBusy(true); setMsg('');
    try {
      const r = await adminAPI.grantPoints(storeId, { phone: phone.trim(), amount: amt, reason: reason.trim() });
      setMsg((r?.data?.message) || r?.message || '처리 완료');
      setAmount(''); setReason('');
    } catch (e) { setMsg(e?.response?.data?.error || '처리 실패'); }
    finally { setBusy(false); }
  };

  const daily = data?.daily || [];
  const chartData = daily.map(d => ({ label: d.date.slice(5), value: metric === 'sales' ? d.sales : d.orders }));

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto bg-slate-900 border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl text-white">
        {/* 헤더 */}
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-white/10 px-6 py-4 flex items-center justify-between z-10">
          <div className="min-w-0">
            <h3 className="text-lg font-black truncate flex items-center gap-2">
              <Store size={18} className="text-orange-400" aria-hidden="true" /> {data?.store?.name || '매장 상세'}
            </h3>
            {data?.store && <p className="text-[11px] text-slate-500 truncate">{data.store.address} · {data.store.business_type ? bizLabel(data.store.business_type) : '-'}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="p-2 rounded-xl hover:bg-white/10 text-slate-400 shrink-0"><X size={18} aria-hidden="true" /></button>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="skeleton-dark h-16 rounded-xl" />)}</div>
        ) : !data ? (
          <div className="p-10 text-center text-slate-500">불러오지 못했습니다.</div>
        ) : (
          <div className="p-6 space-y-6">
            {/* 요약 */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: '주문', value: num(data.summary.totalOrders), icon: ShoppingBag },
                { label: '매출', value: won(data.summary.totalSales), icon: Coins },
                { label: '고객', value: num(data.summary.customers), icon: Users },
                { label: '포인트', value: num(data.summary.points), icon: Gift },
              ].map(s => (
                <div key={s.label} className="bg-white/5 border border-white/10 rounded-2xl p-3 text-center">
                  <p className="text-base font-black tabular-nums truncate">{s.value}</p>
                  <p className="text-[10px] text-slate-500 font-bold mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* 추이 차트 */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-black">최근 14일 추이</h4>
                <div className="inline-flex bg-white/5 rounded-lg p-0.5">
                  {[['sales', '매출'], ['orders', '주문']].map(([k, l]) => (
                    <button key={k} type="button" onClick={() => setMetric(k)}
                      className={`px-3 h-7 rounded-md text-[11px] font-black transition-colors ${metric === k ? 'bg-orange-500 text-white' : 'text-slate-400'}`}>{l}</button>
                  ))}
                </div>
              </div>
              <MiniBarChart data={chartData} color="#fb923c" valueFormat={metric === 'sales' ? won : num} />
            </div>

            {/* 포인트 지급/차감 */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
              <h4 className="text-sm font-black flex items-center gap-1.5"><Gift size={14} className="text-amber-400" aria-hidden="true" /> 포인트 수동 지급/차감</h4>
              <div className="grid grid-cols-2 gap-2">
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="고객 전화번호" aria-label="고객 전화번호" inputMode="numeric" spellCheck={false}
                  className="h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-orange-500/50" />
                <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="포인트(숫자)" aria-label="포인트 금액" inputMode="numeric"
                  className="h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-orange-500/50" />
              </div>
              <input value={reason} onChange={e => setReason(e.target.value)} placeholder="사유(선택)" aria-label="사유"
                className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-orange-500/50" />
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={() => submitPoints(1)}
                  className="flex-1 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-black text-sm hover:bg-emerald-500/25 disabled:opacity-50">+ 지급</button>
                <button type="button" disabled={busy} onClick={() => submitPoints(-1)}
                  className="flex-1 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 font-black text-sm hover:bg-rose-500/25 disabled:opacity-50">− 차감</button>
              </div>
            </div>

            {/* 최근 주문 */}
            {data.recentOrders?.length > 0 && (
              <div>
                <h4 className="text-sm font-black mb-2">최근 주문</h4>
                <div className="bg-white/5 border border-white/10 rounded-2xl divide-y divide-white/5">
                  {data.recentOrders.map(o => (
                    <div key={o.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span className="font-bold text-slate-300">{o.order_number}</span>
                      <span className="text-slate-500 text-xs">{o.status}</span>
                      <span className="font-black tabular-nums text-orange-300">{won(o.total_amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {msg && <p className="text-xs text-center text-slate-300 bg-white/5 rounded-lg py-2">{msg}</p>}

            {/* 액션 */}
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={toggleActive}
                className={`flex-1 h-11 rounded-2xl font-black text-sm flex items-center justify-center gap-1.5 transition-all ${active ? 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10' : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'}`}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Power size={15} aria-hidden="true" />} {active ? '비활성화' : '활성화'}
              </button>
              <a href={`/admin/stores/${storeId}/orders`} className="flex-1 h-11 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-600 text-white font-black text-sm flex items-center justify-center gap-1.5">
                <ExternalLink size={15} aria-hidden="true" /> 매장 관리로 이동
              </a>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
