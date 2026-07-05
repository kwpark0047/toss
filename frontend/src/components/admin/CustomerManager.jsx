import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Users, Search, RefreshCw, Award, Send, X, ChevronRight,
  Crown, Star, TrendingUp, Smartphone, Gift, Clock, Wallet,
  AlertTriangle, UserCheck, BarChart2, Loader2, ChevronDown,
  History, Tag, Phone,
} from 'lucide-react';
import { formatPrice } from '../../utils/format';
import api from '../../api/index.js';

// ── 등급 메타 ─────────────────────────────────────────────────────
const TIER_META = {
  GENERAL:  { label: '일반',   color: 'bg-gray-100 text-gray-600',   bar: 'bg-gray-400',   icon: Users,     ring: 'ring-gray-300' },
  SILVER:   { label: '실버',   color: 'bg-blue-100 text-blue-700',   bar: 'bg-blue-500',   icon: Star,      ring: 'ring-blue-300' },
  GOLD:     { label: '골드',   color: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500',  icon: Award,     ring: 'ring-amber-300' },
  VIP:      { label: 'VIP',    color: 'bg-purple-100 text-purple-700', bar: 'bg-purple-500', icon: Crown,   ring: 'ring-purple-300' },
  PLATINUM: { label: '플래티넘', color: 'bg-rose-100 text-rose-700',  bar: 'bg-rose-500',   icon: Crown,   ring: 'ring-rose-300' },
};

function getTierMeta(tier) {
  return TIER_META[(tier ?? 'GENERAL').toUpperCase()] || TIER_META.GENERAL;
}

// ── 날짜 헬퍼 ─────────────────────────────────────────────────────
function daysSince(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr)) / 86400000);
}

function fmtDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmtDateTime(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function maskPhone(phone = '') {
  return phone.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-****-$3');
}

// ── API helpers ─────────────────────────────────────────────────
const cApi = {
  list:    (sid, p) => api.get(`/customers/${sid}`, { params: p }),
  stats:   (sid)    => api.get(`/customers/${sid}/stats`),
  history: (sid, cid) => api.get(`/customers/${sid}/customer/${cid}/history`),
  coupons: (sid)    => api.get(`/customers/${sid}/coupons`),
  issueCoupon: (sid, cid, coupon_id) =>
    api.post(`/customers/${sid}/customer/${cid}/coupon`, { coupon_id }),
};

// ── 통계 카드 ─────────────────────────────────────────────────────
function StatsBar({ stats, loading }) {
  if (loading) return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {Array(6).fill(0).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse h-20" />
      ))}
    </div>
  );
  if (!stats) return null;

  const generalCount  = stats.tier_distribution?.GENERAL  || 0;
  const silverCount   = stats.tier_distribution?.SILVER   || 0;
  const goldCount     = stats.tier_distribution?.GOLD     || 0;
  const vipCount      = (stats.tier_distribution?.VIP || 0) + (stats.tier_distribution?.PLATINUM || 0);

  const cards = [
    { label: '총 단골 고객',   value: `${stats.total_customers.toLocaleString()}명`, icon: Users,       color: 'text-sky-500',    bg: 'bg-sky-50' },
    { label: '이번 달 신규',   value: `+${stats.new_this_month}명`,                  icon: UserCheck,   color: 'text-green-500',  bg: 'bg-green-50' },
    { label: '평균 방문 횟수', value: `${stats.avg_visit_count}회`,                  icon: TrendingUp,  color: 'text-purple-500', bg: 'bg-purple-50' },
    { label: '평균 객단가',    value: formatPrice(stats.avg_spent),                  icon: Wallet,      color: 'text-amber-500',  bg: 'bg-amber-50' },
    { label: 'VIP 고객',       value: `${vipCount + goldCount}명`,                   icon: Crown,       color: 'text-rose-500',   bg: 'bg-rose-50' },
    { label: '이탈 위험 (30일)', value: `${stats.churned_30d}명`,                    icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-50' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {cards.map(c => {
        const Icon = c.icon;
        return (
          <div key={c.label} className="bg-white rounded-xl border border-gray-100 p-4 flex flex-col gap-2">
            <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>
              <Icon size={16} className={c.color} />
            </div>
            <div className="font-bold text-gray-900 text-lg leading-none">{c.value}</div>
            <div className="text-xs text-gray-400">{c.label}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── 등급 진행 바 ──────────────────────────────────────────────────
function TierProgress({ totalSpent, tiers, currentTier }) {
  if (!tiers || tiers.length === 0) return null;
  const meta = getTierMeta(currentTier);
  const sorted = [...tiers].sort((a, b) => a.min_spent - b.min_spent);
  const next = sorted.find(t => t.min_spent > totalSpent);
  if (!next) {
    return (
      <div className="flex items-center gap-2 text-xs text-purple-600">
        <Crown size={12} /> 최고 등급 달성!
      </div>
    );
  }
  const prev = sorted.filter(t => t.min_spent <= totalSpent).pop();
  const base = prev?.min_spent || 0;
  const pct  = Math.min(100, ((totalSpent - base) / (next.min_spent - base)) * 100);
  const remain = next.min_spent - totalSpent;

  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{meta.label}</span>
        <span>{getTierMeta(next.tier_name).label}까지 {formatPrice(remain)}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all ${meta.bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── 고객 카드 ──────────────────────────────────────────────────────
function CustomerCard({ customer, onOpen }) {
  const meta  = getTierMeta(customer.tier);
  const TierIcon = meta.icon;
  const days  = daysSince(customer.last_visit_at);
  const riskColor = days > 60 ? 'text-red-500' : days > 30 ? 'text-orange-400' : 'text-green-500';

  return (
    <div
      onClick={() => onOpen(customer)}
      className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-all cursor-pointer group"
    >
      <div className="flex items-start gap-3">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ring-2 ${meta.ring} shrink-0 ${
          customer.tier === 'GOLD' ? 'bg-amber-50' : customer.tier === 'VIP' || customer.tier === 'PLATINUM' ? 'bg-purple-50' : customer.tier === 'SILVER' ? 'bg-blue-50' : 'bg-gray-50'
        }`}>
          <TierIcon size={22} className={meta.color.split(' ')[1]} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-800 truncate">
              {customer.customer_name || '익명 고객'}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${meta.color}`}>
              {meta.label}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
            <Phone size={10} />
            {maskPhone(customer.customer_phone)}
          </div>
        </div>
        <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 shrink-0 mt-1 transition-colors" />
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        <div className="bg-gray-50 rounded-lg py-2">
          <div className="text-xs text-gray-400">방문</div>
          <div className="font-bold text-gray-800">{customer.visit_count}<span className="text-xs font-normal">회</span></div>
        </div>
        <div className="bg-gray-50 rounded-lg py-2">
          <div className="text-xs text-gray-400">총 결제</div>
          <div className="font-bold text-gray-800 text-xs">{formatPrice(customer.total_spent)}</div>
        </div>
        <div className={`bg-gray-50 rounded-lg py-2 ${riskColor}`}>
          <div className="text-xs text-gray-400">마지막 방문</div>
          <div className="font-bold text-xs">{days != null ? `${days}일 전` : '-'}</div>
        </div>
      </div>
    </div>
  );
}

// ── 고객 상세 드로어 ──────────────────────────────────────────────
function CustomerDrawer({ customer, storeId, onClose }) {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState('overview');
  const [coupons, setCoupons]   = useState([]);
  const [issuing, setIssuing]   = useState(false);
  const [couponPicker, setCouponPicker] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState('');
  const [couponMsg, setCouponMsg] = useState('');
  const overlayRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    cApi.history(storeId, customer.id).then(res => {
      setData(res?.data || res);
    }).catch(() => {}).finally(() => setLoading(false));

    cApi.coupons(storeId).then(res => {
      setCoupons(res?.data || []);
    }).catch(() => {});
  }, [storeId, customer.id]);

  const issueCoupon = async () => {
    if (!selectedCoupon) return;
    setIssuing(true);
    setCouponMsg('');
    try {
      const res = await cApi.issueCoupon(storeId, customer.id, parseInt(selectedCoupon));
      setCouponMsg(res?.message || '발급 완료');
      setCouponPicker(false);
      // 활성 쿠폰 목록 갱신
      const refreshed = await cApi.history(storeId, customer.id);
      setData(refreshed?.data || refreshed);
    } catch (e) {
      setCouponMsg(e?.response?.data?.error || '발급 실패');
    } finally {
      setIssuing(false);
    }
  };

  const meta    = getTierMeta(customer.tier);
  const TierIcon = meta.icon;
  const days    = daysSince(customer.last_visit_at);

  const tabs = [
    { id: 'overview', label: '요약',     icon: BarChart2 },
    { id: 'orders',   label: '방문 이력', icon: History   },
    { id: 'points',   label: '포인트',    icon: Wallet    },
    { id: 'coupons',  label: '쿠폰',      icon: Tag       },
  ];

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* 오버레이 */}
      <div className="flex-1 bg-black/40" onClick={onClose} ref={overlayRef} />

      {/* 드로어 */}
      <div className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl overflow-hidden">
        {/* 헤더 */}
        <div className={`p-5 ${
          customer.tier === 'VIP' || customer.tier === 'PLATINUM'
            ? 'bg-gradient-to-r from-purple-600 to-rose-500'
            : customer.tier === 'GOLD'
            ? 'bg-gradient-to-r from-amber-500 to-orange-400'
            : customer.tier === 'SILVER'
            ? 'bg-gradient-to-r from-blue-500 to-sky-400'
            : 'bg-gradient-to-r from-gray-600 to-gray-500'
        } text-white`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg">고객 상세</h2>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/20">
              <X size={18} />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
              <TierIcon size={28} className="text-white" />
            </div>
            <div>
              <div className="font-bold text-xl">{customer.customer_name || '익명 고객'}</div>
              <div className="flex items-center gap-2 mt-0.5 text-white/80 text-sm">
                <Phone size={12} /> {maskPhone(customer.customer_phone)}
                <span className="bg-white/20 px-1.5 py-0.5 rounded text-xs font-medium">{meta.label}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="bg-white/10 rounded-xl p-2 text-center">
              <div className="text-white/70 text-xs">방문 횟수</div>
              <div className="font-bold text-lg">{customer.visit_count}회</div>
            </div>
            <div className="bg-white/10 rounded-xl p-2 text-center">
              <div className="text-white/70 text-xs">총 결제</div>
              <div className="font-bold text-sm">{formatPrice(customer.total_spent)}</div>
            </div>
            <div className="bg-white/10 rounded-xl p-2 text-center">
              <div className="text-white/70 text-xs">마지막 방문</div>
              <div className="font-bold text-sm">{days != null ? `${days}일 전` : '-'}</div>
            </div>
          </div>
        </div>

        {/* 탭 */}
        <div className="flex border-b border-gray-100">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                  tab === t.id ? 'border-sky-500 text-sky-600' : 'border-transparent text-gray-400 hover:text-gray-600'
                }`}
              >
                <Icon size={15} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* 탭 콘텐츠 */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48 text-gray-400">
              <Loader2 size={24} className="animate-spin" />
            </div>
          ) : !data ? (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
              데이터 로딩 실패
            </div>
          ) : (
            <>
              {/* ── 요약 탭 ── */}
              {tab === 'overview' && (
                <div className="p-4 space-y-4">
                  {/* 포인트 요약 */}
                  <div className="bg-gradient-to-r from-sky-50 to-blue-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Wallet size={16} className="text-sky-600" />
                      <span className="font-semibold text-sky-800">포인트 현황</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-xs text-sky-600/70">보유 포인트</div>
                        <div className="font-bold text-sky-700 text-lg">{(data.point_balance || 0).toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-sky-600/70">누적 적립</div>
                        <div className="font-bold text-sky-700">{(data.lifetime_earned || 0).toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-sky-600/70">누적 사용</div>
                        <div className="font-bold text-sky-700">{(data.lifetime_used || 0).toLocaleString()}</div>
                      </div>
                    </div>
                  </div>

                  {/* 등급 진행 */}
                  <div className="bg-white rounded-xl border border-gray-100 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Crown size={16} className="text-amber-500" />
                      <span className="font-semibold text-gray-700">등급 현황</span>
                    </div>
                    <TierProgress
                      totalSpent={customer.total_spent}
                      tiers={data.tiers}
                      currentTier={customer.tier}
                    />
                  </div>

                  {/* 보유 쿠폰 요약 */}
                  {data.active_coupons?.length > 0 && (
                    <div className="bg-orange-50 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Gift size={16} className="text-orange-500" />
                        <span className="font-semibold text-orange-700">보유 쿠폰 {data.active_coupons.length}장</span>
                      </div>
                      <div className="space-y-1">
                        {data.active_coupons.slice(0, 3).map(uc => (
                          <div key={uc.id} className="flex justify-between text-sm text-orange-700">
                            <span>{uc.coupons?.name}</span>
                            {uc.expires_at && <span className="text-xs text-orange-400">{fmtDate(uc.expires_at)}까지</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 쿠폰 발급 버튼 */}
                  <button
                    onClick={() => { setCouponPicker(true); setCouponMsg(''); }}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-sky-500 text-white rounded-xl font-medium hover:bg-sky-600 transition-colors"
                  >
                    <Gift size={16} /> 쿠폰 발급하기
                  </button>

                  {couponMsg && (
                    <p className={`text-sm text-center ${couponMsg.includes('실패') || couponMsg.includes('보유') ? 'text-red-500' : 'text-green-600'}`}>
                      {couponMsg}
                    </p>
                  )}
                </div>
              )}

              {/* ── 방문 이력 탭 ── */}
              {tab === 'orders' && (
                <div className="p-4">
                  <p className="text-xs text-gray-400 mb-3">최근 주문 이력</p>
                  {data.recent_orders?.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 text-sm">주문 이력 없음</div>
                  ) : (
                    <div className="space-y-2">
                      {data.recent_orders.map(o => (
                        <div key={o.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                          <div>
                            <div className="text-sm font-medium text-gray-800">{formatPrice(o.total_amount)}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{fmtDateTime(o.created_at)}</div>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            o.status === 'completed' ? 'bg-green-100 text-green-700' :
                            o.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                            'bg-gray-100 text-gray-600'
                          }`}>{o.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── 포인트 탭 ── */}
              {tab === 'points' && (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-gray-400">포인트 내역</p>
                    <span className="text-sm font-bold text-sky-600">잔액: {(data.point_balance || 0).toLocaleString()}P</span>
                  </div>
                  {data.point_history?.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 text-sm">포인트 내역 없음</div>
                  ) : (
                    <div className="space-y-2">
                      {data.point_history.map(p => (
                        <div key={p.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                          <div>
                            <div className="text-sm text-gray-700">{p.description || p.type}</div>
                            <div className="text-xs text-gray-400">{fmtDateTime(p.created_at)}</div>
                          </div>
                          <div className="text-right">
                            <div className={`font-bold text-sm ${p.type === 'earn' ? 'text-green-600' : 'text-red-500'}`}>
                              {p.type === 'earn' ? '+' : '-'}{p.amount.toLocaleString()}P
                            </div>
                            <div className="text-xs text-gray-400">{p.balance_after.toLocaleString()}P</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── 쿠폰 탭 ── */}
              {tab === 'coupons' && (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-gray-400">보유 쿠폰</p>
                    <button
                      onClick={() => { setCouponPicker(true); setCouponMsg(''); }}
                      className="flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700 font-medium"
                    >
                      <Gift size={13} /> 쿠폰 발급
                    </button>
                  </div>
                  {couponMsg && (
                    <p className={`text-sm mb-2 ${couponMsg.includes('실패') || couponMsg.includes('보유') ? 'text-red-500' : 'text-green-600'}`}>
                      {couponMsg}
                    </p>
                  )}
                  {data.active_coupons?.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 text-sm">보유 쿠폰 없음</div>
                  ) : (
                    <div className="space-y-2">
                      {data.active_coupons.map(uc => (
                        <div key={uc.id} className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-3">
                          <div className="flex justify-between items-start">
                            <div className="font-medium text-orange-800">{uc.coupons?.name}</div>
                            <span className="text-xs bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full">미사용</span>
                          </div>
                          <div className="text-sm text-orange-600 mt-1">
                            {uc.coupons?.type === 'percent' ? `${uc.coupons?.amount}% 할인` : `${formatPrice(uc.coupons?.amount)} 할인`}
                          </div>
                          {uc.expires_at && (
                            <div className="text-xs text-orange-400 mt-1 flex items-center gap-1">
                              <Clock size={10} /> {fmtDate(uc.expires_at)} 까지
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 쿠폰 발급 피커 */}
      {couponPicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold">쿠폰 선택</h3>
              <button onClick={() => setCouponPicker(false)} className="p-1 hover:bg-gray-100 rounded"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-3">
              {coupons.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">등록된 쿠폰이 없습니다.</p>
              ) : (
                <>
                  <select aria-label="쿠폰 선택"
                    value={selectedCoupon}
                    onChange={e => setSelectedCoupon(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm"
                  >
                    <option value="">쿠폰을 선택하세요</option>
                    {coupons.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.type === 'percent' ? `${c.amount}%` : formatPrice(c.amount)} 할인)
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={issueCoupon}
                    disabled={!selectedCoupon || issuing}
                    className="w-full py-2.5 bg-sky-500 text-white rounded-xl text-sm font-medium hover:bg-sky-600 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {issuing ? <Loader2 size={14} className="animate-spin" /> : <Gift size={14} />}
                    발급하기
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 메인 페이지 ─────────────────────────────────────────────────────
const CustomerManager = () => {
  const { storeId } = useParams();
  const [customers, setCustomers]     = useState([]);
  const [stats, setStats]             = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [loading, setLoading]         = useState(true);
  const [searchTerm, setSearchTerm]   = useState('');
  const [sortBy, setSortBy]           = useState('last_visit_at');
  const [order, setOrder]             = useState('desc');
  const [tierFilter, setTierFilter]   = useState('ALL');
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await cApi.stats(storeId);
      setStats(res?.data || res);
    } catch {}
    setStatsLoading(false);
  }, [storeId]);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = { sortBy, order, limit: 100, search: searchTerm };
      if (tierFilter !== 'ALL') params.tier = tierFilter;
      const res = await cApi.list(storeId, params);
      let list = res?.data || [];
      // tier 필터를 프론트에서도 적용 (백엔드가 지원 안 할 경우 대비)
      if (tierFilter !== 'ALL') {
        list = list.filter(c => c.tier === tierFilter);
      }
      setCustomers(list);
    } catch {}
    setLoading(false);
  }, [storeId, sortBy, order, searchTerm, tierFilter]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  // 등급 필터 옵션 (통계 기반)
  const tierTabs = [
    { value: 'ALL',      label: '전체',    count: stats?.total_customers },
    { value: 'GENERAL',  label: '일반',    count: stats?.tier_distribution?.GENERAL },
    { value: 'SILVER',   label: '실버',    count: stats?.tier_distribution?.SILVER },
    { value: 'GOLD',     label: '골드',    count: stats?.tier_distribution?.GOLD },
    { value: 'VIP',      label: 'VIP',     count: (stats?.tier_distribution?.VIP || 0) + (stats?.tier_distribution?.PLATINUM || 0) },
  ].filter(t => t.value === 'ALL' || (t.count ?? 0) > 0);

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <Users size={22} className="text-sky-400" /> 단골고객 관리
          </h1>
          <p className="text-sm text-slate-400">방문 이력·포인트·VIP 등급을 한눈에 관리하세요</p>
        </div>
        <button
          onClick={() => { fetchStats(); fetchCustomers(); }}
          className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 새로고침
        </button>
      </div>

      {/* 통계 카드 */}
      <StatsBar stats={stats} loading={statsLoading} />

      {/* 필터 툴바 */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 flex flex-col sm:flex-row gap-3">
        {/* 검색 */}
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="고객명 또는 전화번호 검색..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-gray-50 rounded-lg text-sm border border-gray-100 focus:ring-2 focus:ring-sky-400 outline-none"
          />
        </div>
        {/* 정렬 */}
        <div className="flex gap-2">
          <select aria-label="정렬 기준"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="px-3 py-2 bg-gray-50 rounded-lg text-sm border border-gray-100 text-gray-700"
          >
            <option value="last_visit_at">최근 방문순</option>
            <option value="visit_count">방문 횟수순</option>
            <option value="total_spent">총 결제순</option>
            <option value="created_at">최초 등록순</option>
          </select>
          <button
            onClick={() => setOrder(o => o === 'desc' ? 'asc' : 'desc')}
            className="px-3 py-2 bg-gray-50 rounded-lg text-sm border border-gray-100 text-gray-700 hover:bg-gray-100"
          >
            {order === 'desc' ? '↓ 내림차순' : '↑ 오름차순'}
          </button>
        </div>
      </div>

      {/* 등급 필터 탭 */}
      <div className="flex gap-1 flex-wrap">
        {tierTabs.map(t => {
          const isActive = tierFilter === t.value;
          const meta = t.value === 'ALL' ? null : getTierMeta(t.value);
          return (
            <button
              key={t.value}
              onClick={() => setTierFilter(t.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                isActive
                  ? (meta ? `${meta.color} ring-1 ring-current` : 'bg-sky-100 text-sky-700 ring-1 ring-sky-300')
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {t.label}
              {t.count != null && (
                <span className={`rounded-full px-1 ${isActive ? 'bg-white/50' : 'bg-white text-gray-500'}`}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 고객 목록 */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={28} className="animate-spin" />
        </div>
      ) : customers.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Users size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-400 text-sm">
            {searchTerm ? '검색 결과가 없습니다.' : '아직 등록된 단골고객이 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map(c => (
            <CustomerCard key={c.id} customer={c} onOpen={setSelectedCustomer} />
          ))}
        </div>
      )}

      {/* 고객 상세 드로어 */}
      {selectedCustomer && (
        <CustomerDrawer
          customer={selectedCustomer}
          storeId={storeId}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </div>
  );
};

export default CustomerManager;
