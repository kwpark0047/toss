import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Search,
  X,
  History,
  Plus,
  Minus,
  Edit3,
  CheckCircle,
  AlertCircle,
  XCircle,
  Download,
} from 'lucide-react';
import { inventoryAPI } from '../../api';
import EmptyState from '../common/EmptyState';
import Button from '../common/Button';
import { toast } from 'react-toastify';

// 페이지네이션 컴포넌트
function Pagination({ current, total, onChange }) {
  const pages = [];

  if (total <= 5) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    if (current > 3) pages.push('...');
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push('...');
    pages.push(total);
  }

  function renderPage(p, idx) {
    if (p === '...') {
      return (
        <span key={idx} className="w-8 h-8 flex items-center justify-center text-slate-500 text-xs">
          ...
        </span>
      );
    }
    return (
      <button
        key={p}
        onClick={() => onChange(p)}
        className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${p === current ? 'bg-orange-500 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
      >
        {p}
      </button>
    );
  }

  return <div className="flex gap-2">{pages.map(renderPage)}</div>;
}

const STATUS_META = {
  ok: {
    label: '정상',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    icon: CheckCircle,
    border: 'border-emerald-500/30',
  },
  low: {
    label: '저재고',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    icon: AlertCircle,
    border: 'border-amber-500/30',
  },
  out: {
    label: '품절',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    icon: XCircle,
    border: 'border-red-500/30',
  },
  unlimited: {
    label: '무제한',
    color: 'text-slate-400',
    bg: 'bg-slate-500/10',
    icon: Package,
    border: 'border-slate-500/20',
  },
};

const REASON_LABELS = {
  ORDER: '주문 차감',
  MANUAL_IN: '수동 입고',
  MANUAL_OUT: '수동 출고',
  CORRECTION: '재고 조정',
  RETURN: '반품 입고',
};

function SummaryCard({ icon: Icon, label, value, color, bg }) {
  return (
    <div className={`flex items-center gap-4 px-6 py-4 rounded-2xl ${bg} border border-white/5`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${bg}`}>
        <Icon size={22} className={color} />
      </div>
      <div>
        <p className="text-2xl font-black text-white leading-none">{value}</p>
        <p className="text-[11px] text-slate-500 font-bold mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function StockBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.unlimited;
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black ${meta.color} ${meta.bg} border ${meta.border}`}
    >
      <Icon size={10} />
      {meta.label}
    </span>
  );
}

// 재고 조정 모달
function AdjustModal({ product, onClose, onSuccess }) {
  const [mode, setMode] = useState('adjust'); // 'adjust' | 'set'
  const [change, setChange] = useState('');
  const [reason, setReason] = useState('MANUAL_IN');
  const [note, setNote] = useState('');
  const [qty, setQty] = useState(product.stock_quantity ?? 0);
  const [threshold, setThreshold] = useState(product.low_stock_threshold ?? 5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // MANUAL_OUT 선택 시 자동으로 음수로 변환
  useEffect(() => {
    if (reason === 'MANUAL_OUT' && change && !change.startsWith('-')) {
      setChange((c) => '-' + c.replace('-', ''));
    } else if (reason !== 'MANUAL_OUT' && change.startsWith('-')) {
      setChange((c) => c.replace('-', ''));
    }
  }, [reason, change]);

  const handleAdjust = async () => {
    const changeVal = Number(change);
    if (!change || isNaN(changeVal) || changeVal === 0) {
      setError('변경 수량을 입력하세요.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await inventoryAPI.adjustStock(product.id, { change: changeVal, reason, note });
      onSuccess();
    } catch (e) {
      setError(e?.message || '처리 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleSet = async () => {
    setLoading(true);
    setError('');
    try {
      await inventoryAPI.setStock(product.id, {
        quantity: qty === '' ? null : Number(qty),
        low_stock_threshold: Number(threshold),
      });
      onSuccess();
    } catch (e) {
      setError(e?.message || '처리 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-md shadow-2xl shadow-black/50"
      >
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-black text-white text-lg leading-tight">{product.name}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                현재 재고:{' '}
                <span className="text-white font-bold">
                  {product.stock_quantity === null ? '무제한' : `${product.stock_quantity}개`}
                </span>
              </p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-slate-400">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* 모드 탭 */}
          <div className="flex gap-2 mb-6 bg-white/5 p-1 rounded-xl">
            {[
              { key: 'adjust', label: '입출고' },
              { key: 'set', label: '직접 설정' },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setMode(t.key)}
                className={`flex-1 py-2 rounded-lg text-xs font-black transition-all
                                    ${mode === t.key ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-slate-400 hover:text-white'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {mode === 'adjust' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {['MANUAL_IN', 'MANUAL_OUT', 'RETURN', 'CORRECTION'].map((r) => (
                  <button
                    key={r}
                    onClick={() => setReason(r)}
                    className={`py-2.5 rounded-xl text-xs font-black transition-all border
                                            ${
                                              reason === r
                                                ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                                                : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/20'
                                            }`}
                  >
                    {REASON_LABELS[r]}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-400 mb-2 block">
                  {reason === 'MANUAL_OUT' ? '차감 수량 (음수 자동)' : '수량'}
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setChange((v) => String((Number(v) || 0) - 1))}
                    className="w-10 h-10 rounded-xl bg-white/5 text-white flex items-center justify-center hover:bg-white/10 transition-all"
                  >
                    <Minus size={14} />
                  </button>
                  <input
                    type="number"
                    value={change}
                    onChange={(e) => setChange(e.target.value)}
                    placeholder="0"
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-black text-center focus:outline-none focus:border-orange-500/50"
                  />
                  <button
                    onClick={() => setChange((v) => String((Number(v) || 0) + 1))}
                    className="w-10 h-10 rounded-xl bg-white/5 text-white flex items-center justify-center hover:bg-white/10 transition-all"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-400 mb-2 block">
                  메모 (선택)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="사유 메모..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500/50"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-black text-slate-400 mb-2 block">
                  재고 수량 (빈칸 = 무제한)
                </label>
                <input
                  type="number"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  placeholder="무제한은 빈칸"
                  min="0"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-black focus:outline-none focus:border-orange-500/50"
                />
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-400 mb-2 block">
                  저재고 경고 임계치
                </label>
                <input
                  type="number"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  min="0"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-black focus:outline-none focus:border-orange-500/50"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="mt-3 text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-xl">
              {error}
            </div>
          )}

          <Button
            variant="gradient"
            size="md"
            fullWidth
            loading={loading}
            onClick={mode === 'adjust' ? handleAdjust : handleSet}
            className="mt-5"
          >
            {mode === 'adjust' ? '재고 조정' : '설정 저장'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// 이력 모달
function HistoryModal({ product, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    inventoryAPI
      .getProductHistory(product.id)
      .then((res) => {
        setHistory(res?.data?.history || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [product.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl shadow-black/50 overflow-hidden"
        style={{ maxHeight: '80vh' }}
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 className="font-black text-white text-lg">{product.name} 재고 이력</h3>
            <p className="text-xs text-slate-500 mt-0.5">최근 변동 내역</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-slate-400">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(80vh - 80px)' }}>
          {loading ? (
            <div className="py-12 flex justify-center">
              <RefreshCw size={24} className="text-slate-600 animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <EmptyState
              tone="dark"
              icon={<History size={40} className="text-slate-600" aria-hidden="true" />}
              title="이력이 없습니다"
            />
          ) : (
            <div className="divide-y divide-white/[0.03]">
              {history.map((h) => (
                <div key={h.id} className="flex items-center gap-4 px-6 py-4">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0
                                        ${h.change > 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}
                  >
                    {h.change > 0 ? (
                      <TrendingUp size={15} className="text-emerald-400" />
                    ) : (
                      <TrendingDown size={15} className="text-red-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-white">
                        {REASON_LABELS[h.reason] || h.reason}
                      </span>
                      <span
                        className={`text-xs font-black ${h.change > 0 ? 'text-emerald-400' : 'text-red-400'}`}
                      >
                        {h.change > 0 ? `+${h.change}` : h.change}개
                      </span>
                    </div>
                    {h.note && (
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">{h.note}</p>
                    )}
                    <p className="text-[10px] text-slate-600 mt-0.5">
                      잔여 {h.qty_after}개 ·{' '}
                      {new Date(h.created_at).toLocaleString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function InventoryManager() {
  const { storeId } = useParams();
  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState({
    total_managed: 0,
    out_of_stock: 0,
    low_stock: 0,
    ok: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [adjustTarget, setAdjustTarget] = useState(null);
  const [historyTarget, setHistoryTarget] = useState(null);
  const [pagination, setPagination] = useState({ total: 0, page: 1, total_pages: 1 });
  const [reorderCandidates, setReorderCandidates] = useState([]);
  const [reorderLoading, setReorderLoading] = useState(false);

  // 검색 디바운스
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(handler);
  }, [search]);

  // 상태 필터 매핑 (프론트엔드 -> 백엔드)
  const mapStatusFilter = (filter) => {
    switch (filter) {
      case 'ok':
        return 'managed';
      case 'out':
        return 'out';
      case 'low':
        return 'low';
      case 'unlimited':
        return 'unlimited';
      default:
        return '';
    }
  };

  const STATUS_FILTERS = [
    { key: 'ALL', label: '전체', count: null },
    { key: 'out', label: '품절', count: 'out_of_stock' },
    { key: 'low', label: '저재고', count: 'low_stock' },
    { key: 'ok', label: '정상', count: 'ok' },
    { key: 'unlimited', label: '무제한', count: null },
  ];

  const loadInventory = useCallback(
    async (page = 1) => {
      if (!storeId) return;
      setLoading(true);
      try {
        const params = { page, limit: 50 };
        const mappedStatus = mapStatusFilter(statusFilter);
        if (mappedStatus) params.status = mappedStatus;
        if (debouncedSearch) params.search = debouncedSearch;

        const res = await inventoryAPI.getInventory(storeId, params);
        const data = res?.data;
        setProducts(data?.products || []);
        setSummary(data?.summary || { total_managed: 0, out_of_stock: 0, low_stock: 0, ok: 0 });
        setPagination(data?.pagination || { total: 0, page: 1, total_pages: 1 });
      } catch {
        // 조용히 실패
      } finally {
        setLoading(false);
      }
    },
    [storeId, statusFilter, debouncedSearch]
  );

  useEffect(() => {
    loadInventory(1);
  }, [loadInventory]);

  const loadReorderCandidates = useCallback(async () => {
    if (!storeId) return;
    try {
      const res = await inventoryAPI.getReorderCandidates(storeId);
      setReorderCandidates(res?.data || res || []);
    } catch {
      setReorderCandidates([]);
    }
  }, [storeId]);

  useEffect(() => {
    loadReorderCandidates();
  }, [loadReorderCandidates]);

  const generateReorderCandidates = async () => {
    setReorderLoading(true);
    try {
      const res = await inventoryAPI.generateReorderCandidates(storeId, {
        lookbackDays: 30,
        leadTimeDays: 3,
        safetyDays: 2,
      });
      setReorderCandidates(res?.data?.candidates || []);
      toast.success(`${res?.data?.candidates?.length || 0}개 발주 후보를 산출했습니다.`);
    } catch {
      toast.error('자동 발주 후보 산출에 실패했습니다.');
    } finally {
      setReorderLoading(false);
    }
  };

  const decideReorderCandidate = async (id, status) => {
    try {
      await inventoryAPI.decideReorderCandidate(storeId, id, status);
      await loadReorderCandidates();
      toast.success(
        status === 'approved' ? '발주 후보를 승인했습니다.' : '발주 후보를 거절했습니다.'
      );
    } catch {
      toast.error('발주 후보 처리에 실패했습니다.');
    }
  };

  // CSV 내보내기 함수
  const exportToCSV = useCallback(async () => {
    try {
      setLoading(true);
      // 전체 데이터 가져오기 (페이지네이션 없이)
      const res = await inventoryAPI.getInventory(storeId, {
        limit: 10000,
        status: mapStatusFilter(statusFilter),
        search: debouncedSearch,
      });
      const products = res?.data?.products || [];

      const headers = ['상품명', '카테고리', '가격', '재고수량', '임계치', '상태', '품절여부'];
      const rows = products.map((p) => {
        const status = p.stock_status;
        const statusLabel =
          status === 'out'
            ? '품절'
            : status === 'low'
              ? '저재고'
              : status === 'unlimited'
                ? '무제한'
                : '정상';
        return [
          p.name,
          p.categories?.name || '미분류',
          p.price?.toLocaleString() + '원',
          p.stock_quantity === null ? '무제한' : p.stock_quantity,
          p.low_stock_threshold,
          statusLabel,
          p.is_sold_out ? 'Y' : 'N',
        ];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map((r) => r.map((v) => `"${v}"`).join(',')),
      ].join('\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `재고현황_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('CSV 내보내기 완료');
    } catch {
      toast.error('CSV 내보내기 실패');
    } finally {
      setLoading(false);
    }
  }, [storeId, statusFilter, debouncedSearch]);

  return (
    <div className="space-y-8">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter">재고 관리</h1>
          <p className="text-slate-500 text-sm font-bold mt-1">실시간 재고 현황 및 입출고 관리</p>
        </div>
        <button
          onClick={generateReorderCandidates}
          disabled={reorderLoading}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-300 text-xs font-black hover:bg-orange-500/20 transition-all disabled:opacity-50"
        >
          <TrendingUp size={13} className={reorderLoading ? 'animate-pulse' : ''} /> 자동 발주 후보
          산출
        </button>
        <button
          onClick={() => loadInventory(1)}
          className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-400 text-xs font-black hover:text-white hover:bg-white/10 transition-all"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          새로고침
        </button>
        <button
          onClick={exportToCSV}
          className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-400 text-xs font-black hover:text-white hover:bg-white/10 transition-all"
          disabled={loading}
        >
          <Download size={13} />
          CSV 내보내기
        </button>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={Package}
          label="재고 관리 메뉴"
          value={summary.total_managed}
          color="text-slate-300"
          bg="bg-slate-800/50"
        />
        <SummaryCard
          icon={XCircle}
          label="품절"
          value={summary.out_of_stock}
          color="text-red-400"
          bg="bg-red-500/5"
        />
        <SummaryCard
          icon={AlertCircle}
          label="저재고 경고"
          value={summary.low_stock}
          color="text-amber-400"
          bg="bg-amber-500/5"
        />
        <SummaryCard
          icon={CheckCircle}
          label="재고 정상"
          value={summary.ok}
          color="text-emerald-400"
          bg="bg-emerald-500/5"
        />
      </div>

      {/* 저재고/품절 경고 배너 */}
      {(summary.out_of_stock > 0 || summary.low_stock > 0) && (
        <div className="flex items-center gap-3 px-5 py-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
          <AlertTriangle size={18} className="text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-300 font-bold">
            {summary.out_of_stock > 0 && (
              <span className="text-red-400">{summary.out_of_stock}개 품절</span>
            )}
            {summary.out_of_stock > 0 && summary.low_stock > 0 && ' · '}
            {summary.low_stock > 0 && <span>{summary.low_stock}개 저재고 경고</span>}
            <span className="text-slate-400 font-normal ml-2">빠른 재고 보충이 필요합니다.</span>
          </p>
        </div>
      )}

      {reorderCandidates.length > 0 && (
        <div className="p-5 bg-orange-500/5 border border-orange-500/20 rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-black text-orange-200">자동 발주 후보</h2>
            <span className="text-xs text-slate-500">승인 전에는 발주가 실행되지 않습니다.</span>
          </div>
          <div className="space-y-2">
            {reorderCandidates.map((candidate) => (
              <div
                key={candidate.id}
                className="flex items-center justify-between gap-3 bg-black/10 rounded-xl px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">
                    상품 #{candidate.product_id}
                  </p>
                  <p className="text-xs text-slate-400">
                    현재 {candidate.current_quantity}개 · 추천 입고 {candidate.suggested_quantity}개
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => decideReorderCandidate(candidate.id, 'approved')}
                    className="px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 text-[10px] font-bold"
                  >
                    승인
                  </button>
                  <button
                    onClick={() => decideReorderCandidate(candidate.id, 'rejected')}
                    className="px-2 py-1 rounded-lg bg-red-500/15 text-red-300 text-[10px] font-bold"
                  >
                    거절
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 필터 및 검색 */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="메뉴 이름 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none focus:border-orange-500/50"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map((f) => {
            const countValue = f.count ? summary[f.count] : null;
            return (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all
                                        ${
                                          statusFilter === f.key
                                            ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                                            : 'bg-white/5 text-slate-400 hover:text-white border border-white/5'
                                        }`}
              >
                {f.label}
                {countValue !== null && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[9px] font-black
                                        ${statusFilter === f.key ? 'bg-white/20' : 'bg-white/10'}`}
                  >
                    {countValue}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 재고 테이블 */}
      <div className="bg-slate-900/50 backdrop-blur-sm border border-white/5 rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  메뉴
                </th>
                <th className="text-left px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  카테고리
                </th>
                <th className="text-center px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  재고 수량
                </th>
                <th className="text-center px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  임계치
                </th>
                <th className="text-center px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  상태
                </th>
                <th className="text-right px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  관리
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <RefreshCw size={24} className="text-slate-600 animate-spin mx-auto mb-3" />
                    <p className="text-xs text-slate-600 font-bold">불러오는 중...</p>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      tone="dark"
                      icon={<Package size={40} className="text-slate-600" aria-hidden="true" />}
                      title="메뉴가 없습니다"
                      description="메뉴를 추가하면 재고를 관리할 수 있어요."
                    />
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const status = product.stock_status;
                  const _meta = STATUS_META[status];
                  return (
                    <motion.tr
                      key={product.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`hover:bg-white/[0.02] transition-all
                                            ${status === 'out' ? 'bg-red-500/[0.03]' : status === 'low' ? 'bg-amber-500/[0.02]' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-10 h-10 rounded-xl object-cover flex-shrink-0 ring-1 ring-white/10"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                              <Package size={14} className="text-slate-600" />
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-bold text-white">{product.name}</p>
                            <p className="text-[10px] text-slate-500">
                              {product.price?.toLocaleString()}원
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-xs text-slate-400">
                          {product.categories?.name || '미분류'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span
                          className={`text-xl font-black ${
                            status === 'out'
                              ? 'text-red-400'
                              : status === 'low'
                                ? 'text-amber-400'
                                : status === 'unlimited'
                                  ? 'text-slate-500'
                                  : 'text-white'
                          }`}
                        >
                          {product.stock_quantity === null ? '∞' : product.stock_quantity}
                        </span>
                        {product.stock_quantity !== null && (
                          <span className="text-[10px] text-slate-600 ml-1">개</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className="text-xs text-slate-500">
                          {product.stock_quantity === null
                            ? '—'
                            : `${product.low_stock_threshold}개`}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <StockBadge status={status} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setHistoryTarget(product)}
                            className="p-2 rounded-xl hover:bg-white/10 text-slate-500 hover:text-slate-300 transition-all"
                            title="이력 보기"
                          >
                            <History size={14} />
                          </button>
                          <button
                            onClick={() => setAdjustTarget(product)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-400 rounded-xl text-[11px] font-black transition-all"
                          >
                            <Edit3 size={11} />
                            조정
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        {pagination.total_pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/5">
            <span className="text-xs text-slate-600">총 {pagination.total}개 메뉴</span>
            <Pagination
              current={pagination.page}
              total={pagination.total_pages}
              onChange={loadInventory}
            />
          </div>
        )}
      </div>

      {/* 모달 */}
      <AnimatePresence>
        {adjustTarget && (
          <AdjustModal
            product={adjustTarget}
            onClose={() => setAdjustTarget(null)}
            onSuccess={() => {
              setAdjustTarget(null);
              loadInventory(pagination.page);
            }}
          />
        )}
        {historyTarget && (
          <HistoryModal product={historyTarget} onClose={() => setHistoryTarget(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
