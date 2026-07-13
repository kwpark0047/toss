import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Search, Navigation, Store, ChevronRight, Loader2, Utensils, Map as MapIcon, List, LayoutGrid, CheckCircle2, Clock, Heart, ChefHat, BellRing, XCircle, AlertTriangle, RefreshCw, Server } from 'lucide-react';
import NaverShareButton from './common/NaverShareButton';
import { storesAPI } from '../api/stores';
import { ordersAPI } from '../api/orders';
import StoreMapLeaflet from './StoreMapLeaflet';
import HighlightBanner from './HighlightBanner';
import { onOrderUpdated, joinOrderRoom, joinCustomerOrders } from '../utils/socket';
import { bizLabel } from '../utils/businessType';
import { isDisplayableStoreName } from '../utils/storeName';

/**
 * StoreLocator — 랜딩 "매장 위치" 섹션.
 * 고객 위치(지오로케이션) 기준 거리순 + 지역(구/동)·업종·키워드 검색.
 */
export default function StoreLocator() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const orderNo = searchParams.get('order');   // 주문 완료 후 진입 시 주문번호
  const orderEta = searchParams.get('eta');    // 예상 준비시간(분)
  const orderStore = searchParams.get('store');
  const [district, setDistrict] = useState('');
  const [businessType, setBusinessType] = useState('all');
  const [keyword, setKeyword] = useState(orderStore || '');
  const [coords, setCoords] = useState(null); // { lat, lng }
  const [stores, setStores] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [locating, setLocating] = useState(false);
  const [geoMsg, setGeoMsg] = useState('');
  const [view, setView] = useState('grid'); // grid | list | map (그리드 기본)
  const [favorites, setFavorites] = useState(new Set());
  const customerPhone = (() => { try { return localStorage.getItem('wm_customer_phone'); } catch { return null; } })();

  useEffect(() => {
    if (!customerPhone) return;
    storesAPI.getFavorites(customerPhone).then(res => {
      const list = Array.isArray(res) ? res : (res?.data || []);
      setFavorites(new Set(list.map(s => s.id)));
    }).catch(() => {});
  }, [customerPhone]);

  const [orderStatus, setOrderStatus] = useState(null);
  const [orderStatusLoaded, setOrderStatusLoaded] = useState(false);
  const orderIdParam = orderNo ? Number(orderNo) : null;
  const statusMounted = useRef(true);

  useEffect(() => {
    if (!orderIdParam) return;

    ordersAPI.getById(orderIdParam)
      .then(res => {
        if (!statusMounted.current) return;
        const o = res?.data || res;
        if (o?.status) setOrderStatus(o.status);
      })
      .catch(() => { /* orderNo may be display number not internal id — socket update covers it */ })
      .finally(() => { if (statusMounted.current) setOrderStatusLoaded(true); });

    joinOrderRoom(orderIdParam);
    const off = onOrderUpdated((payload) => {
      if (Number(payload.order_id) !== orderIdParam) return;
      if (statusMounted.current) setOrderStatus(payload.status);
    });

    if (customerPhone) joinCustomerOrders(customerPhone);

    return () => { off(); statusMounted.current = false; };
  }, [orderIdParam, customerPhone]);

  useEffect(() => {
    if (orderStatus !== 'cancelled') return;
    const t = setTimeout(() => { if (statusMounted.current) setOrderStatus(null); }, 8000);
    return () => clearTimeout(t);
  }, [orderStatus]);

  useEffect(() => {
    if (location.hash === '#locations') {
      const timer = setTimeout(() => {
        document.getElementById('locations')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [location.hash]);

  const toggleFavorite = useCallback(async (storeId, e) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!customerPhone) return;
    const wasFav = favorites.has(storeId);
    setFavorites(prev => { const n = new Set(prev); wasFav ? n.delete(storeId) : n.add(storeId); return n; });
    try {
      if (wasFav) await storesAPI.removeFavorite(customerPhone, storeId);
      else await storesAPI.addFavorite(customerPhone, storeId);
    } catch {
      setFavorites(prev => { const n = new Set(prev); wasFav ? n.add(storeId) : n.delete(storeId); return n; });
    }
  }, [customerPhone, favorites]);

  const search = useCallback(async (over = {}) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        district: (over.district ?? district) || undefined,
        business_type: (over.businessType ?? businessType) !== 'all' ? (over.businessType ?? businessType) : undefined,
        q: (over.keyword ?? keyword) || undefined,
        lat: (over.coords ?? coords)?.lat,
        lng: (over.coords ?? coords)?.lng,
        limit: 12,
      };
      const res = await storesAPI.searchPublic(params);
      const data = res?.data || res;
      setStores((data.stores || []).filter(s => isDisplayableStoreName(s.name)));
      if (data.facets?.businessTypes?.length) setTypes(data.facets.businessTypes);
      setError(null);
    } catch (err) {
      setStores([]);
      if (!err.response) setError('network');
      else if (err.response.status === 502 || err.response.status === 503) setError('server_sleeping');
      else setError('api');
    } finally {
      setLoading(false);
    }
  }, [district, businessType, keyword, coords]);

  useEffect(() => { search(); /* 최초 로드 */ }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const useMyLocation = () => {
    if (!navigator.geolocation) { setGeoMsg('브라우저가 위치를 지원하지 않습니다.'); return; }
    setLocating(true); setGeoMsg('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(c); setLocating(false); setGeoMsg('내 위치 기준으로 가까운 순 정렬했어요.');
        search({ coords: c });
      },
      () => { setLocating(false); setGeoMsg('위치 권한이 거부되었습니다. 지역명으로 검색해 주세요.'); },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <section id="locations" className="py-24 px-6 bg-white relative">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <span className="inline-block px-4 py-1.5 bg-orange-100 text-orange-600 rounded-full text-sm font-bold mb-4">매장 위치</span>
          <h2 className="text-4xl font-black text-gray-900 mb-4 text-balance">내 주변 위마켓 매장 찾기</h2>
          <p className="text-lg text-gray-500 text-pretty">현재 위치 기준으로 가까운 매장을, 지역·업종으로 골라보세요.</p>
        </div>

        {orderNo ? (() => {
          const dispStatus = orderStatus === 'paid' ? 'pending' : (orderStatus || 'pending');
          const configs = {
            pending:   { gradient: 'from-orange-500 to-rose-600',    icon: CheckCircle2, title: '주문이 접수되었어요! 🎉',          subtitle: '맛있게 준비해 드릴게요' },
            confirmed: { gradient: 'from-blue-500 to-indigo-600',   icon: CheckCircle2, title: '매장에서 주문을 확인했어요! ✅',    subtitle: '곧 조리를 시작합니다' },
            preparing: { gradient: 'from-purple-500 to-indigo-600', icon: ChefHat,      title: '맛있게 조리하고 있어요! 🍳',        subtitle: '조금만 기다려주세요' },
            ready:     { gradient: 'from-emerald-500 to-teal-600',  icon: BellRing,     title: '조리 완료! 음식이 준비됐어요 🔔',   subtitle: '매장에서 수령해주세요' },
            completed: { gradient: 'from-slate-500 to-slate-700',   icon: CheckCircle2, title: '수령 완료! 맛있게 드세요 😊',       subtitle: '이용해주셔서 감사합니다' },
            cancelled: { gradient: 'from-rose-500 to-pink-600',     icon: XCircle,      title: '주문이 취소되었어요',               subtitle: '도움이 필요하면 매장에 문의해주세요' },
          };
          const cfg = configs[dispStatus] || configs.pending;
          const Icon = cfg.icon;
          return (
            <motion.div
              key={dispStatus}
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 22 }}
              className={`mb-8 rounded-3xl bg-gradient-to-r ${cfg.gradient} shadow-lg overflow-hidden`}
            >
              <div className="flex items-center justify-between gap-4 p-5 sm:p-6 text-white">
                <div className="flex items-center gap-3 min-w-0">
                  <motion.div
                    key={dispStatus}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                    className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0"
                  >
                    <Icon size={26} aria-hidden="true" />
                  </motion.div>
                  <div className="min-w-0">
                    <p className="text-lg sm:text-xl font-black leading-tight">{cfg.title}</p>
                    <p className="text-sm text-white/85 truncate">{orderStore ? `${orderStore} · ` : ''}{cfg.subtitle}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] font-bold text-white/80 leading-none mb-1">주문번호</p>
                  <p className="text-lg sm:text-2xl font-black leading-none tabular-nums">#{orderNo}</p>
                  {orderEta && (
                    <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold bg-white/20 rounded-full px-2.5 py-1">
                      <Clock size={12} aria-hidden="true" /> 예상 {orderEta}분
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })() : (
          <HighlightBanner district={district} />
        )}

        {/* 검색 바 */}
        <div className="bg-gray-50 border border-gray-100 rounded-3xl p-4 sm:p-5 mb-8 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* 지역 */}
            <div className="md:col-span-3 relative">
              <MapPin size={18} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={district} onChange={e => setDistrict(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()}
                placeholder="지역 (예: 강남구)…" aria-label="지역" name="district" autoComplete="address-level2" spellCheck={false}
                className="w-full h-12 pl-10 pr-3 rounded-xl border border-gray-200 bg-white text-sm font-medium outline-none focus:border-orange-400 focus-visible:ring-2 focus-visible:ring-orange-400/50" />
            </div>
            {/* 업종 */}
            <div className="md:col-span-3 relative">
              <Utensils size={18} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select value={businessType} onChange={e => { setBusinessType(e.target.value); search({ businessType: e.target.value }); }}
                aria-label="업종"
                className="w-full h-12 pl-10 pr-3 rounded-xl border border-gray-200 bg-white text-sm font-medium outline-none focus:border-orange-400 focus-visible:ring-2 focus-visible:ring-orange-400/50 appearance-none">
                <option value="all">전체 업종</option>
                {types.map(t => <option key={t} value={t}>{bizLabel(t)}</option>)}
              </select>
            </div>
            {/* 키워드 */}
            <div className="md:col-span-3 relative">
              <Search size={18} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={keyword} onChange={e => setKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()}
                placeholder="매장명 검색…" aria-label="매장명" name="store-name" spellCheck={false}
                className="w-full h-12 pl-10 pr-3 rounded-xl border border-gray-200 bg-white text-sm font-medium outline-none focus:border-orange-400 focus-visible:ring-2 focus-visible:ring-orange-400/50" />
            </div>
            {/* 액션 */}
            <div className="md:col-span-3 flex gap-2">
              <button type="button" onClick={useMyLocation} disabled={locating} aria-label="내 위치로 주변 매장 찾기"
                className="flex-1 h-12 flex items-center justify-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 text-orange-600 text-sm font-black hover:bg-orange-100 transition-colors disabled:opacity-50">
                {locating ? <Loader2 size={16} aria-hidden="true" className="animate-spin" /> : <Navigation size={16} aria-hidden="true" />} 내 주변
              </button>
              <button type="button" onClick={() => search()} aria-label="매장 검색"
                className="flex-1 h-12 flex items-center justify-center gap-1.5 rounded-xl bg-orange-500 text-white text-sm font-black hover:bg-orange-600 transition-colors shadow-lg shadow-orange-200">
                <Search size={16} aria-hidden="true" /> 검색
              </button>
            </div>
          </div>
          {geoMsg && <p className="text-xs text-gray-500 mt-2 pl-1">{geoMsg}</p>}
        </div>

        {/* 보기 전환 + 결과 수 */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm text-gray-500 font-bold">
            {loading ? '검색 중…' : `총 ${stores.length}개 매장`}
          </p>
          <div className="inline-flex bg-gray-100 rounded-xl p-1">
            {[
              { key: 'grid', label: '그리드', icon: LayoutGrid },
              { key: 'list', label: '리스트', icon: List },
              { key: 'map', label: '지도', icon: MapIcon },
            ].map(({ key, label, icon: Icon }) => (
              <button key={key} type="button" onClick={() => setView(key)}
                className={`flex items-center gap-1.5 px-3 sm:px-4 h-9 rounded-lg text-sm font-black transition-colors ${view === key ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                aria-pressed={view === key} aria-label={`${label} 보기`}>
                <Icon size={15} aria-hidden="true" /> <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 결과 */}
        {loading ? (
          <div className={view === 'map' ? '' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'}>
            {view === 'map'
              ? <div className="skeleton h-[420px] rounded-3xl" />
              : [0, 1, 2].map(i => <div key={i} className="skeleton h-28 rounded-2xl" />)}
          </div>
        ) : error && stores.length === 0 ? (
          <div className="text-center py-16">
            <div className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-4 ${
              error === 'server_sleeping' ? 'bg-amber-50' : 'bg-red-50'
            }`}>
              {error === 'server_sleeping' ? (
                <Server className="w-10 h-10 text-amber-400" />
              ) : (
                <AlertTriangle className="w-10 h-10 text-red-400" />
              )}
            </div>
            <p className="text-gray-700 font-bold mb-1">
              {error === 'server_sleeping' ? '서버가 시작 중입니다' : error === 'network' ? '서버에 연결할 수 없습니다' : '데이터를 불러올 수 없습니다'}
            </p>
            <p className="text-sm text-gray-400 mb-4">
              {error === 'server_sleeping' ? '잠시 후 자동으로 재시도됩니다' : '네트워크 연결을 확인해 주세요'}
            </p>
            <button
              onClick={() => search()}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-bold hover:bg-orange-600 transition-colors"
            >
              <RefreshCw size={14} /> 다시 시도
            </button>
          </div>
        ) : stores.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🔍</div>
            <p className="text-gray-500 font-bold">조건에 맞는 매장이 없어요</p>
            <p className="text-sm text-gray-400 mt-1">지역·업종을 바꾸거나 전체로 검색해 보세요.</p>
          </div>
        ) : view === 'map' ? (
          /* ── 지도 보기 (기본) ── */
          <div>
            <StoreMapLeaflet stores={stores} coords={coords} />
            {!stores.some(s => s.latitude != null) && (
              <p className="text-xs text-gray-400 mt-2 text-center">※ 좌표가 등록된 매장만 지도에 표시됩니다. 리스트/그리드로 전체를 확인하세요.</p>
            )}
          </div>
        ) : view === 'list' ? (
          /* ── 리스트 보기 ── */
          <div className="space-y-2.5">
            {stores.map((s, i) => (
              <motion.div key={s.id}
                initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.25) }}>
                <Link to={`/menu/${s.id}`}
                  className="flex items-center gap-4 bg-white border border-gray-100 rounded-2xl p-4 hover:border-orange-200 hover:shadow-md transition-all group">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center shrink-0 shadow-sm">
                    <Store size={20} className="text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-black text-gray-900 truncate">{s.name}</h3>
                      {s.business_type && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-500">{bizLabel(s.business_type)}</span>}
                      {s.distance_km != null && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-500 flex items-center gap-0.5"><Navigation size={9} aria-hidden="true" /><span className="tabular-nums">{s.distance_km}</span>km</span>}
                    </div>
                    {s.address && <p className="text-sm text-gray-500 mt-0.5 truncate flex items-center gap-1"><MapPin size={12} className="text-gray-400 shrink-0" />{s.address}</p>}
                  </div>
                  <NaverShareButton
                    url={`${window.location.origin}/menu/${s.id}`}
                    title={`${s.name} - 위마켓에서 찾은 맛집이에요!`}
                    size="sm"
                  />
                  {customerPhone && (
                    <button type="button" onClick={(e) => toggleFavorite(s.id, e)}
                      className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${favorites.has(s.id) ? 'text-rose-500 bg-rose-50' : 'text-gray-300 hover:text-rose-400'}`}
                      aria-label={favorites.has(s.id) ? '찜 해제' : '찜하기'}>
                      <Heart size={16} className={favorites.has(s.id) ? 'fill-rose-400' : ''} />
                    </button>
                  )}
                  <ChevronRight size={18} className="text-gray-300 group-hover:text-orange-500 group-hover:translate-x-1 transition-all shrink-0" />
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          /* ── 그리드 보기 ── */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stores.map((s, i) => (
              <motion.div key={s.id}
                initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.3) }}>
                <Link to={`/menu/${s.id}`}
                  className="block bg-white border border-gray-100 rounded-2xl p-5 hover:border-orange-200 hover:shadow-lg transition-all group h-full">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center shrink-0 shadow-md">
                      <Store size={22} className="text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-gray-900 truncate">{s.name}</h3>
                        <NaverShareButton
                          url={`${window.location.origin}/menu/${s.id}`}
                          title={`${s.name} - 위마켓에서 찾은 맛집이에요!`}
                          size="sm"
                        />
                        {customerPhone && (
                          <button type="button" onClick={(e) => toggleFavorite(s.id, e)}
                            className={`shrink-0 transition-colors ${favorites.has(s.id) ? 'text-rose-500' : 'text-gray-300 hover:text-rose-400'}`}
                            aria-label={favorites.has(s.id) ? '찜 해제' : '찜하기'}>
                            <Heart size={14} className={favorites.has(s.id) ? 'fill-rose-400' : ''} />
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {s.business_type && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-500">{bizLabel(s.business_type)}</span>
                        )}
                        {s.distance_km != null && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-500 flex items-center gap-0.5">
                            <Navigation size={9} aria-hidden="true" /> <span className="tabular-nums">{s.distance_km}</span>km
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {s.address && (
                    <p className="text-sm text-gray-500 mt-3 flex items-start gap-1.5">
                      <MapPin size={14} className="mt-0.5 shrink-0 text-gray-400" /> <span className="line-clamp-1">{s.address}</span>
                    </p>
                  )}
                  <div className="flex items-center justify-end mt-3 text-orange-500 text-sm font-black gap-1 group-hover:gap-2 transition-all">
                    메뉴 보기 <ChevronRight size={16} />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
