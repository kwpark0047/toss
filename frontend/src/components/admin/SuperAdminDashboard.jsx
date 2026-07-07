import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Store, Users, Coins, ShoppingBag, CheckCircle2, Search, ChevronLeft, ChevronRight,
  Settings, Gift, MapPinned, Loader2, Building2,
} from 'lucide-react';
import { adminAPI } from '../../api/admin';
import { bizLabel } from '../../utils/businessType';

const won = (n) => `₩${Number(n || 0).toLocaleString('ko-KR')}`;
const num = (n) => Number(n || 0).toLocaleString('ko-KR');

/**
 * SuperAdminDashboard — 슈퍼관리자(플랫폼 운영자) 전용 대시보드.
 * 전체 매장 지표 + 매장 검색/관리 + 매장별 고객·포인트 진입.
 */
export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI.platformOverview().then(r => setOverview(r?.data || r)).catch(() => {});
  }, []);

  const fetchStores = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminAPI.platformStores({ page, search: query, limit: 20 });
      const d = r?.data || r;
      setRows(d.stores || []);
      setTotalPages(d.totalPages || 1);
      setTotal(d.total || 0);
    } catch { setRows([]); }
    finally { setLoading(false); }
  }, [page, query]);

  useEffect(() => { fetchStores(); }, [fetchStores]);

  const submitSearch = (e) => { e?.preventDefault?.(); setPage(1); setQuery(search.trim()); };

  const KPIS = overview ? [
    { label: '전체 매장', value: num(overview.totalStores), icon: Store, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { label: '활성 매장', value: num(overview.activeStores), icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: '총 고객', value: num(overview.totalCustomers), icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: '총 주문', value: num(overview.totalOrders), icon: ShoppingBag, color: 'text-violet-400', bg: 'bg-violet-500/10' },
    { label: '발행 포인트', value: num(overview.pointsIssued), icon: Coins, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: '포인트 잔액', value: num(overview.pointsBalance), icon: Gift, color: 'text-rose-400', bg: 'bg-rose-500/10' },
  ] : [];

  return (
    <div className="max-w-7xl mx-auto text-white pb-10">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div>
          <p className="text-sm text-slate-500 font-medium">플랫폼 운영</p>
          <h1 className="text-2xl sm:text-3xl font-black flex items-center gap-2">
            <Building2 size={26} className="text-orange-400" aria-hidden="true" /> 슈퍼관리자 대시보드
          </h1>
        </div>
        <button type="button" onClick={() => navigate('/admin/enrich-stores')}
          className="inline-flex items-center gap-2 px-5 h-11 rounded-2xl bg-white/5 border border-white/10 font-black text-sm hover:bg-white/10 transition-all">
          <MapPinned size={16} aria-hidden="true" /> 매장 정보 보강
        </button>
      </div>

      {/* KPI */}
      {overview ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {KPIS.map(k => (
            <div key={k.label} className="bg-white/5 border border-white/10 rounded-2xl p-4">
              <div className={`w-10 h-10 rounded-xl ${k.bg} flex items-center justify-center mb-3`}>
                <k.icon size={18} className={k.color} aria-hidden="true" />
              </div>
              <p className="text-xl font-black tabular-nums leading-none">{k.value}</p>
              <p className="text-[11px] text-slate-500 font-bold mt-1.5">{k.label}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-8">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton-dark h-28 rounded-2xl" />)}
        </div>
      )}

      {/* 매장 검색 */}
      <form onSubmit={submitSearch} className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} spellCheck={false}
            placeholder="상호·주소로 매장 검색…" aria-label="매장 검색"
            className="w-full h-11 pl-10 pr-3 rounded-2xl bg-white/5 border border-white/10 text-sm font-medium text-white placeholder:text-slate-600 outline-none focus:border-orange-500/50 focus-visible:ring-2 focus-visible:ring-orange-400/40" />
        </div>
        <button type="submit" className="h-11 px-5 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-600 text-white font-black text-sm shadow-lg shadow-orange-500/20">검색</button>
      </form>
      <p className="text-xs text-slate-500 font-bold mb-3">총 <span className="tabular-nums text-slate-300">{num(total)}</span>개 매장{query && ` · "${query}" 검색`}</p>

      {/* 매장 테이블 */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        {/* 헤더 (데스크톱) */}
        <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/10 text-[11px] font-black text-slate-500 uppercase tracking-wider">
          <div className="col-span-4">매장</div>
          <div className="col-span-2">업종</div>
          <div className="col-span-1 text-right">주문</div>
          <div className="col-span-2 text-right">매출</div>
          <div className="col-span-1 text-right">고객</div>
          <div className="col-span-2 text-right">관리</div>
        </div>

        {loading ? (
          <div className="p-4 space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="skeleton-dark h-14 rounded-xl" />)}</div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-slate-500 font-bold">조건에 맞는 매장이 없습니다.</div>
        ) : rows.map((s, i) => (
          <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.2) }}
            className="grid grid-cols-2 md:grid-cols-12 gap-2 px-4 py-3 border-b border-white/5 items-center hover:bg-white/[0.03] transition-colors">
            <div className="col-span-2 md:col-span-4 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-black text-sm truncate">{s.name}</span>
                {!s.is_active && <span className="shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded bg-white/10 text-slate-400">비활성</span>}
              </div>
              <p className="text-[11px] text-slate-500 truncate">{s.address || '주소 없음'}</p>
            </div>
            <div className="hidden md:block col-span-2 text-xs text-slate-400 truncate">{s.business_type ? bizLabel(s.business_type) : '-'}</div>
            <div className="hidden md:block col-span-1 text-right text-sm font-bold tabular-nums">{num(s.orders)}</div>
            <div className="hidden md:block col-span-2 text-right text-sm font-bold tabular-nums text-orange-300">{won(s.sales)}</div>
            <div className="hidden md:block col-span-1 text-right text-sm font-bold tabular-nums">{num(s.customers)}</div>
            <div className="col-span-2 flex items-center justify-end gap-1.5">
              <button type="button" onClick={() => navigate(`/admin/stores/${s.id}/orders`)} aria-label={`${s.name} 관리`}
                className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg bg-white/5 border border-white/10 text-[11px] font-black text-slate-300 hover:bg-white/10 transition-colors">
                <Settings size={13} aria-hidden="true" /> 관리
              </button>
              <button type="button" onClick={() => navigate(`/admin/stores/${s.id}/customers`)} aria-label={`${s.name} 고객·포인트`}
                className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg bg-orange-500/15 border border-orange-500/30 text-[11px] font-black text-orange-300 hover:bg-orange-500/25 transition-colors">
                <Gift size={13} aria-hidden="true" /> 포인트
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-5">
          <button type="button" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} aria-label="이전 페이지"
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-30 transition-all">
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <span className="text-sm font-black tabular-nums text-slate-300">{num(page)} / {num(totalPages)}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} aria-label="다음 페이지"
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-30 transition-all">
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
